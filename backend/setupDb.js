require('dotenv').config();
const mysql = require('mysql2/promise');

async function setupDatabase() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'ecomerce_automation'
        });

        console.log('Connected to MySQL. Initializing tables...');

        // 1. API Settings
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS api_settings (
                id INT PRIMARY KEY DEFAULT 1,
                meta_token VARCHAR(255),
                meta_phone_id VARCHAR(255),
                meta_verify_token VARCHAR(255),
                meta_waba_id VARCHAR(255),
                meta_app_id VARCHAR(255),
                meta_app_secret VARCHAR(255),
                llm_api_key VARCHAR(255),
                shopify_url VARCHAR(255),
                shopify_token VARCHAR(255),
                shopify_webhook_secret VARCHAR(255),
                webhook_url VARCHAR(255)
            )
        `);
        await connection.execute(`INSERT IGNORE INTO api_settings (id) VALUES (1)`);

        // 2. Products
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                brand VARCHAR(255),
                gender VARCHAR(50) NOT NULL,
                size VARCHAR(50),
                size_original VARCHAR(50),
                size_uk VARCHAR(50),
                size_eu VARCHAR(50),
                size_cn VARCHAR(50),
                color VARCHAR(100),
                source VARCHAR(50) NOT NULL,
                main_image_url VARCHAR(1024),
                extra_image_urls JSON,
                video_url VARCHAR(1024),
                voice_note_url VARCHAR(1024),
                starting_price DECIMAL(10, 2) NOT NULL,
                minimum_price DECIMAL(10, 2) NOT NULL,
                status VARCHAR(50) DEFAULT 'available',
                shopify_product_id VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // 3. Conversations
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS conversations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_phone VARCHAR(50) NOT NULL UNIQUE,
                status VARCHAR(50) DEFAULT 'agent_active',
                known_slots JSON,
                selected_product_id INT,
                current_offer DECIMAL(10, 2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (selected_product_id) REFERENCES products(id) ON DELETE SET NULL
            )
        `);

        // 4. Messages
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                conversation_id INT NOT NULL,
                sender VARCHAR(50) NOT NULL,
                type VARCHAR(50) NOT NULL,
                text_content TEXT,
                media_url VARCHAR(1024),
                voice_transcript TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            )
        `);

        // 5. Agent Config
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS agent_config (
                id INT PRIMARY KEY DEFAULT 1,
                system_prompt TEXT NOT NULL
            )
        `);
        await connection.execute(`
            INSERT IGNORE INTO agent_config (id, system_prompt) 
            VALUES (1, 'You are a helpful AI assistant for Pawanda e-commerce.')
        `);

        console.log('All tables created successfully.');
        await connection.end();
    } catch (e) {
        console.error('Database setup failed:', e.message);
    }
}

setupDatabase();
