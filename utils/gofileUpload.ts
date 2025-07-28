import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import path from 'path';

/**
 * Gofile.io upload utility for firmware files
 * Provides anonymous file hosting for firmware development and sharing
 */

export interface GofileUploadResult {
  success: boolean;
  downloadPage: string;
  directLink: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  uploadTime: string;
}

/**
 * Gets the best available Gofile.io server for upload
 */
const getBestServer = async (): Promise<string> => {
  try {
    const response = await axios.get('https://api.gofile.io/getServer');
    
    if (response.data.status === 'ok') {
      return response.data.data.server;
    }
    
    // Fallback to default server
    return 'store1';
  } catch (error) {
    console.log('⚠️  Could not get optimal server, using default');
    return 'store1';
  }
};

/**
 * Uploads a firmware file to Gofile.io
 */
export const uploadToGofile = async (
  filePath: string,
  onProgress?: (uploaded: number, total: number) => void
): Promise<GofileUploadResult> => {
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;
  
  console.log(`🚀 Starting upload to Gofile.io: ${fileName} (${fileSize} bytes)`);
  
  // Get the best server for upload
  const server = await getBestServer();
  console.log(`📡 Using server: ${server}`);
  
  // Create form data
  const formData = new FormData();
  const fileStream = fs.createReadStream(filePath);
  
  formData.append('file', fileStream, {
    filename: fileName,
    contentType: 'application/octet-stream',
  });

  let uploadedBytes = 0;
  
  // Track upload progress
  formData.on('data', (chunk) => {
    uploadedBytes += chunk.length;
    if (onProgress) {
      onProgress(uploadedBytes, fileSize);
    }
    
    const percent = fileSize > 0 ? ((uploadedBytes / fileSize) * 100).toFixed(1) : '0.0';
    process.stdout.write(`\r⬆️  Uploaded: ${uploadedBytes}/${fileSize} bytes (${percent}%)`);
  });

  try {
    const response = await axios.post(
      `https://${server}.gofile.io/uploadFile`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'User-Agent': 'samfirm.js-firmware-uploader/1.0',
        },
        timeout: 600000, // 10 minute timeout for large files
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    console.log('\n✅ Upload completed successfully!');

    if (response.data.status === 'ok') {
      const data = response.data.data;
      
      const result: GofileUploadResult = {
        success: true,
        downloadPage: data.downloadPage,
        directLink: data.directLink || data.downloadPage,
        fileId: data.fileId,
        fileName: fileName,
        fileSize: fileSize,
        uploadTime: new Date().toISOString(),
      };

      console.log(`🔗 Download page: ${result.downloadPage}`);
      console.log(`📁 File ID: ${result.fileId}`);
      
      return result;
    } else {
      throw new Error(`Upload failed: ${response.data.message || 'Unknown error'}`);
    }

  } catch (error: any) {
    console.log('\n❌ Upload failed:', error.message);
    
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
    
    throw new Error(`Gofile.io upload failed: ${error.message}`);
  }
};

/**
 * Uploads firmware with detailed progress tracking
 */
export const uploadFirmwareToGofile = async (
  filePath: string,
  firmwareInfo: { model: string; region: string; version: string }
): Promise<GofileUploadResult> => {
  
  console.log(`📤 Preparing to upload firmware:`);
  console.log(`   Model: ${firmwareInfo.model}`);
  console.log(`   Region: ${firmwareInfo.region}`);
  console.log(`   Version: ${firmwareInfo.version}`);
  console.log(`   File: ${path.basename(filePath)}`);
  
  let lastProgressTime = Date.now();
  let lastUploadedBytes = 0;
  
  const result = await uploadToGofile(filePath, (uploaded, total) => {
    const now = Date.now();
    
    // Update progress every 2 seconds to avoid spam
    if (now - lastProgressTime > 2000) {
      const speed = (uploaded - lastUploadedBytes) / ((now - lastProgressTime) / 1000);
      const speedMB = (speed / 1024 / 1024).toFixed(2);
      
      console.log(`\n📊 Upload speed: ${speedMB} MB/s`);
      
      lastProgressTime = now;
      lastUploadedBytes = uploaded;
    }
  });
  
  console.log(`\n🎉 Firmware uploaded successfully!`);
  console.log(`🔗 Share this link: ${result.downloadPage}`);
  
  return result;
};

/**
 * Creates a shareable summary of the uploaded firmware
 */
export const createUploadSummary = (
  uploadResult: GofileUploadResult,
  firmwareInfo: { model: string; region: string; version: string; originalModel?: string }
): string => {
  
  const summary = `
🔧 **Samsung Firmware Upload Complete**

📱 **Device Information:**
   • Model: ${firmwareInfo.model}${firmwareInfo.originalModel ? ` (transformed from ${firmwareInfo.originalModel})` : ''}
   • Region: ${firmwareInfo.region}
   • Version: ${firmwareInfo.version}

📦 **File Information:**
   • Filename: ${uploadResult.fileName}
   • Size: ${(uploadResult.fileSize / 1024 / 1024).toFixed(2)} MB
   • Upload Time: ${uploadResult.uploadTime}

🔗 **Download Links:**
   • Download Page: ${uploadResult.downloadPage}
   • File ID: ${uploadResult.fileId}

⚠️  **Important Notes:**
   • This firmware is for development and analysis purposes
   • Do not flash cross-generation firmware to actual devices
   • Always verify firmware compatibility before flashing

🛠️ **Generated by samfirm.js with model transformation capability**
`;

  return summary.trim();
};
