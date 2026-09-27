require('dotenv').config({ path: '../.env' });
const { GoogleGenAI } = require('@google/genai');

async function test() {
    try {
        const geminiKey = process.env.LLM_API_KEY;
        console.log('Key length:', geminiKey ? geminiKey.length : 0);
        
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: "Reply with 'Hello'" }
                    ]
                }
            ]
        });
        console.log('Success:', response.text);
    } catch (err) {
        console.error('Error during STT test:', err);
    }
}
test();
