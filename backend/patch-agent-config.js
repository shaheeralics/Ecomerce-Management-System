const db = require('./db');

async function patch() {
    try {
        await db.execute('ALTER TABLE agent_config ADD COLUMN short_delay_seconds INT DEFAULT 5');
        console.log('Added short_delay_seconds');
    } catch (e) { console.log(e.message); }
    try {
        await db.execute('ALTER TABLE agent_config ADD COLUMN long_delay_seconds INT DEFAULT 30');
        console.log('Added long_delay_seconds');
    } catch (e) { console.log(e.message); }
    try {
        await db.execute('ALTER TABLE agent_config ADD COLUMN advance_amount INT DEFAULT 0');
        console.log('Added advance_amount');
    } catch (e) { console.log(e.message); }
    try {
        await db.execute('ALTER TABLE agent_config ADD COLUMN agent_enabled TINYINT(1) DEFAULT 1');
        console.log('Added agent_enabled');
    } catch (e) { console.log(e.message); }
    process.exit();
}

patch();
