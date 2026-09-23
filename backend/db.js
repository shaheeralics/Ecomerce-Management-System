const mysql = require('mysql2/promise');

// Create a connection pool instead of a single connection to handle multiple requests concurrently
const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'ecomerce_automation',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
