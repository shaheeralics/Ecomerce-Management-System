const express = require('express');
const router = express.Router();
const db = require('../../db');
const agent = require('../whatsapp/agent');
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

router.post('/', async (req, res) => {
    const body = req.body;
    console.log('Received Lovable Webhook:', JSON.stringify(body, null, 2));

    const { conversationId, customerPhone, messageType, content, mediaUrl, mediaBase64, mediaMimeType } = body;

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

        let finalMediaUrl = mediaUrl || null;

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
            if (messageType === 'audio' && (mediaUrl || mediaBase64) && !(mediaMimeType && mediaMimeType.includes('json'))) {
                try {
                    let base64Data = mediaBase64;
                    let mimeType = mediaMimeType || 'audio/ogg';

                    if (!base64Data && mediaUrl) {
                        const fetchRes = await fetch(mediaUrl);
                        if (fetchRes.ok) {
                            const arrayBuffer = await fetchRes.arrayBuffer();
                            base64Data = Buffer.from(arrayBuffer).toString('base64');
                            mimeType = fetchRes.headers.get('content-type') || mimeType;
                        }
                    }

                    if (base64Data) {
                        // Strip data URI prefix if it exists
                        if (base64Data.includes('base64,')) {
                            base64Data = base64Data.split('base64,')[1];
                        }

                        const [settingsRows] = await db.execute('SELECT llm_api_key, gemini_api_key FROM api_settings WHERE id = 1');
                        
                        let geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API || settingsRows[0]?.gemini_api_key;
                        if (!geminiKey) {
                            const fallback = settingsRows[0]?.llm_api_key || process.env.LLM_API_KEY;
                            if (fallback && !fallback.startsWith('sk-')) {
                                geminiKey = fallback;
                            }
                        }

                        if (geminiKey) {
                            const ai = new GoogleGenAI({ apiKey: geminiKey });
                            const response = await ai.models.generateContent({
                                model: 'gemini-3.8-flash',
                                contents: [
                                    {
                                        role: 'user',
                                        parts: [
                                            {
                                                inlineData: {
                                                    data: base64Data,
                                                    mimeType: mimeType
                                                }
                                            },
                                            {
                                                text: "You are an expert transcriptionist. Please transcribe exactly what is being said in this audio message from a customer. Do not add any conversational filler, markdown formatting, or introductory text. If the audio is in Urdu/Hindi, transcribe it accurately using roman script (Roman Urdu) or english based on the context. Only output the transcription text."
                                            }
                                        ]
                                    }
                                ]
                            });
                            const rawTranscription = response.text.trim();
                            transcribedText = `[Voice Message Transcribed]: ${rawTranscription}`;
                            console.log(`Transcribed voice message from ${customerPhone}: ${transcribedText}`);
                            
                            // Update the database with the transcription so the UI sees it
                            if (dbMessageId) {
                                await db.execute('UPDATE messages SET text_content = ? WHERE id = ?', [transcribedText, dbMessageId]);
                            }
                        } else {
                            console.error('Gemini API Key missing for STT');
                            if (dbMessageId) await db.execute('UPDATE messages SET text_content = ? WHERE id = ?', ['[STT Error]: Gemini API Key missing', dbMessageId]);
                        }
                    }
                } catch (sttErr) {
                    console.error('Failed to transcribe audio message:', sttErr);
                    const errorStr = sttErr ? sttErr.toString() : 'Unknown STT Error';
                    if (dbMessageId) {
                        await db.execute('UPDATE messages SET text_content = ? WHERE id = ?', [`[STT Error]: ${errorStr}`, dbMessageId]);
                    }
                }
            }

            // Fire and forget agent processing
            agent.processMessage(customerPhone, transcribedText, dbContext);
        })();
    } catch (err) {
        console.error('Error in Lovable webhook:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
