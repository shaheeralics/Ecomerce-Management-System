const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../../db');

// Multer config for product media (images, video, voice notes)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../uploads/products');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.webm';
        cb(null, `prod_${file.fieldname}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`);
    }
});
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
const processImageOrdering = (req) => {
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
        imageOrder.forEach(item => {
            if (item.type === 'existing' && item.url) {
                finalUrls.push(item.url);
            } else if (item.type === 'new' && typeof item.index === 'number' && imageFiles[item.index]) {
                finalUrls.push(`/uploads/products/${imageFiles[item.index].filename}`);
            }
        });
    } else {
        // Fallback if image_order not provided: use newly uploaded files
        imageFiles.forEach(f => finalUrls.push(`/uploads/products/${f.filename}`));
    }

    const mainImageUrl = finalUrls.length > 0 ? finalUrls[0] : null;
    const extraImageUrls = finalUrls.length > 1 ? JSON.stringify(finalUrls.slice(1)) : JSON.stringify([]);

    return { mainImageUrl, extraImageUrls };
};

// POST create product (with images, video, and voice note uploads)
router.post('/', uploadMedia, async (req, res) => {
    try {
        const { title, brand, gender, color, size_original, starting_price, minimum_price, description } = req.body;
        const files = req.files || {};
        const videoFiles = files['video'] || [];
        const voiceFiles = files['voice_note'] || [];

        const { mainImageUrl, extraImageUrls } = processImageOrdering(req);
        const videoUrl = videoFiles.length > 0 ? `/uploads/products/${videoFiles[0].filename}` : null;
        const voiceNoteUrl = voiceFiles.length > 0 ? `/uploads/products/${voiceFiles[0].filename}` : null;

        const [result] = await db.execute(`
            INSERT INTO products (title, brand, gender, color, size_original, starting_price, minimum_price, description, source, main_image_url, extra_image_urls, video_url, voice_note_url, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, 'available')
        `, [
            title || 'Untitled Product',
            brand || null,
            gender || 'unisex',
            color || null,
            size_original || null,
            parseFloat(starting_price) || 0,
            parseFloat(minimum_price) || 0,
            description || null,
            mainImageUrl,
            extraImageUrls,
            videoUrl,
            voiceNoteUrl
        ]);

        res.json({ success: true, id: result.insertId, message: 'Product created successfully' });
    } catch (err) {
        console.error('Failed to create product:', err);
        res.status(500).json({ success: false, error: 'Failed to create product' });
    }
});

// PUT update product
router.put('/:id', uploadMedia, async (req, res) => {
    try {
        const { title, brand, gender, color, size_original, starting_price, minimum_price, description, status } = req.body;
        const files = req.files || {};
        const videoFiles = files['video'] || [];
        const voiceFiles = files['voice_note'] || [];

        let updateQuery = `
            UPDATE products SET 
                title = ?, brand = ?, gender = ?, color = ?, size_original = ?,
                starting_price = ?, minimum_price = ?, description = ?, status = ?
        `;
        let params = [
            title, brand || null, gender || 'unisex', color || null, size_original || null,
            parseFloat(starting_price) || 0, parseFloat(minimum_price) || 0, description || null, status || 'available'
        ];

        // Process images order if provided or if new images uploaded
        if (req.body.image_order || (files['images'] && files['images'].length > 0)) {
            const { mainImageUrl, extraImageUrls } = processImageOrdering(req);
            updateQuery += `, main_image_url = ?, extra_image_urls = ?`;
            params.push(mainImageUrl, extraImageUrls);
        }

        // Update video if provided
        if (videoFiles.length > 0) {
            updateQuery += `, video_url = ?`;
            params.push(`/uploads/products/${videoFiles[0].filename}`);
        }

        // Update voice note if provided
        if (voiceFiles.length > 0) {
            updateQuery += `, voice_note_url = ?`;
            params.push(`/uploads/products/${voiceFiles[0].filename}`);
        }

        updateQuery += ` WHERE id = ?`;
        params.push(req.params.id);

        await db.execute(updateQuery, params);
        res.json({ success: true, message: 'Product updated successfully' });
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
            const deleteFile = (relPath) => {
                if (!relPath) return;
                const filePath = path.join(__dirname, '../../', relPath);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            };

            deleteFile(product.main_image_url);
            deleteFile(product.video_url);
            deleteFile(product.voice_note_url);

            if (product.extra_image_urls) {
                try {
                    const extras = JSON.parse(product.extra_image_urls);
                    extras.forEach(deleteFile);
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
