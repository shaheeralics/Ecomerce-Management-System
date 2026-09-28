const express = require('express');
const router = express.Router();
const db = require('../../db');
const agent = require('../whatsapp/agent');
const fs = require('fs');
const path = require('path');

router.post('/', async (req, res) => {
    const body = req.body;
    console.log('Received Lovable Webhook:', JSON.stringify(body, null, 2));

    const { conversationId, customerPhone, customerName, messageType, content, mediaUrl, mediaBase64, mediaMimeType } = body;

    if (!customerPhone) {
        return res.status(400).json({ error: 'Missing customerPhone' });
    }

    try {
        let dbConversationId = conversationId;

        let convStatus = 'agent_active';
        if (!dbConversationId) {
            const [rows] = await db.execute('SELECT id, customer_name, status FROM conversations WHERE customer_phone = ?', [customerPhone]);
            if (rows.length > 0) {
                dbConversationId = rows[0].id;
                convStatus = rows[0].status || 'agent_active';
                // Update customer_name from WhatsApp profile if we don't have it yet
                if (customerName && !rows[0].customer_name) {
                    await db.execute('UPDATE conversations SET customer_name = ? WHERE id = ?', [customerName, dbConversationId]);
                }
            } else {
                const [insertResult] = await db.execute('INSERT INTO conversations (customer_phone, customer_name, status) VALUES (?, ?, ?)', [customerPhone, customerName || null, 'agent_active']);
                dbConversationId = insertResult.insertId;
            }
        } else {
            const [rows] = await db.execute('SELECT status FROM conversations WHERE id = ?', [dbConversationId]);
            if (rows.length > 0) {
                convStatus = rows[0].status || 'agent_active';
            }
        }

        let finalMediaUrl = mediaUrl || null;
        let savedFilePath = null;

        // Decode and save base64 media if provided
        if (mediaBase64) {
            try {
                // If the mime type is JSON, it means Lovable forwarded an error response from the gateway instead of audio
                if (mediaMimeType && mediaMimeType.includes('json')) {
                    const decodedError = Buffer.from(mediaBase64, 'base64').toString('utf8');
                    console.error('Lovable forwarded a JSON error instead of media:', decodedError);
                    content = `[Error from Lovable Gateway]: ${decodedError}`;
                } else {
                    const ext = mediaMimeType ? mediaMimeType.split('/')[1].split(';')[0] : (messageType === 'audio' ? 'ogg' : 'jpg');
                    const filename = `media_${Date.now()}.${ext}`;
                    const uploadsDir = path.join(__dirname, '../../uploads'); // backend/uploads
                    if (!fs.existsSync(uploadsDir)) {
                        fs.mkdirSync(uploadsDir, { recursive: true });
                    }
                    const filepath = path.join(uploadsDir, filename);
                    fs.writeFileSync(filepath, Buffer.from(mediaBase64, 'base64'));
                    finalMediaUrl = `/uploads/${filename}`;
                    savedFilePath = filepath;
                }
            } catch (err) {
                console.error('Error saving base64 media:', err);
            }
        }

        // Save incoming message
        let dbMessageId = null;
        if (content || finalMediaUrl) {
            const [insertMsg] = await db.execute(
                'INSERT INTO messages (conversation_id, sender, type, text_content, media_url) VALUES (?, ?, ?, ?, ?)',
                [dbConversationId, 'customer', messageType || 'text', content || '', finalMediaUrl]
            );
            dbMessageId = insertMsg.insertId;
        }

        const dbContext = { conversationId: dbConversationId }; 

        // Return immediately to prevent Lovable Gateway timeouts and duplicate retries
        res.json({ success: true, message: 'Message received and processing started' });

        // Fire and forget asynchronous processing
        (async () => {
            let transcribedText = content || '';
            
            // Only attempt STT if it's audio and NOT a JSON error message
            if (messageType === 'audio' && savedFilePath && !(mediaMimeType && mediaMimeType.includes('json'))) {
                try {
                    const [settingsRows] = await db.execute('SELECT llm_api_key FROM api_settings WHERE id = 1');
                    const openaiKey = process.env.OPENAI_API_KEY || settingsRows[0]?.llm_api_key || process.env.LLM_API_KEY;

                    if (openaiKey && fs.existsSync(savedFilePath)) {
                        const { OpenAI } = require('openai');
                        const openai = new OpenAI({ apiKey: openaiKey });
                        
                        const transcription = await openai.audio.transcriptions.create({
                            file: fs.createReadStream(savedFilePath),
                            model: 'whisper-1',
                            prompt: 'Transcribe accurately in Roman Urdu or English.'
                        });
                        
                        const rawTranscription = transcription.text.trim();
                        transcribedText = `[Voice Message Transcribed]: ${rawTranscription}`;
                        console.log(`Transcribed voice message from ${customerPhone}: ${transcribedText}`);
                        
                        if (dbMessageId) {
                            await db.execute('UPDATE messages SET text_content = ? WHERE id = ?', [transcribedText, dbMessageId]);
                        }
                    } else {
                        console.error('OpenAI API Key missing for Whisper STT');
                        if (dbMessageId) await db.execute('UPDATE messages SET text_content = ? WHERE id = ?', ['[STT Error]: OpenAI Config missing', dbMessageId]);
                    }
                } catch (sttErr) {
                    console.error('Failed to transcribe audio message:', sttErr);
                    const errorStr = sttErr ? sttErr.toString() : 'Unknown STT Error';
                    if (dbMessageId) {
                        await db.execute('UPDATE messages SET text_content = ? WHERE id = ?', [`[STT Error]: ${errorStr}`, dbMessageId]);
                    }
                }
            }

            // Only trigger AI Agent if conversation is NOT taken over by human or closed!
            if (convStatus === 'human_takeover' || convStatus === 'closed') {
                console.log(`[Lovable Webhook] Conversation ${dbConversationId} is in '${convStatus}'. Skipping AI Agent.`);
            } else {
                // Fire and forget agent processing
                agent.processMessage(customerPhone, transcribedText, dbContext);
            }
        })();
    } catch (err) {
        console.error('Error in Lovable webhook:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
