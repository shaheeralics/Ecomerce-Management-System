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

AGENT CAPABILITIES:
You have the following tools available:
1. search_products - Search the product catalog by size, gender, color. ALWAYS use this when customer asks about products.
2. send_product_media - Send product image/video/voice note to customer's WhatsApp. When sending image, ALWAYS include caption with product details.
3. save_customer_info - Save customer name/address. ONLY use when customer explicitly shares their name or address.

CRITICAL BEHAVIOR RULES:
- When customer asks "kon kon sei shoes/sizes available hai?" → Use search_products tool (no filters) to get ALL available products, then list them.
- When customer asks for a specific size (e.g. "43 no shoes") → Use search_products with size="43" to find ONLY size 43 shoes. Do NOT show other sizes.
- When showing products, send their image using send_product_media with a caption that includes: Title, Size, Color, Price.
- If a product has video available, ALSO send the video after sending the image.
- If a product has voice note available, ALSO send the voice note.
- NEVER reveal the minimum_price to the customer. Keep it secret.
- If customer offers a price, negotiate but never go below minimum_price.
- Be friendly and conversational in Urdu/English mixed style (Roman Urdu).
- Keep text responses concise (max 2-3 sentences).
- Advance payment required for orders: Rs ${advanceAmount}
- If you don't know the customer's name, ask early and save it with save_customer_info.
- When customer says just a number like "43", that is a SHOE SIZE, not their name. Search for that size.
- Do NOT send media for products that don't match the customer's request.`
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

                if (toolCall.function.name === 'search_products') {
                    console.log(`Agent searching products: size=${args.size}, gender=${args.gender}, color=${args.color}`);
                    const products = await tools.searchAvailableProducts(args.gender, args.size, args.color);
                    if (products.length === 0) {
                        toolResult = 'No products found matching the search criteria.';
                    } else {
                        toolResult = products.map(p => 
                            `ID:${p.id} | ${p.title} | Size:${p.size_original || 'N/A'} | Color:${p.color || 'N/A'} | Gender:${p.gender} | Price: Rs ${p.starting_price} | Has Image: ${p.main_image_url ? 'Yes' : 'No'} | Has Video: ${p.video_url ? 'Yes' : 'No'} | Has Voice: ${p.voice_note_url ? 'Yes' : 'No'}`
                        ).join('\n');
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
                                        await db.execute(
                                            'INSERT INTO messages (conversation_id, sender, type, media_url, text_content) VALUES (?, ?, ?, ?, ?)',
                                            [dbContext.conversationId, 'agent', mediaType, url, caption]
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
