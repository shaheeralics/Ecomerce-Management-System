const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
require('dotenv').config();

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
    let contentType = file.mimetype;
    let finalBuffer = file.buffer;
    let finalExt = ext.toLowerCase();

    if (file.fieldname === 'voice' || file.fieldname === 'audio') {
        try {
            const ffmpeg = require('fluent-ffmpeg');
            const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
            ffmpeg.setFfmpegPath(ffmpegInstaller.path);
            const { Readable, PassThrough } = require('stream');

            finalBuffer = await new Promise((resolve, reject) => {
                const inputStream = new Readable();
                inputStream.push(file.buffer);
                inputStream.push(null);

                const outStream = new PassThrough();
                const chunks = [];
                outStream.on('data', chunk => chunks.push(chunk));
                outStream.on('end', () => resolve(Buffer.concat(chunks)));
                outStream.on('error', reject);

                ffmpeg(inputStream)
                    .audioCodec('libopus')
                    .audioChannels(1)
                    .audioFrequency(16000)
                    .format('ogg')
                    .on('error', reject)
                    .pipe(outStream, { end: true });
            });
            finalExt = '.ogg';
            contentType = 'audio/ogg; codecs=opus';
        } catch (err) {
            console.error('FFMPEG conversion failed, falling back to original buffer', err);
        }
    }

    if (finalExt === '.mp3') {
        contentType = 'audio/mpeg';
    } else if (finalExt === '.ogg' && contentType !== 'audio/ogg; codecs=opus') {
        contentType = 'audio/ogg; codecs=opus';
    }

    const filename = `prod_${file.fieldname}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${finalExt}`;

    const command = new PutObjectCommand({
        Bucket: process.env.ORACLE_S3_BUCKET_NAME,
        Key: filename,
        Body: finalBuffer,
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
