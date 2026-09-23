const express = require('express');
const router = express.Router();
const agent = require('./agent');

// GET verify webhook
router.get('/', async (req, res) => {
    const db = require('../../db');
    let verify_token = process.env.META_VERIFY_TOKEN;
    
    try {
        const [rows] = await db.execute('SELECT meta_verify_token FROM api_settings WHERE id = 1');
        if (rows.length > 0 && rows[0].meta_verify_token) {
            verify_token = rows[0].meta_verify_token;
        }
    } catch (err) {
        console.error('Failed to fetch Verify Token from DB:', err);
    }

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === verify_token) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            console.log('Webhook verification failed. Expected:', verify_token, 'Got:', token);
            res.sendStatus(403);
        }
    } else {
        res.status(400).send('Invalid request');
    }
});

// POST receive message
router.post('/', async (req, res) => {
    const body = req.body;
    console.log('Received WhatsApp Webhook:', JSON.stringify(body, null, 2));

    // Basic WhatsApp Webhook parsing
    if (body.object === 'whatsapp_business_account') {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const messages = value?.messages;

        if (messages && messages.length > 0) {
            const message = messages[0];
            const phone = message.from;
            const incomingText = message.text?.body || '';

            // Fetch or create conversation
            const db = require('../../db');
            let conversationId;
            try {
                const [rows] = await db.execute('SELECT id, status FROM conversations WHERE customer_phone = ?', [phone]);
                if (rows.length > 0) {
                    conversationId = rows[0].id;
                } else {
                    const [insertResult] = await db.execute('INSERT INTO conversations (customer_phone, status) VALUES (?, ?)', [phone, 'agent_active']);
                    conversationId = insertResult.insertId;
                }

                // Save incoming message
                if (incomingText) {
                    await db.execute(
                        'INSERT INTO messages (conversation_id, sender, type, text_content) VALUES (?, ?, ?, ?)',
                        [conversationId, 'customer', 'text', incomingText]
                    );
                }
            } catch (err) {
                console.error('Database error in WhatsApp webhook:', err);
            }

            const dbContext = { conversationId }; 

            // Fire and forget agent processing (delay handled inside)
            agent.processMessage(phone, incomingText, dbContext);
        }
    }

    res.sendStatus(200);
});

module.exports = router;
