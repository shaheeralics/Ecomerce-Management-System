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

        // 3. Fetch conversation history for context (as proper OpenAI messages)
        let historyMessages = [];
        if (dbContext?.conversationId) {
            const [msgRows] = await db.execute(
                'SELECT sender, text_content, type FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 15',
                [dbContext.conversationId]
            );
            historyMessages = msgRows.reverse()
                .filter(m => m.text_content && m.text_content.trim())
                .map(m => ({
                    role: m.sender === 'customer' ? 'user' : 'assistant',
                    content: m.text_content
                }));
        }

        // 4. Build system message
        const openai = new OpenAI({ apiKey });
        const systemMessage = {
            role: 'system',
            content: `${systemPrompt}

AGENT CAPABILITIES & DATABASE STRUCTURE:
You have direct read-only SQL access to the 'products' table.
Schema:
Table: products
- id (INT)
- title (VARCHAR)
- brand (VARCHAR)
- gender (VARCHAR) - Stores 'men', 'women', 'kids', 'unisex' etc.
- size_original (VARCHAR) - The shoe size (e.g., '43', '42 EU')
- color (VARCHAR)
- starting_price (DECIMAL) - Selling price
- minimum_price (DECIMAL) - Lowest possible price (SECRET)
- status (VARCHAR) - 'available' or 'sold'
- main_image_url, video_url, voice_note_url (VARCHAR)

Tools available:
1. query_database - Execute a raw SELECT SQL query. ALWAYS use this when customer asks about available products or specific sizes (e.g., SELECT id, title, size_original, color, starting_price FROM products WHERE status='available' AND size_original LIKE '%43%' AND gender LIKE '%men%'). Use LIKE for flexible matching. When searching for 'men' or 'women', ALWAYS include 'unisex' in your query (e.g. "gender IN ('men', 'unisex')" or "gender LIKE '%men%' OR gender='unisex'").
2. send_product_media - Send product image/video/voice to WhatsApp. ALWAYS include caption.
3. save_customer_info - Save customer name/address.

CRITICAL BEHAVIOR RULES:
- BE SMART & ANALYTICAL: When a customer asks for products, think carefully! If they want 'men' shoes, 'unisex' also applies. If your strict SQL query returns 0 results, DO NOT immediately say it's unavailable! Instead, run a broader SQL query (e.g., just filtering by status='available') and analyze the results yourself to see if anything matches their intent.
- ALWAYS call query_database BEFORE answering product availability. The database is the ONLY source of truth.
- When you mention a product to the customer in text, ALWAYS include its ID like this: "Nike Shoes (ID: 45) Rs 10000".
- If a customer asks to resend a voice note/video, check your previous messages for the "[System Note: Attached Media for Product ID X]" to know WHICH product_id they mean.
- NEVER say "nahi available" WITHOUT first verifying thoroughly via SQL.
- NEVER reveal minimum_price.
- Be friendly and conversational in Urdu/English mixed style (Roman Urdu). Keep text short.
- Advance payment required for orders: Rs ${advanceAmount}
- If customer says just a number like "43", that is a SHOE SIZE. Query the database for it.`
        };

        // Build messages array: system + history + current user message
        const messages = [
            systemMessage,
            ...historyMessages,
            { role: 'user', content: incomingText }
        ];

        // 5. Call OpenAI with tool loop (multi-turn tool calling)
        let mediaSent = false;
        let maxIterations = 5; // Safety limit to prevent infinite loops
        
        for (let i = 0; i < maxIterations; i++) {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: messages,
                tools: tools.getAgentTools(),
                tool_choice: 'auto'
            });

            const assistantMessage = response.choices[0].message;
            messages.push(assistantMessage); // Add assistant response to conversation

            const toolCalls = assistantMessage.tool_calls;

            // If no tool calls, we have the final text response
            if (!toolCalls || toolCalls.length === 0) {
                let replyText = assistantMessage.content || '';
                
                if (replyText) {
                    // Guardrail check
                    if (!guardrailCheck(replyText)) {
                        replyText = "Let me check on that and get back to you.";
                    }

                    // Apply delay
                    if (delaySeconds > 0) {
                        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
                    }

                    await sendTextMessage(phone, replyText);
                    console.log(`Sent AI reply to ${phone}: ${replyText.substring(0, 80)}...`);

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
                }
                break; // Exit the loop - we got a final response
            }

            // Process each tool call
            for (const toolCall of toolCalls) {
                const args = JSON.parse(toolCall.function.arguments);
                let toolResult = '';

                if (toolCall.function.name === 'query_database') {
                    console.log(`Agent executing SQL: ${args.sql_query}`);
                    const products = await tools.queryDatabase(args.sql_query);
                    if (products.error) {
                        toolResult = `ERROR: ${products.error}`;
                    } else if (!products || products.length === 0) {
                        toolResult = 'No products found matching the search criteria.';
                    } else {
                        toolResult = products.map(p => JSON.stringify(p)).join('\n');
                    }
                } else if (toolCall.function.name === 'save_customer_info') {
                    const result = await tools.saveCustomerInfo(phone, args.name, args.address);
                    toolResult = JSON.stringify(result);
                } else if (toolCall.function.name === 'send_product_media') {
                    const productMedia = await tools.getProductMedia(args.product_id);
                    if (productMedia) {
                        let url = null;
                        let mediaType = 'image';
                        let caption = args.caption || '';
                        
                        if (args.media_type === 'image') {
                            url = productMedia.main_image_url;
                            mediaType = 'image';
                            // Auto-generate caption if not provided
                            if (!caption) {
                                caption = `${productMedia.title} | Size: ${productMedia.size_original || 'N/A'} | Color: ${productMedia.color || 'N/A'} | Price: Rs ${productMedia.starting_price}`;
                            }
                        } else if (args.media_type === 'video') {
                            url = productMedia.video_url;
                            mediaType = 'video';
                        } else if (args.media_type === 'voice') {
                            url = productMedia.voice_note_url;
                            mediaType = 'audio';
                            caption = ''; // No caption for voice
                        }
                        
                        if (url) {
                            const sendResult = await sendMediaMessage(phone, mediaType, url, caption);
                            if (sendResult?.error) {
                                toolResult = `ERROR sending ${args.media_type}: ${JSON.stringify(sendResult.data)}`;
                                if (dbContext?.conversationId) {
                                    const errMsg = `[Error Sending Media]: ${JSON.stringify(sendResult.data)}`;
                                    await db.execute(
                                        'INSERT INTO messages (conversation_id, sender, type, text_content) VALUES (?, ?, ?, ?)',
                                        [dbContext.conversationId, 'system', 'text', errMsg]
                                    );
                                }
                                console.error(`Failed to send ${args.media_type} to ${phone}:`, sendResult.data);
                            } else {
                                mediaSent = true;
                                toolResult = `Successfully sent ${args.media_type} for product ${args.product_id} to customer.`;
                                if (dbContext?.conversationId) {
                                    try {
                                        // Append system note for LLM memory (not sent to WhatsApp)
                                        const dbTextContent = caption ? `${caption}\n[System Note: Attached Media for Product ID ${args.product_id}]` : `[System Note: Attached Media for Product ID ${args.product_id}]`;
                                        await db.execute(
                                            'INSERT INTO messages (conversation_id, sender, type, media_url, text_content) VALUES (?, ?, ?, ?, ?)',
                                            [dbContext.conversationId, 'agent', mediaType, url, dbTextContent]
                                        );
                                    } catch (e) { console.error('Failed to save agent media message:', e); }
                                }
                                console.log(`Agent sent ${args.media_type} for product ${args.product_id} to ${phone}`);
                            }
                        } else {
                            toolResult = `No ${args.media_type} URL found for product ${args.product_id}.`;
                            console.log(`Agent tried to send ${args.media_type} for product ${args.product_id}, but URL was empty.`);
                        }
                    } else {
                        toolResult = `Product with ID ${args.product_id} not found.`;
                    }
                }

                // Add tool result back to messages so OpenAI can see it
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: toolResult
                });
            }
            // Loop continues - OpenAI will see the tool results and decide what to do next
        }
    } catch (err) {
        console.error('Error in AI processing:', err);
        // Log the full error in chat for debugging
        if (dbContext?.conversationId) {
            try {
                await db.execute(
                    'INSERT INTO messages (conversation_id, sender, type, text_content) VALUES (?, ?, ?, ?)',
                    [dbContext.conversationId, 'system', 'text', `[Agent Error]: ${err.message || err.toString()}`]
                );
            } catch (e) { /* ignore */ }
        }
        await sendTextMessage(phone, "Sorry, I'm having a brief issue. Please try again in a moment.");
    }
};

module.exports = {
    processMessage
};
