const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../../db');
const { uploadToOracleS3, deleteFromOracleS3 } = require('./s3Helper');
const { GoogleGenAI } = require('@google/genai');

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Transcribe Audio using Gemini
router.post('/transcribe', upload.single('audio'), async (req, res) => {
    try {
        let audioBuffer;
        let mimeType;

        if (req.file) {
            audioBuffer = req.file.buffer;
            mimeType = req.file.mimetype;
        } else if (req.body.voice_url) {
            const fetchRes = await fetch(req.body.voice_url);
            if (!fetchRes.ok) return res.status(400).json({ success: false, error: 'Could not fetch existing audio file' });
            const arrayBuffer = await fetchRes.arrayBuffer();
            audioBuffer = Buffer.from(arrayBuffer);
            mimeType = fetchRes.headers.get('content-type') || 'audio/wav';
        } else {
            return res.status(400).json({ success: false, error: 'No audio file or voice URL provided' });
        }

        const openAiKey = process.env.OPENAI_API_KEY;
        if (!openAiKey) return res.status(400).json({ success: false, error: 'OPENAI_API_KEY not configured in .env' });

        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: openAiKey });

        const fs = require('fs');
        const path = require('path');
        const uploadsDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        
        let ext = '.wav';
        if (mimeType.includes('ogg')) ext = '.ogg';
        else if (mimeType.includes('webm')) ext = '.webm';

        const tmpFilePath = path.join(uploadsDir, `tmp_transcribe_${Date.now()}${ext}`);
        fs.writeFileSync(tmpFilePath, audioBuffer);

        try {
            const transcriptionResponse = await openai.audio.transcriptions.create({
                file: fs.createReadStream(tmpFilePath),
                model: 'whisper-1',
                response_format: 'text',
                prompt: 'If the audio is in Urdu/Hindi, transcribe it accurately using roman script or native script based on the context.'
            });

            const transcriptText = typeof transcriptionResponse === 'string' 
                ? transcriptionResponse 
                : (transcriptionResponse.text || '');

            res.json({ success: true, transcription: transcriptText.trim() });
        } finally {
            if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
        }
    } catch (err) {
        console.error('Transcription error:', err);
        res.status(500).json({ success: false, error: 'Transcription failed' });
    }
});

// GET all voices by category
router.get('/:category', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT * FROM voice_assets WHERE category = ? ORDER BY created_at DESC', 
            [req.params.category]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Failed to fetch voices:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch voices' });
    }
});

// POST create a voice asset
router.post('/:category', upload.single('voice'), async (req, res) => {
    try {
        const category = req.params.category;
        if (!['policy', 'prerecorded'].includes(category)) {
            return res.status(400).json({ success: false, error: 'Invalid category' });
        }

        const { title, usage_instructions, transcription } = req.body;

        // 1. Insert Skeleton Record Immediately
        const [result] = await db.execute(`
            INSERT INTO voice_assets (category, title, usage_instructions, transcription, status)
            VALUES (?, ?, ?, ?, 'uploading')
        `, [
            category,
            title || 'Untitled Voice',
            usage_instructions || '',
            transcription || ''
        ]);

        const voiceId = result.insertId;

        // 2. Return Success Immediately for Optimistic UI
        res.json({ success: true, id: voiceId, message: 'Voice asset created and uploading in background' });

        // 3. Process Upload in Background
        if (req.file) {
            (async () => {
                try {
                    const voiceUrl = await uploadToOracleS3(req.file);
                    await db.execute(`
                        UPDATE voice_assets SET voice_url = ?, status = 'available' WHERE id = ?
                    `, [voiceUrl, voiceId]);
                } catch (bgErr) {
                    console.error('Background upload failed for voice', voiceId, bgErr);
                    await db.execute(`UPDATE voice_assets SET status = 'error' WHERE id = ?`, [voiceId]);
                }
            })();
        } else {
            // No file provided, set to available immediately
            await db.execute(`UPDATE voice_assets SET status = 'available' WHERE id = ?`, [voiceId]);
        }

    } catch (err) {
        console.error('Failed to create voice asset:', err);
        res.status(500).json({ success: false, error: 'Failed to create voice asset' });
    }
});

// PUT update voice text info and optional audio
router.put('/:id', upload.single('voice'), async (req, res) => {
    try {
        const { title, usage_instructions, transcription } = req.body;
        
        // Update text fields immediately
        await db.execute(`
            UPDATE voice_assets SET title = ?, usage_instructions = ?, transcription = ?
            WHERE id = ?
        `, [title, usage_instructions, transcription, req.params.id]);

        res.json({ success: true, message: 'Voice info updated' });

        // Background upload if new voice is provided
        if (req.file) {
            (async () => {
                try {
                    const voiceUrl = await uploadToOracleS3(req.file);
                    await db.execute(`UPDATE voice_assets SET voice_url = ? WHERE id = ?`, [voiceUrl, req.params.id]);
                } catch (bgErr) {
                    console.error('Background upload failed for voice update', req.params.id, bgErr);
                }
            })();
        }
    } catch (err) {
        console.error('Failed to update voice:', err);
        res.status(500).json({ success: false, error: 'Failed to update voice' });
    }
});

// DELETE voice asset
router.delete('/:id', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT voice_url FROM voice_assets WHERE id = ?', [req.params.id]);
        if (rows.length > 0 && rows[0].voice_url) {
            await deleteFromOracleS3(rows[0].voice_url);
        }

        await db.execute('DELETE FROM voice_assets WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Voice deleted successfully' });
    } catch (err) {
        console.error('Failed to delete voice:', err);
        res.status(500).json({ success: false, error: 'Failed to delete voice' });
    }
});

module.exports = router;
