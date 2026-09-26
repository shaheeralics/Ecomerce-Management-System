const express = require('express');
const router = express.Router();
const db = require('../../db');
const agent = require('../whatsapp/agent');
const { GoogleGenAI } = require('@google/genai');

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

        // Transcribe voice messages using Gemini
        let transcribedText = content || '';
        
        if (messageType === 'audio' && mediaUrl) {
            try {
                const fetchRes = await fetch(mediaUrl);
                if (fetchRes.ok) {
                    const arrayBuffer = await fetchRes.arrayBuffer();
                    const audioBuffer = Buffer.from(arrayBuffer);
                    const mimeType = fetchRes.headers.get('content-type') || 'audio/ogg';

                    const [settingsRows] = await db.execute('SELECT llm_api_key FROM api_settings WHERE id = 1');
                    const geminiKey = settingsRows[0]?.llm_api_key || process.env.LLM_API_KEY;

                    if (geminiKey) {
                        const ai = new GoogleGenAI({ apiKey: geminiKey });
                        const response = await ai.models.generateContent({
                            model: 'gemini-2.5-flash',
                            contents: [
                                {
                                    inlineData: {
                                        data: audioBuffer.toString("base64"),
                                        mimeType: mimeType
                                    }
                                },
                                "You are an expert transcriptionist. Please transcribe exactly what is being said in this audio message from a customer. Do not add any conversational filler, markdown formatting, or introductory text. If the audio is in Urdu/Hindi, transcribe it accurately using roman script (Roman Urdu) or english based on the context. Only output the transcription text."
                            ]
                        });
                        transcribedText = response.text.trim();
                        console.log(`Transcribed voice message from ${customerPhone}: ${transcribedText}`);
                    } else {
                        console.error('Gemini API Key missing for STT');
                    }
                }
            } catch (sttErr) {
                console.error('Failed to transcribe audio message:', sttErr);
            }
        }

        // Fire and forget agent processing
        agent.processMessage(customerPhone, transcribedText, dbContext);

        res.json({ success: true, message: 'Message received and processing started' });
    } catch (err) {
        console.error('Error in Lovable webhook:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
