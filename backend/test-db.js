require('dotenv').config();
const mysql = require('mysql2/promise');

async function test() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const [rows] = await connection.execute('SELECT id, title, gender, size_original, status FROM products');
    console.log("ALL PRODUCTS:");
    console.table(rows);
    process.exit(0);
}
test().catch(console.error);
