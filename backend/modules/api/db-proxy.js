const express = require('express');
const router = express.Router();
const db = require('../../db'); // Assuming db is a pool export that supports query/execute

const PROXY_API_KEY = 'PawandaSecr3t2026!';

// Middleware to protect the endpoint
const authenticateProxy = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['X-API-KEY'];
    if (!apiKey || apiKey !== PROXY_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized. Invalid or missing X-API-KEY.' });
    }
    next();
};

router.post('/', authenticateProxy, async (req, res) => {
    try {
        const { query, params } = req.body;
        
        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Invalid or missing query parameter.' });
        }
        
        // Execute the query
        const queryParams = Array.isArray(params) ? params : [];
        const [rows] = await db.query(query, queryParams);
        
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('DB Proxy Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
