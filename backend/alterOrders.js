require('dotenv').config();
const mysql = require('mysql2/promise');

async function alterDb() {
    console.log('Connecting to MySQL to alter table...');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });

    try {
        await connection.execute(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS conversation_id INT,
            ADD COLUMN IF NOT EXISTS product_id INT,
            ADD COLUMN IF NOT EXISTS custom_product_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS address TEXT,
            ADD COLUMN IF NOT EXISTS city VARCHAR(100),
            ADD COLUMN IF NOT EXISTS zip_code VARCHAR(50),
            ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'Pending',
            ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'COD',
            ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(100) DEFAULT 'Standard',
            ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS timeline JSON,
            ADD COLUMN IF NOT EXISTS payment_screenshot_url VARCHAR(500),
            ADD COLUMN IF NOT EXISTS delivery_proof_url VARCHAR(500),
            ADD COLUMN IF NOT EXISTS customer_note TEXT
        `);
        console.log('Successfully altered orders table.');
    } catch (err) {
        console.error('Error altering table:', err.message);
        
        // MariaDB < 10.2.8 does not support IF NOT EXISTS in ALTER TABLE.
        // If it fails because of that or duplicate column, we can do it one by one and ignore duplicate errors.
        console.log('Trying individual alters...');
        const columns = [
            'ADD COLUMN conversation_id INT',
            'ADD COLUMN product_id INT',
            'ADD COLUMN custom_product_name VARCHAR(255)',
            'ADD COLUMN address TEXT',
            'ADD COLUMN city VARCHAR(100)',
            'ADD COLUMN zip_code VARCHAR(50)',
            'ADD COLUMN price DECIMAL(10,2) DEFAULT 0',
            'ADD COLUMN payment_status VARCHAR(50) DEFAULT "Pending"',
            'ADD COLUMN payment_method VARCHAR(50) DEFAULT "COD"',
            'ADD COLUMN delivery_method VARCHAR(100) DEFAULT "Standard"',
            'ADD COLUMN delivery_fee DECIMAL(10,2) DEFAULT 0',
            'ADD COLUMN timeline JSON',
            'ADD COLUMN payment_screenshot_url VARCHAR(500)',
            'ADD COLUMN delivery_proof_url VARCHAR(500)',
            'ADD COLUMN customer_note TEXT'
        ];
        
        for (const col of columns) {
            try {
                await connection.execute(`ALTER TABLE orders ${col}`);
            } catch (e) {
                if (e.code !== 'ER_DUP_FIELDNAME') {
                    console.error('Failed to add column:', col, e.message);
                }
            }
        }
        console.log('Individual alters completed.');
    } finally {
        await connection.end();
    }
}

alterDb();
