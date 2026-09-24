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
    const filename = `prod_${file.fieldname}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    
    const command = new PutObjectCommand({
        Bucket: process.env.ORACLE_S3_BUCKET_NAME,
        Key: filename,
        Body: file.buffer,
        ContentType: file.mimetype
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
