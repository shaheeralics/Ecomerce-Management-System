// Using native fetch API for network requests

const db = require('../../db');

const sendWhatsAppMessage = async (toPhone, messageData) => {
    let token, phoneId;
    try {
        const [rows] = await db.execute('SELECT meta_token, meta_phone_id FROM api_settings WHERE id = 1');
        if (rows.length > 0) {
            token = rows[0].meta_token;
            phoneId = rows[0].meta_phone_id;
        }
    } catch (err) {
        console.error('Failed to fetch Meta API settings from DB:', err);
    }

    if (!token || !phoneId) {
        console.error('Meta WhatsApp credentials missing in database');
        return;
    }

    try {
        const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
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
            console.error('Meta API Error:', data);
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
