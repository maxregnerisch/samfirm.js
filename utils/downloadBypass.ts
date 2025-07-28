import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Alternative firmware download method that bypasses Samsung's hardware-specific decryption
 * This is specifically for firmware development and analysis purposes
 */

export interface FirmwareInfo {
  pda: string;
  csc: string;
  modem: string;
  model: string;
  region: string;
  filename: string;
  size: number;
  downloadUrl: string;
}

/**
 * Attempts to download firmware using alternative methods
 * This bypasses the hardware-specific decryption validation
 */
export const downloadFirmwareBypass = async (
  firmwareInfo: FirmwareInfo,
  outputPath: string,
  onProgress?: (downloaded: number, total: number) => void
): Promise<string> => {
  console.log('🔄 Attempting firmware download with bypass method...');
  console.log(`📁 Output path: ${outputPath}`);
  
  try {
    // Method 1: Try direct download without decryption
    const response = await axios({
      method: 'GET',
      url: firmwareInfo.downloadUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity', // Disable compression for firmware files
      },
      timeout: 300000, // 5 minute timeout
    });

    const totalSize = parseInt(response.headers['content-length'] || '0');
    let downloadedSize = 0;

    console.log(`📦 Starting download: ${firmwareInfo.filename} (${totalSize} bytes)`);

    const writer = fs.createWriteStream(outputPath);
    
    response.data.on('data', (chunk: Buffer) => {
      downloadedSize += chunk.length;
      if (onProgress) {
        onProgress(downloadedSize, totalSize);
      }
      
      // Progress indicator
      const percent = totalSize > 0 ? ((downloadedSize / totalSize) * 100).toFixed(1) : '0.0';
      process.stdout.write(`\r⬇️  Downloaded: ${downloadedSize}/${totalSize} bytes (${percent}%)`);
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log('\n✅ Download completed successfully!');
        resolve(outputPath);
      });
      
      writer.on('error', (error) => {
        console.log('\n❌ Download failed:', error.message);
        reject(error);
      });
    });

  } catch (error: any) {
    console.log('\n❌ Direct download failed:', error.message);
    
    // Method 2: Try with different headers/authentication
    console.log('🔄 Trying alternative download method...');
    
    try {
      return await downloadWithAlternativeAuth(firmwareInfo, outputPath, onProgress);
    } catch (altError: any) {
      throw new Error(`All download methods failed. Last error: ${altError.message}`);
    }
  }
};

/**
 * Alternative download method with different authentication approach
 */
const downloadWithAlternativeAuth = async (
  firmwareInfo: FirmwareInfo,
  outputPath: string,
  onProgress?: (downloaded: number, total: number) => void
): Promise<string> => {
  
  // Try downloading without Samsung's specific authentication
  const response = await axios({
    method: 'GET',
    url: firmwareInfo.downloadUrl.replace('neofussvr.sslcs.cdngc.net', 'cloud-neofussvr.sslcs.cdngc.net'),
    responseType: 'stream',
    headers: {
      'User-Agent': 'Kies2.0_FUS',
      'Accept': 'application/octet-stream',
    },
    timeout: 300000,
  });

  const totalSize = parseInt(response.headers['content-length'] || '0');
  let downloadedSize = 0;

  console.log(`📦 Alternative download: ${firmwareInfo.filename} (${totalSize} bytes)`);

  const writer = fs.createWriteStream(outputPath);
  
  response.data.on('data', (chunk: Buffer) => {
    downloadedSize += chunk.length;
    if (onProgress) {
      onProgress(downloadedSize, totalSize);
    }
    
    const percent = totalSize > 0 ? ((downloadedSize / totalSize) * 100).toFixed(1) : '0.0';
    process.stdout.write(`\r⬇️  Downloaded: ${downloadedSize}/${totalSize} bytes (${percent}%)`);
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      console.log('\n✅ Alternative download completed!');
      resolve(outputPath);
    });
    
    writer.on('error', (error) => {
      console.log('\n❌ Alternative download failed:', error.message);
      reject(error);
    });
  });
};

/**
 * Creates firmware info from the existing Samsung API response
 */
export const createFirmwareInfo = (
  model: string,
  region: string,
  pda: string,
  csc: string,
  modem: string,
  binaryFilename: string,
  binaryByteSize: number,
  binaryModelPath: string
): FirmwareInfo => {
  return {
    pda,
    csc,
    modem,
    model,
    region,
    filename: binaryFilename,
    size: binaryByteSize,
    downloadUrl: `http://cloud-neofussvr.sslcs.cdngc.net/NF_DownloadBinaryForMass.do?file=${binaryModelPath}${binaryFilename}`,
  };
};
