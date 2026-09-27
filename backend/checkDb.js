const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function checkDb() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        const [rows] = await connection.execute('SELECT * FROM messages ORDER BY id DESC LIMIT 5');
        console.log('Latest Messages:', JSON.stringify(rows, null, 2));

        await connection.end();
    } catch (e) {
        console.error(e);
    }
}
checkDb();
