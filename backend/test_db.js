require('dotenv').config();
const mysql = require('mysql2/promise');
async function test() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ecomerce_automation'
    });
    try {
        const [rows] = await pool.query("SELECT * FROM chat_messages WHERE type = 'audio' ORDER BY created_at DESC LIMIT 1");
        console.log(rows);
    } catch(e) { console.error(e); }
    process.exit(0);
}
test();
