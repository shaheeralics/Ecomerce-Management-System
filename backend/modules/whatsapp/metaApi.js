// Using native fetch API for network requests

const db = require('../../db');

const sendWhatsAppMessage = async (toPhone, messageData) => {
    const lovableDomain = process.env.LOVABLE_APP_DOMAIN;
    const bridgeSecret = 'PawandaBridge2026!';

    if (!lovableDomain) {
        console.error('LOVABLE_APP_DOMAIN missing in .env');
        return;
    }

    try {
        const url = lovableDomain.startsWith('http') ? `${lovableDomain}/api/public/whatsapp/send` : `https://${lovableDomain}/api/public/whatsapp/send`;
        
        let payloadBody = {
            to: toPhone,
            type: messageData.type
        };

        if (messageData.type === 'text') {
            payloadBody.text = messageData.text.body;
        } else if (messageData.type === 'image' || messageData.type === 'video' || messageData.type === 'audio' || messageData.type === 'document') {
            payloadBody.url = messageData[messageData.type].link;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-Bridge-Secret': bridgeSecret,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadBody)
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('Lovable Bridge Error:', data);
        }
        return data;
    } catch (error) {
        console.error('Error sending WhatsApp message via Lovable Bridge:', error);
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
