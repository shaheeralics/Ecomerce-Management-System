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
