#!/usr/bin/env node

import axios, { AxiosResponse } from "axios";
import cliProgress from "cli-progress";
import crypto from "crypto";
import fs from "fs";
import { parse as xmlParse } from "fast-xml-parser";
import path from "path";
import unzip from "unzip-stream";
import yargs from "yargs";

import { handleAuthRotation } from "./utils/authUtils";
import {
  getBinaryInformMsg,
  getBinaryInitMsg,
  getDecryptionKey,
} from "./utils/msgUtils";
import { transformModel } from "./utils/modelTransformer";
import { downloadFirmwareBypass, createFirmwareInfo } from "./utils/downloadBypass";
import { uploadFirmwareToGofile, createUploadSummary } from "./utils/gofileUpload";
import { directDownloadWorkflow } from "./utils/directDownload";
import { version as packageVersion } from "./package.json";

const getLatestVersion = async (
  region: string,
  model: string
): Promise<{ pda: string; csc: string; modem: string }> => {
  return axios
    .get(
      `https://fota-cloud-dn.ospserver.net/firmware/${region}/${model}/version.xml`
    )
    .then((res: AxiosResponse) => {
      const [pda, csc, modem] = xmlParse(
        res.data
      ).versioninfo.firmware.version.latest.split("/");

      return { pda, csc, modem };
    });
};

const main = async (region: string, model: string): Promise<void> => {
  // Apply model transformation for deep recoding
  const modelInfo = transformModel(model);
  const processedModel = modelInfo.transformed;

  console.log(`
  Model: ${modelInfo.original}${modelInfo.wasTransformed ? ` (processing as ${processedModel})` : ''}
  Region: ${region}`);

  const { pda, csc, modem } = await getLatestVersion(region, processedModel);

  console.log(`
  Latest version:
    PDA: ${pda}
    CSC: ${csc}
    MODEM: ${modem !== "" ? modem : "N/A"}`);

  const nonce = {
    encrypted: "",
    decrypted: "",
  };

  const headers: Record<string, string> = {
    "User-Agent": "Kies2.0_FUS",
  };

  const handleHeaders = (responseHeaders: any) => {
    if (responseHeaders.nonce != null) {
      const { Authorization, nonce: newNonce } = handleAuthRotation(
        responseHeaders
      );

      Object.assign(nonce, newNonce);
      headers.Authorization = Authorization;
    }

    const sessionID = responseHeaders["set-cookie"]
      ?.find((cookie: string) => cookie.startsWith("JSESSIONID"))
      ?.split(";")[0];

    if (sessionID != null) {
      headers.Cookie = sessionID;
    }
  };

  await axios
    .post("https://neofussvr.sslcs.cdngc.net/NF_DownloadGenerateNonce.do", "", {
      headers: {
        Authorization:
          'FUS nonce="", signature="", nc="", type="", realm="", newauth="1"',
        "User-Agent": "Kies2.0_FUS",
        Accept: "application/xml",
      },
    })
    .then((res) => {
      handleHeaders(res.headers);
      return res;
    });

  const {
    binaryByteSize,
    binaryDescription,
    binaryFilename,
    binaryLogicValue,
    binaryModelPath,
    binaryOSVersion,
    binaryVersion,
  } = await axios
    .post(
      "https://neofussvr.sslcs.cdngc.net/NF_DownloadBinaryInform.do",
      getBinaryInformMsg(
        `${pda}/${csc}/${modem !== "" ? modem : pda}/${pda}`,
        region,
        processedModel,
        nonce.decrypted
      ),
      {
        headers: {
          ...headers,
          Accept: "application/xml",
          "Content-Type": "application/xml",
        },
      }
    )
    .then((res) => {
      handleHeaders(res.headers);
      return res;
    })
    .then((res: AxiosResponse) => {
      const parsedInfo = xmlParse(res.data);

      return {
        binaryByteSize: parsedInfo.FUSMsg.FUSBody.Put.BINARY_BYTE_SIZE.Data,
        binaryDescription: parsedInfo.FUSMsg.FUSBody.Put.DESCRIPTION.Data,
        binaryFilename: parsedInfo.FUSMsg.FUSBody.Put.BINARY_NAME.Data,
        binaryLogicValue:
          parsedInfo.FUSMsg.FUSBody.Put.LOGIC_VALUE_FACTORY.Data,
        binaryModelPath: parsedInfo.FUSMsg.FUSBody.Put.MODEL_PATH.Data,
        binaryOSVersion: parsedInfo.FUSMsg.FUSBody.Put.CURRENT_OS_VERSION.Data,
        binaryVersion: parsedInfo.FUSMsg.FUSBody.Results.LATEST_FW_VERSION.Data,
      };
    });

  console.log(`
  OS: ${binaryOSVersion}
  Filename: ${binaryFilename}
  Size: ${binaryByteSize} bytes
  Logic Value: ${binaryLogicValue}
  Description:
    ${binaryDescription.split("\n").join("\n    ")}`);

  const decryptionKey = getDecryptionKey(binaryVersion, binaryLogicValue);

  await axios
    .post(
      "https://neofussvr.sslcs.cdngc.net/NF_DownloadBinaryInitForMass.do",
      getBinaryInitMsg(binaryFilename, nonce.decrypted),
      {
        headers: {
          ...headers,
          Accept: "application/xml",
          "Content-Type": "application/xml",
        },
      }
    )
    .then((res) => {
      handleHeaders(res.headers);
      return res;
    });

  const binaryDecipher = crypto.createDecipheriv(
    "aes-128-ecb",
    decryptionKey,
    null
  );

  await axios
    .get(
      `http://cloud-neofussvr.sslcs.cdngc.net/NF_DownloadBinaryForMass.do?file=${binaryModelPath}${binaryFilename}`,
      {
        headers,
        responseType: "stream",
      }
    )
    .then((res: AxiosResponse) => {
      const outputFolder = `${process.cwd()}/${modelInfo.original}_${region}/`;
      console.log();
      console.log(outputFolder);
      fs.mkdirSync(outputFolder, { recursive: true });

      let downloadedSize = 0;
      let currentFile = "";
      const progressBar = new cliProgress.SingleBar({
        format: "{bar} {percentage}% | {value}/{total} | {file}",
        barCompleteChar: "\u2588",
        barIncompleteChar: "\u2591",
      });
      progressBar.start(binaryByteSize, downloadedSize);

      return res.data
        .on("data", (buffer: Buffer) => {
          downloadedSize += buffer.length;
          progressBar.update(downloadedSize, { file: currentFile });
        })
        .pipe(binaryDecipher)
        .pipe(unzip.Parse())
        .on("entry", (entry) => {
          currentFile = `${entry.path.slice(0, 18)}...`;
          progressBar.update(downloadedSize, { file: currentFile });
          entry
            .pipe(fs.createWriteStream(path.join(outputFolder, entry.path)))
            .on("finish", () => {
              if (downloadedSize === binaryByteSize) {
                process.exit();
              }
            });
        });
    });
};

/**
 * Main function with bypass download and gofile.io upload
 * This bypasses Samsung's hardware-specific decryption for development purposes
 */
const mainBypassDownload = async (region: string, model: string, outputDir: string): Promise<void> => {
  try {
    // Apply model transformation for deep recoding
    const modelInfo = transformModel(model);
    const processedModel = modelInfo.transformed;

    console.log(`
🔧 BYPASS DOWNLOAD MODE - For firmware development and analysis
  Model: ${modelInfo.original}${modelInfo.wasTransformed ? ` (processing as ${processedModel})` : ''}
  Region: ${region}
  Output: ${outputDir}`);

    // Get firmware version info
    const { pda, csc, modem } = await getLatestVersion(region, processedModel);

    console.log(`
  Latest version:
    PDA: ${pda}
    CSC: ${csc}
    MODEM: ${modem}`);

    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Try direct download (completely bypasses Samsung authentication)
    console.log(`\n🚀 Attempting direct firmware download...`);
    
    const downloadedFile = await directDownloadWorkflow({
      model: processedModel,
      region: region,
      pda: pda,
      csc: csc,
      modem: modem,
    }, outputDir);
    
    console.log(`\n✅ Download completed: ${downloadedFile}`);

    // Upload to gofile.io
    console.log(`\n📤 Uploading to Gofile.io...`);
    
    const uploadResult = await uploadFirmwareToGofile(downloadedFile, {
      model: processedModel,
      region: region,
      version: pda,
    });

    // Create and display summary
    const summary = createUploadSummary(uploadResult, {
      model: processedModel,
      region: region,
      version: pda,
      originalModel: modelInfo.wasTransformed ? modelInfo.original : undefined,
    });

    console.log(`\n${summary}`);

    // Save summary to file
    const filename = path.basename(downloadedFile);
    const summaryPath = path.join(outputDir, `${filename}_upload_summary.txt`);
    fs.writeFileSync(summaryPath, summary);
    console.log(`\n📄 Summary saved to: ${summaryPath}`);

  } catch (error: any) {
    console.error(`\n❌ Error in bypass download: ${error.message}`);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    process.exit(1);
  }
};

const { argv } = yargs
  .option("model", {
    alias: "m",
    describe: "Model",
    type: "string",
    demandOption: true,
  })
  .option("region", {
    alias: "r",
    describe: "Region",
    type: "string",
    demandOption: true,
  })
  .option("bypass-download", {
    alias: "b",
    describe: "Use bypass download method and upload to gofile.io",
    type: "boolean",
    default: false,
  })
  .option("output", {
    alias: "o",
    describe: "Output directory for downloaded firmware",
    type: "string",
    default: "./downloads",
  })
  .version(packageVersion)
  .alias("v", "version")
  .help();

if (argv.bypassDownload) {
  mainBypassDownload(argv.region, argv.model, argv.output);
} else {
  main(argv.region, argv.model);
}

export {};
