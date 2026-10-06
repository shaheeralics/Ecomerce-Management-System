require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

async function test() {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Create a dummy text file but with wav extension, OpenAI might reject it, but we can see the exact error.
    const tmpFilePath = path.join(__dirname, 'dummy.wav');
    fs.writeFileSync(tmpFilePath, 'RIFFdummywave'); 

    try {
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tmpFilePath),
            model: 'whisper-1',
            response_format: 'text',
        });
        console.log('Success:', transcription);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        fs.unlinkSync(tmpFilePath);
    }
}
test();
