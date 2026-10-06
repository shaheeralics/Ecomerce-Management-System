const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const OpenAI = require('openai');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const openAiKey = process.env.OPENAI_API_KEY;
        if (!openAiKey) {
            return res.status(500).json({ error: 'OPENAI_API_KEY is not configured in .env' });
        }

        const openai = new OpenAI({ apiKey: openAiKey });

        // OpenAI requires a file stream with a known extension (.webm, .wav, .mp3, etc.)
        let ext = '.webm';
        if (req.file.mimetype === 'audio/wav' || req.file.mimetype.includes('wav')) {
            ext = '.wav';
        }

        const uploadsDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        
        const tmpFilePath = path.join(uploadsDir, `upload_${Date.now()}${ext}`);
        fs.writeFileSync(tmpFilePath, req.file.buffer);

        try {
            const transcription = await openai.audio.transcriptions.create({
                file: fs.createReadStream(tmpFilePath),
                model: 'whisper-1',
                response_format: 'text', // To get raw text string directly
            });

            const transcriptText = typeof transcription === 'string' ? transcription : (transcription.text || '');
            res.json({ success: true, text: transcriptText.trim() });
        } finally {
            // Clean up temp file
            if (fs.existsSync(tmpFilePath)) {
                fs.unlinkSync(tmpFilePath);
            }
        }

    } catch (err) {
        console.error('OpenAI Transcription error:', err);
        res.status(500).json({ error: 'Failed to transcribe via OpenAI', details: err.message });
    }
});

module.exports = router;
