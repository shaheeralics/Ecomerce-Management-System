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

        // Check if human has taken over this conversation or if it is closed
        if (dbContext?.conversationId) {
            const [convRows] = await db.execute('SELECT status FROM conversations WHERE id = ?', [dbContext.conversationId]);
            if (convRows.length > 0) {
                const convStatus = convRows[0].status;
                if (convStatus === 'human_takeover' || convStatus === 'closed') {
                    console.log(`Conversation ${dbContext.conversationId} is currently '${convStatus}'. AI agent will not intervene.`);
                    return;
                }
            }
        } else {
            const [convRows] = await db.execute('SELECT id, status FROM conversations WHERE customer_phone = ?', [phone]);
            if (convRows.length > 0) {
                const convStatus = convRows[0].status;
                if (convStatus === 'human_takeover' || convStatus === 'closed') {
                    console.log(`Conversation for ${phone} is currently '${convStatus}'. AI agent will not intervene.`);
                    return;
                }
            }
        }

        const systemPrompt = (config.system_prompt && config.system_prompt.trim())
            ? config.system_prompt.trim()
            : 'You are an elite, polite, and persuasive sales assistant for Pawanda Shoes on WhatsApp.';
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

        // 4. Build system message incorporating the Admin's UI prompt + Product Catalog & ReAct instructions
        const openai = new OpenAI({ apiKey });
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
2. send_product_media - Send product image, video, or voice note to WhatsApp.
3. save_customer_info - Save customer name and delivery address when provided.

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
   - If the exact requested item or size is genuinely not available after checking, find 2-3 of the closest available alternatives (e.g. similar sizes 42/44, popular articles, or bestsellers) and warmly suggest them:
     "Sir 43 size is specific design mein stock out hai, lekin 43 size mein hamare paas ye zabardast alternative options available hain (ID: X, ID: Y), kya aap inki tasweer dekhna chahenge?"
   - This keeps the customer engaged and protects sales revenue.

4. PRODUCT IDS & MEDIA CONTINUITY:
   - Whenever you mention any product to the customer in text, ALWAYS clearly include its ID: e.g. "Nike Air Max (ID: 45) - Rs 8,500".
   - If the customer asks to "resend voice" or "send picture", look at the previous messages in the conversation (specifically looking for "[System Note: Attached Media for Product ID X]" or previously mentioned Product IDs) to identify WHICH product they are referring to, and call send_product_media with that ID.

5. COMMUNICATION STYLE:
   - Speak in natural, respectful, friendly Roman Urdu / English.
   - Keep messages short, crisp, and WhatsApp-friendly.
   - Advance payment required for orders: Rs ${advanceAmount}.`
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

                if (toolCall.function.name === 'query_product_catalog' || toolCall.function.name === 'query_database') {
                    console.log(`Agent executing SQL: ${args.sql_query}`);
                    const products = await tools.queryProductCatalog(args.sql_query);
                    if (products.error) {
                        toolResult = `SQL ERROR: ${products.error}. Please revise your SELECT query syntax on the products table.`;
                    } else if (!products || products.length === 0) {
                        toolResult = 'No products found for this query. Self-Correction Note: Do NOT immediately tell the customer it is unavailable! Check if the item could be marked unisex, try flexible size matching with LIKE, or query for the closest available alternatives to recommend to the customer to protect the sale.';
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
