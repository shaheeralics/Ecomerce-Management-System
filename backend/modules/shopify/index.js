const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const services = require('./services');

router.post('/', upload.array('photos'), async (req, res) => {
    try {
        const { brand, rough_description, gender, size_original, starting_price, minimum_price, labels } = req.body;
        const files = req.files || [];

        // labels could be a JSON string or array depending on frontend submission
        const parsedLabels = typeof labels === 'string' ? JSON.parse(labels) : labels;

        // 1. Sizing Service
        const sizeInfo = services.getSizeMapping(size_original);

        // 2 & 3. Description & Title generation concurrently
        const [draftDesc, rawTitle] = await Promise.all([
            services.draftDescription(rough_description),
            services.draftTitle(brand, rough_description)
        ]);

        // 4. TM Injection (deterministic)
        const finalTitle = services.injectTmToBrand(rawTitle, brand);

        // 5. Image Sorting
        const sortedImages = services.sortImagesByLabel(files, parsedLabels || []);

        // 6. Shopify Publish
        const shopifyResult = await services.publishToShopify({
            title: finalTitle,
            description: draftDesc,
            images: sortedImages,
            sizes: sizeInfo,
            price: starting_price
        });

        // 7. DB Write
        const db = require('../../db');
        
        // Handle images
        const mainImage = sortedImages && sortedImages.length > 0 ? sortedImages[0].url : null;
        const extraImages = sortedImages && sortedImages.length > 1 ? JSON.stringify(sortedImages.slice(1).map(img => img.url)) : JSON.stringify([]);

        const [dbResult] = await db.execute(`
            INSERT INTO products 
            (title, brand, gender, size_original, starting_price, minimum_price, source, shopify_product_id, main_image_url, extra_image_urls)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            finalTitle,
            brand || null,
            gender || 'unisex',
            size_original || null,
            starting_price || 0,
            minimum_price || 0,
            'shopify',
            shopifyResult.id ? shopifyResult.id.toString() : null,
            mainImage,
            extraImages
        ]);

        res.json({ success: true, product_id: shopifyResult.id, db_id: dbResult.insertId, message: 'Published to Shopify and saved to DB successfully.' });

    } catch (err) {
        console.error('Error processing listing:', err);
        res.status(500).json({ success: false, error: 'Failed to process listing' });
    }
});

module.exports = router;
