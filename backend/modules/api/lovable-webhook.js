const express = require('express');
const router = express.Router();
const db = require('../../db');
const agent = require('../whatsapp/agent');

router.post('/', async (req, res) => {
    const body = req.body;
    console.log('Received Lovable Webhook:', JSON.stringify(body, null, 2));

    const { conversationId, customerPhone, messageType, content, mediaUrl } = body;

    if (!customerPhone) {
        return res.status(400).json({ error: 'Missing customerPhone' });
    }

    try {
        let dbConversationId = conversationId;

        if (!dbConversationId) {
            const [rows] = await db.execute('SELECT id FROM conversations WHERE customer_phone = ?', [customerPhone]);
            if (rows.length > 0) {
                dbConversationId = rows[0].id;
            } else {
                const [insertResult] = await db.execute('INSERT INTO conversations (customer_phone, status) VALUES (?, ?)', [customerPhone, 'agent_active']);
                dbConversationId = insertResult.insertId;
            }
        }

        // Save incoming message
        if (content || mediaUrl) {
            await db.execute(
                'INSERT INTO messages (conversation_id, sender, type, text_content, media_url) VALUES (?, ?, ?, ?, ?)',
                [dbConversationId, 'customer', messageType || 'text', content || '', mediaUrl || null]
            );
        }

        const dbContext = { conversationId: dbConversationId }; 

        // Fire and forget agent processing
        agent.processMessage(customerPhone, content || '', dbContext);

        res.json({ success: true, message: 'Message received and processing started' });
    } catch (err) {
        console.error('Error in Lovable webhook:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
