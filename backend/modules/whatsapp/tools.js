const db = require('../../db');

// Search available products from real database
const searchAvailableProducts = async (gender, size, color) => {
    let query = 'SELECT id, title, brand, gender, size_original, color, starting_price, minimum_price, main_image_url, video_url, voice_note_url FROM products WHERE status = ?';
    const params = ['available'];

    if (gender) {
        query += ' AND gender = ?';
        params.push(gender);
    }
    if (size) {
        // Use LIKE for flexible size matching (handles "43", "43 EU", "Size 43", etc.)
        query += ' AND size_original LIKE ?';
        params.push(`%${size}%`);
    }
    if (color) {
        query += ' AND color LIKE ?';
        params.push(`%${color}%`);
    }

    query += ' ORDER BY created_at DESC';

    try {
        const [rows] = await db.execute(query, params);
        console.log(`[Search Products] Query: ${query} | Params: ${JSON.stringify(params)} | Found: ${rows.length} products`);
        if (rows.length > 0) {
            console.log(`[Search Products] Results: ${rows.map(r => `ID:${r.id} "${r.title}" Size:${r.size_original}`).join(', ')}`);
        }
        return rows;
    } catch (err) {
        console.error('Failed to search products:', err);
        return [];
    }
};

// Get product media from real database
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

// Propose price against real minimum price in database
const proposePrice = async (productId, offer) => {
    try {
        const [rows] = await db.execute(
            'SELECT minimum_price, starting_price FROM products WHERE id = ?',
            [productId]
        );
        if (rows.length === 0) return { accepted: false, message: 'Product not found' };

        const product = rows[0];
        if (offer >= product.minimum_price) {
            return { accepted: true, message: `Offer of Rs ${offer} is acceptable.` };
        } else {
            // Don't reveal the minimum price!
            return { accepted: false, message: `Offer of Rs ${offer} is too low. Please make a better offer.` };
        }
    } catch (err) {
        console.error('Failed to check price:', err);
        return { accepted: false, message: 'Error checking price.' };
    }
};

// Mark product as sold in real database
const markProductSold = async (productId) => {
    try {
        await db.execute('UPDATE products SET status = ? WHERE id = ?', ['sold', productId]);
        return { success: true };
    } catch (err) {
        console.error('Failed to mark product sold:', err);
        return { success: false };
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
                name: "search_products",
                description: "Search the product catalog by size, gender, or color. Use this to find what products are available for the customer. ALWAYS call this when customer asks about available products or a specific size/color/gender.",
                parameters: {
                    type: "object",
                    properties: {
                        size: { type: "string", description: "Shoe size number, e.g. '43', '42', '39'" },
                        gender: { type: "string", enum: ["male", "female", "unisex"], description: "Gender filter" },
                        color: { type: "string", description: "Color filter, e.g. 'black', 'white', 'red'" }
                    },
                    required: []
                }
            }
        },
        {
            type: "function",
            function: {
                name: "save_customer_info",
                description: "Saves the customer's name and/or delivery address. ONLY call this when customer explicitly tells their name or address. Do NOT call this for product inquiries like size numbers.",
                parameters: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "The customer's full name" },
                        address: { type: "string", description: "The customer's delivery address" }
                    },
                    required: []
                }
            }
        },
        {
            type: "function",
            function: {
                name: "send_product_media",
                description: "Sends a product's image, video, or voice note directly to the customer's WhatsApp. When sending an image, ALWAYS include a caption with the product details (title, size, color, price). You can call this multiple times to send multiple media types for the same product.",
                parameters: {
                    type: "object",
                    properties: {
                        product_id: { type: "integer", description: "The ID of the product from search results" },
                        media_type: { type: "string", enum: ["image", "video", "voice"], description: "Type of media: 'image' for product photo, 'video' for product video, 'voice' for .ogg voice note" },
                        caption: { type: "string", description: "Caption text to send with image/video. Include product name, size, color, price. Leave empty for voice." }
                    },
                    required: ["product_id", "media_type"]
                }
            }
        }
    ];
};

module.exports = {
    searchAvailableProducts,
    getProductMedia,
    proposePrice,
    markProductSold,
    saveCustomerInfo,
    getAgentTools
};
