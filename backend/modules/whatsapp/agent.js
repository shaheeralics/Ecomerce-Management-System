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
        // 1. Fetch LLM API Key (Strictly OpenAI for WhatsApp Agent)
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error('OPENAI_API_KEY is missing in .env');
            await sendTextMessage(phone, "Hello! Our system is being configured (OpenAI Key missing). Please try again shortly.");
            return;
        }

        // 2. Fetch config from agent_config
        const [configRows] = await db.execute('SELECT * FROM agent_config WHERE id = 1');
        const config = configRows[0] || {};

        if (config.agent_enabled === 0 || config.agent_enabled === false) {
            console.log(`Agent is disabled. Ignoring message from ${phone}`);
            return;
        }



        const systemPrompt = config.system_prompt || 'You are a helpful e-commerce sales assistant for Pawanda.';
        const advanceAmount = config.advance_amount || 0;
        const delaySeconds = config.short_delay_seconds || 5;

        // 3. Fetch available products for context
        const availableProducts = await tools.searchAvailableProducts();
        const productContext = availableProducts.length > 0
            ? availableProducts.map(p => `- ID:${p.id} | ${p.title} | ${p.brand || 'N/A'} | ${p.gender} | Size:${p.size_original || 'N/A'} | Color:${p.color || 'N/A'} | Price: Rs ${p.starting_price}`).join('\n')
            : 'No products currently available.';

        // 4. Fetch conversation history for context
        let conversationHistory = '';
        if (dbContext?.conversationId) {
            const [msgRows] = await db.execute(
                'SELECT sender, text_content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 10',
                [dbContext.conversationId]
            );
            conversationHistory = msgRows.reverse().map(m => `${m.sender === 'customer' ? 'Customer' : 'You'}: ${m.text_content}`).join('\n');
        }

        // 5. Build full prompt
        const openai = new OpenAI({ apiKey });
        const systemMessage = {
            role: 'system',
            content: `${systemPrompt}

AVAILABLE PRODUCTS:
${productContext}

IMPORTANT RULES:
- NEVER reveal the minimum_price to the customer
- If customer asks for a lower price, negotiate but stay above minimum
- Be friendly and helpful in Urdu/English mixed style
- Keep responses concise (max 2-3 sentences)
- If customer wants to see a product image, mention you can show it
- Advance payment required for orders: Rs ${advanceAmount}
- If you don't know the customer's name, politely ask for their name early in the conversation and use the save_customer_info tool to save it.

CONVERSATION SO FAR:
${conversationHistory}`
        };

        const userMessage = {
            role: 'user',
            content: incomingText
        };

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [systemMessage, userMessage],
            tools: tools.getAgentTools(),
            tool_choice: 'auto'
        });

        let replyText = response.choices[0].message.content || '';
        const toolCalls = response.choices[0].message.tool_calls;

        if (toolCalls && toolCalls.length > 0) {
            for (const toolCall of toolCalls) {
                const args = JSON.parse(toolCall.function.arguments);
                if (toolCall.function.name === 'save_customer_info') {
                    await tools.saveCustomerInfo(phone, args.name, args.address);
                }
            }
            
            // If the AI only called a tool and returned no text, we might want to generate a follow up text,
            // but for simplicity, let's just make sure we send a friendly acknowledgment if replyText is empty.
            if (!replyText) {
                replyText = "Thanks for the info! How can I help you further today?";
            }
        }

        // Guardrail check
        if (!guardrailCheck(replyText)) {
            replyText = "Let me check on that and get back to you.";
        }

        // Apply delay
        if (delaySeconds > 0) {
            await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
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
