const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' }); // Load root .env

async function checkDb() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        const [rows] = await connection.execute('SELECT id, customer_phone, known_slots FROM conversations ORDER BY id DESC LIMIT 5');
        console.log('Conversations Table:', JSON.stringify(rows, null, 2));

        const [webhookRows] = await connection.execute('SELECT * FROM messages ORDER BY id DESC LIMIT 5');
        console.log('Messages Table:', JSON.stringify(webhookRows, null, 2));

        await connection.end();
    } catch (e) {
        console.error(e);
    }
}
checkDb();
