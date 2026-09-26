const { sendTextMessage, sendMediaMessage } = require('./metaApi');
const db = require('../../db');
const tools = require('./tools');
const { OpenAI } = require('openai');

const guardrailCheck = (text) => {
    const forbiddenPhrases = ['minimum_price', 'lowest I can go', 'cost price', 'minimum price'];
    for (const phrase of forbiddenPhrases) {
        if (text.toLowerCase().includes(phrase)) {
            return false;
        }
    }
    return true;
};

const processMessage = async (phone, incomingText, dbContext) => {
    console.log(`Processing message from ${phone}: ${incomingText}`);

    try {
        // 1. Fetch LLM API Key
        const [settingsRows] = await db.execute('SELECT llm_api_key FROM api_settings WHERE id = 1');
        const apiKey = settingsRows[0]?.llm_api_key || process.env.LLM_API_KEY;
        if (!apiKey) {
            await sendTextMessage(phone, "Hello! Our system is being configured. Please try again shortly.");
            return;
        }

        // 2. Fetch system prompt from agent_config
        const [configRows] = await db.execute('SELECT system_prompt FROM agent_config WHERE id = 1');
        const systemPrompt = configRows[0]?.system_prompt || 'You are a helpful e-commerce sales assistant for Pawanda.';

        // 3. Fetch available products for context
        const availableProducts = await tools.searchAvailableProducts();
        const productContext = availableProducts.length > 0
            ? availableProducts.map(p => `- ID:${p.id} | ${p.title} | ${p.brand || 'N/A'} | ${p.gender} | Size:${p.size_original || 'N/A'} | Color:${p.color || 'N/A'} | Price: Rs ${p.starting_price}`).join('\n')
            : 'No products currently available.';

        // 4. History + Build Prompt
        const openai = new OpenAI({ apiKey });
        
        const systemMessage = `${systemPrompt}

AVAILABLE PRODUCTS:
${productContext}

IMPORTANT RULES:
- NEVER reveal the minimum_price to the customer
- If customer asks for a lower price, negotiate but stay above minimum
- Be friendly and helpful in Urdu/English mixed style
- Keep responses concise (max 2-3 sentences)
- If customer wants to see a product image, mention you can show it`;

        const messages = [{ role: 'system', content: systemMessage }];

        if (dbContext?.conversationId) {
            const [msgRows] = await db.execute(
                'SELECT sender, text_content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 10',
                [dbContext.conversationId]
            );
            const history = msgRows.reverse().map(m => ({
                role: m.sender === 'customer' ? 'user' : 'assistant',
                content: m.text_content || ''
            }));
            messages.push(...history);
        }

        messages.push({ role: 'user', content: incomingText });

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: messages,
        });

        let replyText = response.choices[0].message.content;

        // Guardrail check
        if (!guardrailCheck(replyText)) {
            replyText = "Let me check on that and get back to you.";
        }

        await sendTextMessage(phone, replyText);
        console.log(`Sent AI reply to ${phone}: ${replyText.substring(0, 50)}...`);

        // Save outgoing message to DB
        if (dbContext?.conversationId) {
            try {
                await db.execute(
                    'INSERT INTO messages (conversation_id, sender, type, text_content) VALUES (?, ?, ?, ?)',
                    [dbContext.conversationId, 'agent', 'text', replyText]
                );
            } catch (dbErr) {
                console.error('Failed to save agent message to DB:', dbErr);
            }
        }
    } catch (err) {
        console.error('Error in AI processing:', err);
        await sendTextMessage(phone, "Sorry, I'm having a brief issue. Please try again in a moment.");
    }
};

module.exports = {
    processMessage
};
