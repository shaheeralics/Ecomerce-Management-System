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

        const [rows] = await connection.execute('SELECT * FROM api_settings WHERE id = 1');
        console.log('API Settings:', JSON.stringify(rows, null, 2));
        
        console.log('ENV Key:', process.env.LLM_API_KEY);

        await connection.end();
    } catch (e) {
        console.error(e);
    }
}
checkDb();
