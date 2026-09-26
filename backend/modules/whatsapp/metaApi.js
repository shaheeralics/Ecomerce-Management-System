// Using native fetch API for network requests

const db = require('../../db');

const sendWhatsAppMessage = async (toPhone, messageData) => {
    const token = process.env.LOVABLE_API_KEY;
    const apiKey = process.env.WHATSAPP_API_KEY;

    if (!token || !apiKey) {
        console.error('Lovable/WhatsApp credentials missing in .env');
        return;
    }

    try {
        const response = await fetch(`https://connector-gateway.lovable.dev/whatsapp/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Connection-Api-Key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: toPhone,
                ...messageData
            })
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('Connector Gateway Error:', data);
        }
        return data;
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
    }
};

const sendTextMessage = async (toPhone, text) => {
    return sendWhatsAppMessage(toPhone, {
        type: 'text',
        text: { body: text }
    });
};

const sendMediaMessage = async (toPhone, type, mediaUrl, caption = '') => {
    // type can be 'image', 'video', 'audio', 'document'
    return sendWhatsAppMessage(toPhone, {
        type: type,
        [type]: {
            link: mediaUrl,
            caption: caption
        }
    });
};

module.exports = {
    sendTextMessage,
    sendMediaMessage
};
