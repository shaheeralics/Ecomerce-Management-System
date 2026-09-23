const express = require('express');
const router = express.Router();
const db = require('../../db');

// Get API settings from DB
router.get('/settings', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM api_settings WHERE id = 1');
        if (rows.length > 0) {
            res.json({
                metaToken: rows[0].meta_token || '',
                metaPhoneId: rows[0].meta_phone_id || '',
                metaWabaId: rows[0].meta_waba_id || '',
                metaAppId: rows[0].meta_app_id || '',
                metaAppSecret: rows[0].meta_app_secret || '',
                metaVerifyToken: rows[0].meta_verify_token || '',
                llmApiKey: rows[0].llm_api_key || '',
                shopifyUrl: rows[0].shopify_url || '',
                shopifyToken: rows[0].shopify_token || '',
                shopifyWebhookSecret: rows[0].shopify_webhook_secret || '',
                webhookUrl: rows[0].webhook_url || ''
            });
        } else {
            res.json({});
        }
    } catch (e) {
        res.status(500).json({ error: 'Database connection failed' });
    }
});

// Save API settings to DB
router.post('/settings', async (req, res) => {
    const data = req.body;
    console.log("Received data for settings:", data);
    try {
        // Upsert data
        await db.execute(`
            INSERT INTO api_settings (id, meta_token, meta_phone_id, meta_waba_id, meta_app_id, meta_app_secret, meta_verify_token, llm_api_key, shopify_url, shopify_token, shopify_webhook_secret, webhook_url) 
            VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                meta_token = VALUES(meta_token),
                meta_phone_id = VALUES(meta_phone_id),
                meta_waba_id = VALUES(meta_waba_id),
                meta_app_id = VALUES(meta_app_id),
                meta_app_secret = VALUES(meta_app_secret),
                meta_verify_token = VALUES(meta_verify_token),
                llm_api_key = VALUES(llm_api_key),
                shopify_url = VALUES(shopify_url),
                shopify_token = VALUES(shopify_token),
                shopify_webhook_secret = VALUES(shopify_webhook_secret),
                webhook_url = VALUES(webhook_url)
        `, [
            data.metaToken || '', 
            data.metaPhoneId || '', 
            data.metaWabaId || '', 
            data.metaAppId || '', 
            data.metaAppSecret || '', 
            data.metaVerifyToken || '', 
            data.llmApiKey || '', 
            data.shopifyUrl || '', 
            data.shopifyToken || '', 
            data.shopifyWebhookSecret || '',
            data.webhookUrl || ''
        ]);

        res.status(200).json({ message: 'Settings saved to MySQL database' });
    } catch (e) {
        console.error("Database Error:", e);
        res.status(500).json({ error: 'Failed to write to database' });
    }
});

// Get all products
router.get('/products', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM products ORDER BY created_at DESC');
        res.json({ data: rows });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Get all conversations
router.get('/conversations', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM conversations ORDER BY updated_at DESC');
        res.json({ data: rows });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

// Get agent config
router.get('/agent-config', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM agent_config WHERE id = 1');
        if (rows.length > 0) {
            res.json({ success: true, data: rows[0] });
        } else {
            res.json({ success: true, data: { system_prompt: '' } });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: 'Failed to fetch agent config' });
    }
});

// Save agent config
router.post('/agent-config', async (req, res) => {
    try {
        const { system_prompt } = req.body;
        await db.execute(`
            INSERT INTO agent_config (id, system_prompt) VALUES (1, ?)
            ON DUPLICATE KEY UPDATE system_prompt = VALUES(system_prompt)
        `, [system_prompt || '']);
        res.json({ success: true, message: 'Agent config saved' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: 'Failed to save agent config' });
    }
});

module.exports = router;
