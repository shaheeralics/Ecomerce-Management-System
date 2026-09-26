const db = require('../../db');

// Search available products from real database
const searchAvailableProducts = async (gender, size, color) => {
    let query = 'SELECT id, title, brand, gender, size_original, color, starting_price, main_image_url FROM products WHERE status = ?';
    const params = ['available'];

    if (gender) {
        query += ' AND gender = ?';
        params.push(gender);
    }
    if (size) {
        query += ' AND size_original = ?';
        params.push(size);
    }
    if (color) {
        query += ' AND color LIKE ?';
        params.push(`%${color}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT 5';

    try {
        const [rows] = await db.execute(query, params);
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
            'SELECT main_image_url, extra_image_urls, video_url, voice_note_url FROM products WHERE id = ?',
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
                name: "save_customer_info",
                description: "Saves the customer's name and/or delivery address to the database. Call this as soon as the customer provides their name or address.",
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
    searchAvailableProducts,
    getProductMedia,
    proposePrice,
    markProductSold,
    saveCustomerInfo,
    getAgentTools
};
