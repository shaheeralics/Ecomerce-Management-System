const db = require('../../db');

// Execute read-only SELECT query strictly on the 'products' catalog table
const queryProductCatalog = async (sqlQuery) => {
    try {
        if (!sqlQuery || typeof sqlQuery !== 'string') {
            return { error: 'Invalid SQL query provided.' };
        }

        const cleanQuery = sqlQuery.trim();

        // 1. Security check: ONLY allow SELECT queries
        if (!cleanQuery.toUpperCase().startsWith('SELECT')) {
            return { error: 'Permission denied: Only SELECT queries are permitted on the product catalog.' };
        }

        // 2. Disallow multiple statements (semicolons) or file operations
        if (cleanQuery.includes(';') || /into\s+outfile/i.test(cleanQuery) || /load_file/i.test(cleanQuery)) {
            return { error: 'Permission denied: Multiple queries or file operations are strictly prohibited.' };
        }

        // 3. Security check: Must only query the 'products' table
        const fromMatch = cleanQuery.match(/\bFROM\s+([a-zA-Z0-9_`"']+)/i);
        if (!fromMatch) {
            return { error: 'Invalid query: Query must specify FROM products.' };
        }

        const tableName = fromMatch[1].replace(/[`"']/g, '').toLowerCase();
        if (tableName !== 'products') {
            return { error: `Permission denied: Access to table '${tableName}' is forbidden. You only have read access to the 'products' catalog.` };
        }

        // 4. Disallow any JOIN or subquery referencing other tables
        const forbiddenTables = ['users', 'api_settings', 'agent_config', 'conversations', 'messages', 'orders', 'voice_assets'];
        for (const tbl of forbiddenTables) {
            const regex = new RegExp(`\\b${tbl}\\b`, 'i');
            if (regex.test(cleanQuery)) {
                return { error: `Permission denied: Access to table '${tbl}' is strictly prohibited.` };
            }
        }

        // 5. Disallow data modification keywords
        const forbiddenKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'RENAME', 'GRANT', 'REVOKE'];
        for (const kw of forbiddenKeywords) {
            const regex = new RegExp(`\\b${kw}\\b`, 'i');
            if (regex.test(cleanQuery)) {
                return { error: `Security violation: Keyword '${kw}' is not permitted.` };
            }
        }

        console.log(`[Product Catalog Query] Executing: ${cleanQuery}`);
        const [rows] = await db.execute(cleanQuery);
        console.log(`[Product Catalog Query] Found: ${rows.length} results`);

        // Sanitize rows: strip minimum_price so secret base price is never exposed
        const sanitized = rows.map(r => {
            const safe = { ...r };
            delete safe.minimum_price;
            return safe;
        });

        return sanitized;
    } catch (err) {
        console.error('Failed to query product catalog:', err);
        return { error: err.message || 'Database query failed' };
    }
};

// Get product media from database
const getProductMedia = async (productId) => {
    try {
        const [rows] = await db.execute(
            'SELECT id, title, brand, gender, size_original, color, starting_price, main_image_url, extra_image_urls, video_url, voice_note_url FROM products WHERE id = ?',
            [productId]
        );
        if (rows.length === 0) return null;
        return rows[0];
    } catch (err) {
        console.error('Failed to get product media:', err);
        return null;
    }
};

// Save customer info (Name, Address) to known_slots in database
const saveCustomerInfo = async (phone, name, address) => {
    try {
        const [rows] = await db.execute('SELECT known_slots FROM conversations WHERE customer_phone = ?', [phone]);
        if (rows.length === 0) return { success: false, message: 'Conversation not found' };

        let known_slots = rows[0].known_slots || {};
        if (typeof known_slots === 'string') {
            try { known_slots = JSON.parse(known_slots); } catch (e) { known_slots = {}; }
        }

        if (name) known_slots.name = name;
        if (address) known_slots.address = address;

        await db.execute('UPDATE conversations SET known_slots = ? WHERE customer_phone = ?', [JSON.stringify(known_slots), phone]);
        return { success: true, message: `Saved customer info: ${name || ''} ${address || ''}` };
    } catch (err) {
        console.error('Failed to save customer info:', err);
        return { success: false, message: 'Database error' };
    }
};

const getAgentTools = () => {
    return [
        {
            type: "function",
            function: {
                name: "query_product_catalog",
                description: "Execute a read-only SELECT SQL query strictly on the 'products' table. Search by size, gender, brand, color, or price. Only 'products' table can be queried. If searching for men or women, always include unisex.",
                parameters: {
                    type: "object",
                    properties: {
                        sql_query: {
                            type: "string",
                            description: "The SELECT query strictly on the products table. Example: SELECT id, title, size_original, color, starting_price FROM products WHERE status = 'available' AND (gender LIKE '%men%' OR gender = 'unisex') AND size_original LIKE '%43%'"
                        }
                    },
                    required: ["sql_query"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "send_product_media",
                description: "Sends a product's photo, video, or recorded voice note directly to the customer's WhatsApp. When sending an image or video, ALWAYS include a descriptive caption with the product name, size, color, and price.",
                parameters: {
                    type: "object",
                    properties: {
                        product_id: { type: "integer", description: "The ID of the product from search results" },
                        media_type: { type: "string", enum: ["image", "video", "voice"], description: "Type of media: 'image' for photo, 'video' for video, 'voice' for voice note" },
                        caption: { type: "string", description: "Caption text to send with photo/video. Include product name, size, color, price. Leave empty for voice." }
                    },
                    required: ["product_id", "media_type"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "save_customer_info",
                description: "Saves the customer's name and/or delivery address for order placement. ONLY call this when customer explicitly provides their name or address.",
                parameters: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "The customer's full name" },
                        address: { type: "string", description: "The customer's delivery address" }
                    },
                    required: []
                }
            }
        }
    ];
};

module.exports = {
    queryProductCatalog,
    getProductMedia,
    saveCustomerInfo,
    getAgentTools
};
