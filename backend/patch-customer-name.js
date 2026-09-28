const db = require('./db');

async function patch() {
    try {
        await db.execute('ALTER TABLE conversations ADD COLUMN customer_name VARCHAR(255) DEFAULT NULL AFTER customer_phone');
        console.log('✅ Added customer_name column to conversations table.');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('✅ customer_name column already exists. Skipping.');
        } else {
            console.error('❌ Failed to add customer_name column:', err);
        }
    }
    process.exit(0);
}

patch();
