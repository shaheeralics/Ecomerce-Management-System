const db = require('../../db');
const { GoogleGenAI } = require('@google/genai');

// Helper: get Gemini AI client from DB key
const getAI = async () => {
    const [rows] = await db.execute('SELECT llm_api_key FROM api_settings WHERE id = 1');
    const apiKey = rows[0]?.llm_api_key;
    if (!apiKey) throw new Error('LLM API Key not configured in database');
    return new GoogleGenAI({ apiKey });
};

// Sizing Service
const getSizeMapping = (size_original) => {
    const sizeMap = {
        '36': { size_uk: '3.5', size_eu: '36', size_cn: '225' },
        '37': { size_uk: '4', size_eu: '37', size_cn: '230' },
        '38': { size_uk: '5', size_eu: '38', size_cn: '240' },
        '39': { size_uk: '6', size_eu: '39', size_cn: '245' },
        '40': { size_uk: '6.5', size_eu: '40', size_cn: '250' },
        '41': { size_uk: '7', size_eu: '41', size_cn: '260' },
        '42': { size_uk: '8', size_eu: '42', size_cn: '265' },
        '43': { size_uk: '9', size_eu: '43', size_cn: '275' },
        '44': { size_uk: '10', size_eu: '44', size_cn: '280' },
        '45': { size_uk: '11', size_eu: '45', size_cn: '290' },
        '46': { size_uk: '12', size_eu: '46', size_cn: '300' },
    };
    return sizeMap[size_original] || { size_uk: 'N/A', size_eu: size_original, size_cn: 'N/A' };
};

// Real Gemini AI Title Generation
const draftTitle = async (brand, roughDescription) => {
    try {
        const ai = await getAI();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a short, SEO-optimized Shopify product title for a shoe listing.
Brand: ${brand || 'Unknown'}
Details: ${roughDescription}
Rules:
- Maximum 80 characters
- Include brand name first
- Include key features (color, style)
- Do NOT include size or price
- Return ONLY the title, nothing else`,
        });
        return response.text.trim().replace(/^["']|["']$/g, '');
    } catch (err) {
        console.error('AI Title generation failed:', err);
        return `${brand || ''} ${roughDescription.split(' ').slice(0, 4).join(' ')} Shoes`.trim();
    }
};

// TM Injection
const injectTmToBrand = (title, brand) => {
    if (!brand) return title;
    const regex = new RegExp(`\\b${brand}\\b`, 'i');
    return title.replace(regex, `${brand}™`);
};

// Real Gemini AI Description Generation
const draftDescription = async (roughDescription) => {
    try {
        const ai = await getAI();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Write a professional Shopify product description in HTML format for a shoe listing.
Details: ${roughDescription}
Rules:
- Use <p>, <ul>, <li> HTML tags for formatting
- Include key features and benefits
- Write 2-3 short paragraphs
- Make it engaging and professional
- Do NOT mention pricing
- Return ONLY the HTML, no markdown`,
        });
        return response.text.trim();
    } catch (err) {
        console.error('AI Description generation failed:', err);
        return `<p>Premium quality footwear. ${roughDescription}</p>`;
    }
};

// Image Sorting by Label
const sortImagesByLabel = (files, labels) => {
    const order = { 'Main': 1, 'Side': 2, 'Back': 3, 'Sole': 4, 'Detail': 5, 'Other': 6 };
    const combined = files.map((file, index) => ({
        file,
        label: labels[index] || 'Other'
    }));
    combined.sort((a, b) => {
        const valA = order[a.label] || 99;
        const valB = order[b.label] || 99;
        return valA - valB;
    });
    return combined.map(item => item.file);
};

// Real Shopify API Publish
const publishToShopify = async (productData) => {
    // Get Shopify credentials from DB
    const [rows] = await db.execute('SELECT shopify_url, shopify_token FROM api_settings WHERE id = 1');
    const shopifyUrl = rows[0]?.shopify_url;
    const shopifyToken = rows[0]?.shopify_token;

    if (!shopifyUrl || !shopifyToken) {
        console.log('Shopify credentials not configured. Skipping Shopify publish.');
        return { id: null, handle: null, skipped: true, reason: 'Shopify credentials not configured' };
    }

    const shopifyApiUrl = `https://${shopifyUrl}/admin/api/2024-01/products.json`;

    const shopifyProduct = {
        product: {
            title: productData.title,
            body_html: productData.description,
            vendor: productData.brand || '',
            product_type: 'Shoes',
            variants: [{
                price: productData.price,
                option1: productData.sizes?.size_eu || 'One Size',
                inventory_management: 'shopify',
                inventory_quantity: 1
            }],
            options: [{
                name: 'Size',
                values: [productData.sizes?.size_eu || 'One Size']
            }]
        }
    };

    try {
        const response = await fetch(shopifyApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': shopifyToken
            },
            body: JSON.stringify(shopifyProduct)
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('Shopify API Error:', data);
            throw new Error(data.errors || 'Shopify API Error');
        }

        console.log('Published to Shopify:', data.product?.id);
        return {
            id: data.product?.id?.toString(),
            handle: data.product?.handle
        };
    } catch (err) {
        console.error('Shopify publish failed:', err);
        return { id: null, handle: null, error: err.message };
    }
};

module.exports = {
    getSizeMapping,
    draftTitle,
    injectTmToBrand,
    draftDescription,
    sortImagesByLabel,
    publishToShopify
};
