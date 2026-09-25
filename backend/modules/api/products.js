const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../../db');
const { uploadToOracleS3 } = require('./s3Helper');

// Multer config for product media (images, video, voice notes) - Using Memory Storage for direct S3 upload
const storage = multer.memoryStorage();
const upload = multer({ 
    storage, 
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB max limit for product videos
});

const uploadMedia = upload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'video', maxCount: 1 },
    { name: 'voice_note', maxCount: 1 }
]);

// GET all products
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM products ORDER BY created_at DESC');
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Failed to fetch products:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch products' });
    }
});

// GET single product
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ success: false, error: 'Product not found' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('Failed to fetch product:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch product' });
    }
});

// Helper function to build main_image_url and extra_image_urls from image_order and uploaded files
const processImageOrdering = async (req) => {
    const files = req.files || {};
    const imageFiles = files['images'] || [];
    let imageOrder = [];

    if (req.body.image_order) {
        try {
            imageOrder = JSON.parse(req.body.image_order);
        } catch (e) { /* ignore parse error */ }
    }

    const finalUrls = [];
    if (Array.isArray(imageOrder) && imageOrder.length > 0) {
        for (const item of imageOrder) {
            if (item.type === 'existing' && item.url) {
                finalUrls.push(item.url);
            } else if (item.type === 'new' && typeof item.index === 'number' && imageFiles[item.index]) {
                const s3Url = await uploadToOracleS3(imageFiles[item.index]);
                if (s3Url) finalUrls.push(s3Url);
            }
        }
    } else {
        // Fallback if image_order not provided: use newly uploaded files
        for (const f of imageFiles) {
            const s3Url = await uploadToOracleS3(f);
            if (s3Url) finalUrls.push(s3Url);
        }
    }

    const mainImageUrl = finalUrls.length > 0 ? finalUrls[0] : null;
    const extraImageUrls = finalUrls.length > 1 ? JSON.stringify(finalUrls.slice(1)) : JSON.stringify([]);

    return { mainImageUrl, extraImageUrls };
};

// POST create product (with images, video, and voice note uploads)
router.post('/', uploadMedia, async (req, res) => {
    try {
        const { title, brand, gender, color, size_original, starting_price, minimum_price, description } = req.body;
        
        // 1. Insert Skeleton Record Immediately
        const [result] = await db.execute(`
            INSERT INTO products (title, brand, gender, color, size_original, starting_price, minimum_price, description, source, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'uploading')
        `, [
            title || 'Untitled Product',
            brand || null,
            gender || 'unisex',
            color || null,
            size_original || null,
            parseFloat(starting_price) || 0,
            parseFloat(minimum_price) || 0,
            description || null
        ]);

        const productId = result.insertId;

        // 2. Return Success Immediately (Frontend XHR completes)
        res.json({ success: true, id: productId, message: 'Product created and uploading in background' });

        // 3. Process Uploads in Background (Node -> Oracle S3)
        (async () => {
            try {
                const files = req.files || {};
                const videoFiles = files['video'] || [];
                const voiceFiles = files['voice_note'] || [];

                const { mainImageUrl, extraImageUrls } = await processImageOrdering(req);
                const videoUrl = videoFiles.length > 0 ? await uploadToOracleS3(videoFiles[0]) : null;
                const voiceNoteUrl = voiceFiles.length > 0 ? await uploadToOracleS3(voiceFiles[0]) : null;

                await db.execute(`
                    UPDATE products SET main_image_url = ?, extra_image_urls = ?, video_url = ?, voice_note_url = ?, status = 'available'
                    WHERE id = ?
                `, [mainImageUrl, extraImageUrls, videoUrl, voiceNoteUrl, productId]);

            } catch (bgErr) {
                console.error('Background upload failed for product', productId, bgErr);
            }
        })();

    } catch (err) {
        console.error('Failed to create product:', err);
        res.status(500).json({ success: false, error: 'Failed to create product' });
    }
});

// PUT update product
router.put('/:id', uploadMedia, async (req, res) => {
    try {
        const productId = req.params.id;
        const { title, brand, gender, color, size_original, starting_price, minimum_price, status } = req.body;
        
        const finalStatus = status || 'available';
        const initialStatus = (req.files && Object.keys(req.files).length > 0) ? 'uploading' : finalStatus;

        // 1. Update text fields and set status
        await db.execute(`
            UPDATE products SET 
                title = ?, brand = ?, gender = ?, color = ?, size_original = ?,
                starting_price = ?, minimum_price = ?, status = ?
            WHERE id = ?
        `, [
            title, brand || null, gender || 'unisex', color || null, size_original || null,
            parseFloat(starting_price) || 0, parseFloat(minimum_price) || 0, initialStatus, productId
        ]);

        res.json({ success: true, message: 'Product text updated, media uploading in background' });

        // 2. Process Uploads in Background
        (async () => {
            try {
                const files = req.files || {};
                const videoFiles = files['video'] || [];
                const voiceFiles = files['voice_note'] || [];

                let updateQuery = `UPDATE products SET status = ?`;
                let params = [finalStatus];

                if (req.body.image_order || (files['images'] && files['images'].length > 0)) {
                    const { mainImageUrl, extraImageUrls } = await processImageOrdering(req);
                    updateQuery += `, main_image_url = ?, extra_image_urls = ?`;
                    params.push(mainImageUrl, extraImageUrls);
                }

                if (videoFiles.length > 0) {
                    updateQuery += `, video_url = ?`;
                    params.push(await uploadToOracleS3(videoFiles[0]));
                }

                if (voiceFiles.length > 0) {
                    updateQuery += `, voice_note_url = ?`;
                    params.push(await uploadToOracleS3(voiceFiles[0]));
                }

                updateQuery += ` WHERE id = ?`;
                params.push(productId);

                await db.execute(updateQuery, params);

            } catch (bgErr) {
                console.error('Background upload failed for product update', productId, bgErr);
            }
        })();

    } catch (err) {
        console.error('Failed to update product:', err);
        res.status(500).json({ success: false, error: 'Failed to update product' });
    }
});

// DELETE product
router.delete('/:id', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT main_image_url, extra_image_urls, video_url, voice_note_url FROM products WHERE id = ?', [req.params.id]);
        if (rows.length > 0) {
            const product = rows[0];
            const { deleteFromOracleS3 } = require('./s3Helper');
            await deleteFromOracleS3(product.main_image_url);
            await deleteFromOracleS3(product.video_url);
            await deleteFromOracleS3(product.voice_note_url);

            if (product.extra_image_urls) {
                try {
                    const extras = JSON.parse(product.extra_image_urls);
                    for (const extra of extras) {
                        await deleteFromOracleS3(extra);
                    }
                } catch (e) { /* ignore parse errors */ }
            }
        }

        await db.execute('DELETE FROM products WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (err) {
        console.error('Failed to delete product:', err);
        res.status(500).json({ success: false, error: 'Failed to delete product' });
    }
});

module.exports = router;
