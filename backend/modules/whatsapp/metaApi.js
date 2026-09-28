// Using native fetch API for network requests

const db = require('../../db');

const sendWhatsAppMessage = async (payload) => {
    const lovableDomain = process.env.LOVABLE_APP_DOMAIN;
    const bridgeSecret = 'PawandaBridge2026!';

    if (!lovableDomain) {
        console.error('LOVABLE_APP_DOMAIN missing in .env');
        return;
    }

    try {
        const url = lovableDomain.startsWith('http') ? `${lovableDomain}/api/public/whatsapp/send` : `https://${lovableDomain}/api/public/whatsapp/send`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-Bridge-Secret': bridgeSecret,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('Lovable Bridge Error:', data);
            return { error: true, data };
        }
        return { error: false, data };
    } catch (error) {
        console.error('Error sending WhatsApp message via Lovable Bridge:', error);
    }
};

const sendTextMessage = async (toPhone, text) => {
    return sendWhatsAppMessage({
        to: toPhone,
        type: 'text',
        text: text
    });
};

const sendMediaMessage = async (toPhone, type, mediaUrl, caption = '') => {
    // type can be 'image', 'video', 'audio', 'document'
    let payload = {
        to: toPhone,
        type: type,
        url: mediaUrl
    };
    if (caption) {
        payload.caption = caption;
    }
    return sendWhatsAppMessage(payload);
};

module.exports = {
    sendTextMessage,
    sendMediaMessage
};
