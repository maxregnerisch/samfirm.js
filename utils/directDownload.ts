import axios from 'axios';
import fs from 'fs';
import path from 'path';

/**
 * Direct firmware download using constructed URLs
 * This bypasses Samsung's authentication system entirely
 */

export interface DirectFirmwareInfo {
  model: string;
  region: string;
  pda: string;
  csc: string;
  modem: string;
  filename?: string;
}

/**
 * Constructs potential Samsung firmware download URLs
 */
const constructFirmwareUrls = (info: DirectFirmwareInfo): string[] => {
  const { model, region, pda, csc, modem } = info;
  
  // Common Samsung firmware filename patterns
  const possibleFilenames = [
    `${model}_${pda}_${csc}_${modem}_HOME.tar.md5`,
    `${model}_${pda}_${csc}_${modem}.tar.md5`,
    `${model}_${region}_${pda}_${csc}_${modem}_HOME.tar.md5`,
    `${model}_${region}_${pda}_${csc}_${modem}.tar.md5`,
    `${pda}_${csc}_${modem}_HOME.tar.md5`,
    `${pda}_${csc}_${modem}.tar.md5`,
  ];

  const baseUrls = [
    'http://cloud-neofussvr.sslcs.cdngc.net/NF_DownloadBinaryForMass.do?file=',
    'https://cloud-neofussvr.sslcs.cdngc.net/NF_DownloadBinaryForMass.do?file=',
    'http://neofussvr.sslcs.cdngc.net/NF_DownloadBinaryForMass.do?file=',
    'https://neofussvr.sslcs.cdngc.net/NF_DownloadBinaryForMass.do?file=',
  ];

  const pathPatterns = [
    `/neofus/firmware/${region}/${model}/${pda}/`,
    `/neofus/firmware/${region}/${model}/`,
    `/firmware/${region}/${model}/${pda}/`,
    `/firmware/${region}/${model}/`,
    `/${region}/${model}/${pda}/`,
    `/${region}/${model}/`,
  ];

  const urls: string[] = [];
  
  for (const baseUrl of baseUrls) {
    for (const pathPattern of pathPatterns) {
      for (const filename of possibleFilenames) {
        urls.push(`${baseUrl}${pathPattern}${filename}`);
      }
    }
  }

  return urls;
};

/**
 * Tests if a URL is accessible and returns file info
 */
const testFirmwareUrl = async (url: string): Promise<{ accessible: boolean; size?: number; filename?: string }> => {
  try {
    const response = await axios.head(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (response.status === 200) {
      const size = parseInt(response.headers['content-length'] || '0');
      const filename = url.split('/').pop() || 'firmware.tar.md5';
      
      return {
        accessible: true,
        size,
        filename,
      };
    }
    
    return { accessible: false };
  } catch (error) {
    return { accessible: false };
  }
};

/**
 * Finds accessible firmware download URL
 */
export const findAccessibleFirmwareUrl = async (info: DirectFirmwareInfo): Promise<{
  url: string;
  size: number;
  filename: string;
} | null> => {
  
  console.log('🔍 Searching for accessible firmware URLs...');
  
  const urls = constructFirmwareUrls(info);
  console.log(`📋 Testing ${urls.length} potential URLs...`);

  // Test URLs in batches to avoid overwhelming the server
  const batchSize = 5;
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    
    console.log(`🔄 Testing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(urls.length / batchSize)}...`);
    
    const promises = batch.map(async (url) => {
      const result = await testFirmwareUrl(url);
      return { url, ...result };
    });

    const results = await Promise.all(promises);
    
    // Find the first accessible URL
    for (const result of results) {
      if (result.accessible && result.size && result.size > 1000000) { // At least 1MB
        console.log(`✅ Found accessible firmware URL!`);
        console.log(`📁 File: ${result.filename}`);
        console.log(`📦 Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`🔗 URL: ${result.url}`);
        
        return {
          url: result.url,
          size: result.size,
          filename: result.filename!,
        };
      }
    }

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('❌ No accessible firmware URLs found');
  return null;
};

/**
 * Downloads firmware directly without authentication
 */
export const downloadFirmwareDirect = async (
  url: string,
  outputPath: string,
  onProgress?: (downloaded: number, total: number) => void
): Promise<string> => {
  
  console.log(`🚀 Starting direct download from: ${url}`);
  console.log(`📁 Output: ${outputPath}`);

  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
      },
      timeout: 300000, // 5 minute timeout
    });

    const totalSize = parseInt(response.headers['content-length'] || '0');
    let downloadedSize = 0;

    console.log(`📦 Downloading: ${path.basename(outputPath)} (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const writer = fs.createWriteStream(outputPath);
    
    response.data.on('data', (chunk: Buffer) => {
      downloadedSize += chunk.length;
      if (onProgress) {
        onProgress(downloadedSize, totalSize);
      }
      
      const percent = totalSize > 0 ? ((downloadedSize / totalSize) * 100).toFixed(1) : '0.0';
      const downloadedMB = (downloadedSize / 1024 / 1024).toFixed(2);
      const totalMB = (totalSize / 1024 / 1024).toFixed(2);
      
      process.stdout.write(`\r⬇️  Downloaded: ${downloadedMB}/${totalMB} MB (${percent}%)`);
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log('\n✅ Direct download completed successfully!');
        resolve(outputPath);
      });
      
      writer.on('error', (error) => {
        console.log('\n❌ Direct download failed:', error.message);
        reject(error);
      });
    });

  } catch (error: any) {
    console.log('\n❌ Direct download failed:', error.message);
    throw error;
  }
};

/**
 * Complete direct download workflow
 */
export const directDownloadWorkflow = async (
  info: DirectFirmwareInfo,
  outputDir: string,
  onProgress?: (downloaded: number, total: number) => void
): Promise<string> => {
  
  // Find accessible URL
  const urlInfo = await findAccessibleFirmwareUrl(info);
  
  if (!urlInfo) {
    throw new Error('No accessible firmware URLs found. Samsung may have changed their URL structure or blocked access.');
  }

  // Download the firmware
  const outputPath = path.join(outputDir, urlInfo.filename);
  return await downloadFirmwareDirect(urlInfo.url, outputPath, onProgress);
};
