const express = require('express');
const router = express.Router();
const db = require('../../db');

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

// Get messages for a specific conversation
router.get('/conversations/:id/messages', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', [req.params.id]);
        res.json({ data: rows });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Update conversation status (e.g., Takeover Chat)
router.put('/conversations/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        await db.execute('UPDATE conversations SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to update conversation status' });
    }
});

// Send manual reply (human takeover)
router.post('/conversations/:id/reply', async (req, res) => {
    try {
        const { type, content, mediaUrl } = req.body;
        const [convRows] = await db.execute('SELECT customer_phone FROM conversations WHERE id = ?', [req.params.id]);
        if (convRows.length === 0) return res.status(404).json({ error: 'Conversation not found' });
        
        const phone = convRows[0].customer_phone;
        const metaApi = require('../whatsapp/metaApi');
        
        // Save to DB
        await db.execute(
            'INSERT INTO messages (conversation_id, sender, type, text_content, media_url) VALUES (?, ?, ?, ?, ?)',
            [req.params.id, 'human', type, content || null, mediaUrl || null]
        );
        
        // Send to WhatsApp
        if (type === 'text') {
            await metaApi.sendTextMessage(phone, content);
        } else {
            await metaApi.sendMediaMessage(phone, type, mediaUrl, content);
        }
        
        // Ensure status is human_takeover
        await db.execute('UPDATE conversations SET status = "human_takeover" WHERE id = ?', [req.params.id]);
        
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to send reply' });
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

const voiceRoutes = require('./voices');
const orderRoutes = require('./orders');
const analyticsRoutes = require('./analytics');
const dbProxyRoutes = require('./db-proxy');
const lovableWebhookRoutes = require('./lovable-webhook');

// Mount routes
router.use('/voices', voiceRoutes);
router.use('/orders', orderRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/db-proxy', dbProxyRoutes);
router.use('/lovable-webhook', lovableWebhookRoutes);

module.exports = router;
