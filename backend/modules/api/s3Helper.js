const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const { PassThrough } = require('stream');
require('dotenv').config();

let ffmpeg = null;
try {
    ffmpeg = require('fluent-ffmpeg');
    const ffmpegStatic = require('ffmpeg-static');
    ffmpeg.setFfmpegPath(ffmpegStatic);
} catch (e) {
    console.log('FFmpeg not installed. Audio conversion will be skipped.');
}

async function convertAudioToOggOpus(inputBuffer) {
    if (!ffmpeg) throw new Error("ffmpeg not available");
    return new Promise((resolve, reject) => {
        const inputStream = new PassThrough();
        inputStream.end(inputBuffer);

        const chunks = [];
        const outputStream = new PassThrough();

        outputStream.on('data', chunk => chunks.push(chunk));
        outputStream.on('end', () => resolve(Buffer.concat(chunks)));
        outputStream.on('error', reject);

        ffmpeg(inputStream)
            .audioCodec('libopus')
            .format('ogg')
            .on('error', (err) => reject(err))
            .pipe(outputStream, { end: true });
    });
}

const s3Client = new S3Client({
    region: process.env.ORACLE_S3_REGION || 'ap-mumbai-1',
    endpoint: `https://${process.env.ORACLE_S3_NAMESPACE}.compat.objectstorage.${process.env.ORACLE_S3_REGION}.oraclecloud.com`,
    credentials: {
        accessKeyId: process.env.ORACLE_S3_ACCESS_KEY,
        secretAccessKey: process.env.ORACLE_S3_SECRET_KEY,
    },
    // Required for non-AWS S3 endpoints usually
    forcePathStyle: true 
});

async function uploadToOracleS3(file) {
    if (!file || !file.buffer) return null;

    const ext = path.extname(file.originalname) || '';
    const filename = `prod_${file.fieldname}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    
    let contentType = file.mimetype;
    if (ext.toLowerCase() === '.ogg') {
        contentType = 'audio/ogg; codecs=opus';
        try {
            console.log('Converting audio buffer to actual OGG Opus format...');
            file.buffer = await convertAudioToOggOpus(file.buffer);
            console.log('Audio conversion successful!');
        } catch (e) {
            console.error('Audio conversion failed:', e);
            // Fallback to original buffer if conversion fails
        }
    }

    const command = new PutObjectCommand({
        Bucket: process.env.ORACLE_S3_BUCKET_NAME,
        Key: filename,
        Body: file.buffer,
        ContentType: contentType
    });
    
    await s3Client.send(command);
    
    // The bucket is Public, so we can construct the direct download URL
    return `https://${process.env.ORACLE_S3_NAMESPACE}.compat.objectstorage.${process.env.ORACLE_S3_REGION}.oraclecloud.com/${process.env.ORACLE_S3_BUCKET_NAME}/${filename}`;
}

async function deleteFromOracleS3(url) {
    if (!url || typeof url !== 'string') return;
    try {
        const prefix = `https://${process.env.ORACLE_S3_NAMESPACE}.compat.objectstorage.${process.env.ORACLE_S3_REGION}.oraclecloud.com/${process.env.ORACLE_S3_BUCKET_NAME}/`;
        if (url.startsWith(prefix)) {
            const key = url.replace(prefix, '');
            const command = new DeleteObjectCommand({
                Bucket: process.env.ORACLE_S3_BUCKET_NAME,
                Key: key
            });
            await s3Client.send(command);
        }
    } catch (e) {
        console.error("Failed to delete object from S3", url, e);
    }
}

module.exports = { uploadToOracleS3, deleteFromOracleS3 };
