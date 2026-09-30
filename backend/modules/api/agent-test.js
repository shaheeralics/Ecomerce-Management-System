const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../../db');
const tools = require('../whatsapp/tools');
const { OpenAI } = require('openai');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const guardrailCheck = (text) => {
    const forbiddenPhrases = ['minimum_price', 'lowest I can go', 'cost price', 'minimum price'];
    for (const phrase of forbiddenPhrases) {
        if (text.toLowerCase().includes(phrase)) return false;
    }
    return true;
};

// Run agent logic for testing (no WhatsApp sending, returns replies directly)
async function runAgentTest(userMessage, history) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return { error: 'OPENAI_API_KEY is missing in .env' };
    }

    // Fetch config
    const [configRows] = await db.execute('SELECT * FROM agent_config WHERE id = 1');
    const config = configRows[0] || {};

    const systemPrompt = (config.system_prompt && config.system_prompt.trim())
        ? config.system_prompt.trim()
        : 'You are an elite, polite, and persuasive sales assistant for Pawanda Shoes on WhatsApp.';
    const advanceAmount = config.advance_amount || 0;

    const systemMessage = {
        role: 'system',
        content: `${systemPrompt}

=== PRODUCT CATALOG ACCESS (READ-ONLY) ===
You have read-only access strictly to the 'products' table via the 'query_product_catalog' tool.
Table: products
Columns:
- id (INT) - Unique Product ID
- title (VARCHAR) - Name of shoe
- brand (VARCHAR) - Brand name
- gender (VARCHAR) - Target audience ('men', 'women', 'kids', 'unisex')
- size_original (VARCHAR) - Shoe size (e.g. '43', '42 EU', '9 US')
- size (VARCHAR), size_uk, size_eu, size_cn
- color (VARCHAR) - Color
- starting_price (DECIMAL) - Selling price in PKR
- status (VARCHAR) - 'available' or 'sold'
- main_image_url, video_url, voice_note_url (VARCHAR)

Available tools:
1. query_product_catalog - Execute a read-only SELECT query strictly on the 'products' table.
2. send_product_media - Send product image, video, or voice note to the customer.

=== THINKING & ReAct RETRY PROTOCOL ===
You are an intelligent, thoughtful autonomous sales agent (like Claude / Antigravity). Do NOT act like a simple dumb bot. Follow this step-by-step thinking process before concluding or answering:

1. UNDERSTAND CUSTOMER INTENT:
   - If customer asks for items (e.g. "men ke shoes dikhao", "43 size mein kya hai?", "black sneakers"):
     Formulate an accurate SQL query to check what is in stock.
   - Note: If customer mentions a number like "43" or "42", that is a shoe size.

2. SEARCH & SELF-CORRECTION (DO NOT SURRENDER ON ZERO RESULTS):
   - When searching for 'men' or 'women', ALWAYS consider that products may be marked as 'unisex' (e.g. gender IN ('men', 'unisex') or gender LIKE '%men%' OR gender = 'unisex').
   - Use LIKE '%size%' for flexible size matching.
   - If your first query returns 0 results:
     DO NOT immediately tell the customer "nahi available"!
     Analyze WHY it might have failed:
     * Was the size format different? (Try size_original LIKE '%43%' or other size columns).
     * Was the gender filter too strict? (Try including 'unisex' or omitting gender).
     * Was the keyword too narrow? (Try searching by brand or just status='available').
     Execute a second broader query to see what else matches!

3. PROTECT THE SALE (NEVER SEND A CUSTOMER AWAY EMPTY-HANDED):
   - Under NO circumstance should you just say "Hamare paas nahi hai" and end the chat!
   - If the exact requested item or size is genuinely not available after checking, find 2-3 of the closest available alternatives and warmly suggest them.

4. PRODUCT IDS & MEDIA CONTINUITY:
   - Whenever you mention any product to the customer in text, ALWAYS clearly include its ID.
   - If the customer asks to "resend voice" or "send picture", look at the previous messages to identify WHICH product they are referring to, and call send_product_media with that ID.

5. COMMUNICATION STYLE:
   - Speak in natural, respectful, friendly Roman Urdu / English.
   - Keep messages short, crisp, and WhatsApp-friendly.
   - Advance payment required for orders: Rs ${advanceAmount}.`
    };

    const openai = new OpenAI({ apiKey });
    
    // Build messages
    const historyMessages = (history || []).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
    }));

    const messages = [
        systemMessage,
        ...historyMessages,
        { role: 'user', content: userMessage }
    ];

    const replies = [];
    let maxIterations = 5;

    for (let i = 0; i < maxIterations; i++) {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: messages,
            tools: tools.getAgentTools(),
            tool_choice: 'auto'
        });

        const assistantMessage = response.choices[0].message;
        messages.push(assistantMessage);

        const toolCalls = assistantMessage.tool_calls;

        if (!toolCalls || toolCalls.length === 0) {
            let replyText = assistantMessage.content || '';
            if (replyText) {
                if (!guardrailCheck(replyText)) {
                    replyText = "Let me check on that and get back to you.";
                }
                replies.push({ text: replyText });
            }
            break;
        }

        for (const toolCall of toolCalls) {
            const args = JSON.parse(toolCall.function.arguments);
            let toolResult = '';

            if (toolCall.function.name === 'query_product_catalog' || toolCall.function.name === 'query_database') {
                console.log(`[Agent Test] SQL: ${args.sql_query}`);
                const products = await tools.queryProductCatalog(args.sql_query);
                if (products.error) {
                    toolResult = `SQL ERROR: ${products.error}. Please revise your SELECT query syntax on the products table.`;
                } else if (!products || products.length === 0) {
                    toolResult = 'No products found for this query. Self-Correction Note: Do NOT immediately tell the customer it is unavailable! Check if the item could be marked unisex, try flexible size matching with LIKE, or query for the closest available alternatives.';
                } else {
                    toolResult = products.map(p => JSON.stringify(p)).join('\n');
                }
            } else if (toolCall.function.name === 'send_product_media') {
                const productMedia = await tools.getProductMedia(args.product_id);
                if (productMedia) {
                    let url = null;
                    let mediaType = 'image';

                    if (args.media_type === 'image') {
                        url = productMedia.main_image_url;
                        mediaType = 'image';
                    } else if (args.media_type === 'video') {
                        url = productMedia.video_url;
                        mediaType = 'video';
                    } else if (args.media_type === 'voice') {
                        url = productMedia.voice_note_url;
                        mediaType = 'audio';
                    }

                    if (url) {
                        const caption = args.caption || `${productMedia.title} | Size: ${productMedia.size_original || 'N/A'} | Rs ${productMedia.starting_price}`;
                        replies.push({
                            text: caption,
                            mediaType: mediaType,
                            mediaUrl: url
                        });
                        toolResult = `Successfully sent ${args.media_type} for product ${args.product_id} to customer.`;
                    } else {
                        toolResult = `No ${args.media_type} URL found for product ${args.product_id}.`;
                    }
                } else {
                    toolResult = `Product with ID ${args.product_id} not found.`;
                }
            } else if (toolCall.function.name === 'save_customer_info') {
                toolResult = JSON.stringify({ success: true, message: 'Customer info saved (test mode).' });
            }

            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: toolResult
            });
        }
    }

    return { success: true, replies };
}

// Helper: save a message to DB
async function saveTestMessage(role, content, mediaType, mediaUrl) {
    try {
        await db.execute(
            'INSERT INTO agent_test_messages (role, content, media_type, media_url) VALUES (?, ?, ?, ?)',
            [role, content || '', mediaType || null, mediaUrl || null]
        );
    } catch (e) {
        console.error('[Agent Test] Failed to save message:', e.message);
    }
}

// GET /api/agent-test/history - Load chat history
router.get('/history', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM agent_test_messages ORDER BY created_at ASC');
        res.json({ success: true, messages: rows });
    } catch (err) {
        console.error('[Agent Test History Error]:', err);
        res.status(500).json({ error: 'Failed to load chat history' });
    }
});

// DELETE /api/agent-test/history - Clear chat history
router.delete('/history', async (req, res) => {
    try {
        await db.execute('DELETE FROM agent_test_messages');
        res.json({ success: true });
    } catch (err) {
        console.error('[Agent Test Clear Error]:', err);
        res.status(500).json({ error: 'Failed to clear chat history' });
    }
});

// POST /api/agent-test - Text message test
router.post('/', async (req, res) => {
    try {
        const { message, history } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required.' });
        }

        // Save user message to DB
        await saveTestMessage('user', message.trim(), null, null);

        const result = await runAgentTest(message.trim(), history || []);

        // Save agent replies to DB
        if (result.success && result.replies) {
            for (const reply of result.replies) {
                await saveTestMessage('assistant', reply.text || '', reply.mediaType || null, reply.mediaUrl || null);
            }
        }

        res.json(result);
    } catch (err) {
        console.error('[Agent Test Error]:', err);
        res.status(500).json({ error: err.message || 'Agent processing failed' });
    }
});

// POST /api/agent-test/voice - Voice message test
router.post('/voice', upload.single('voice'), async (req, res) => {
    try {
        let history = [];
        try { history = JSON.parse(req.body.history || '[]'); } catch (e) { }

        const userMessage = '[Customer sent a voice message. Respond naturally as if you heard them greet you or ask about products.]';
        const apiKey = process.env.OPENAI_API_KEY;
        let transcribedText = userMessage;

        if (apiKey && req.file) {
            try {
                const openai = new OpenAI({ apiKey });
                const file = new File([req.file.buffer], 'voice.ogg', { type: req.file.mimetype || 'audio/ogg' });
                const transcription = await openai.audio.transcriptions.create({
                    model: 'whisper-1',
                    file: file
                });
                if (transcription.text && transcription.text.trim()) {
                    transcribedText = transcription.text.trim();
                }
            } catch (whisperErr) {
                console.error('[Whisper Transcription Error]:', whisperErr.message);
            }
        }

        // Save user voice message to DB
        await saveTestMessage('user', transcribedText, 'audio', null);

        const result = await runAgentTest(transcribedText, history);

        // Save agent replies to DB
        if (result.success && result.replies) {
            for (const reply of result.replies) {
                await saveTestMessage('assistant', reply.text || '', reply.mediaType || null, reply.mediaUrl || null);
            }
        }

        res.json(result);
    } catch (err) {
        console.error('[Agent Test Voice Error]:', err);
        res.status(500).json({ error: err.message || 'Voice processing failed' });
    }
});

module.exports = router;

