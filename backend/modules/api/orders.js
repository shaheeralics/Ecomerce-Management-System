const express = require('express');
const router = express.Router();
const db = require('../../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads/orders');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `order_${Date.now()}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/gif','image/webp','application/pdf','image/bmp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// GET single order with full details
// Note: GET /:id is defined after /customers/search to avoid param capture


// GET all orders (with search and filters) - kept here for single-file routing
router.get('/', async (req, res) => {
    try {
        const { search, status, payment } = req.query;
        let query = `
            SELECT o.*, 
                   COALESCE(o.custom_product_name, p.title) as product_title, 
                   p.main_image_url,
                   p.minimum_price
            FROM orders o
            LEFT JOIN products p ON o.product_id = p.id
            WHERE 1=1
        `;
        const params = [];
        if (search) {
            query += ' AND (o.id LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status && status !== 'all') {
            query += ' AND LOWER(o.status) = ?';
            params.push(status.toLowerCase());
        } else {
            query += ' AND (LOWER(o.status) != ? OR o.status IS NULL)';
            params.push('trashed');
        }
        if (payment && payment !== 'all') {
            query += ' AND o.payment_status = ?';
            params.push(payment);
        }
        query += ' ORDER BY o.created_at DESC LIMIT 100';
        
        const [rows] = await db.query(query, params);
        const [statsRows] = await db.query('SELECT status, price FROM orders');
        const stats = {
            total: statsRows.filter(r => (r.status||'').toLowerCase() !== 'trashed').length,
            revenue: statsRows.filter(r => (r.status||'').toLowerCase() !== 'trashed' && (r.status||'').toLowerCase() !== 'cancelled').reduce((sum, r) => sum + (parseFloat(r.price) || 0), 0),
            pending: statsRows.filter(r => (r.status||'').toLowerCase() === 'pending').length,
            processing: statsRows.filter(r => ['processing', 'shipped', 'confirmed'].includes((r.status||'').toLowerCase())).length,
            delivered: statsRows.filter(r => (r.status||'').toLowerCase() === 'delivered').length,
            cancelled: statsRows.filter(r => (r.status||'').toLowerCase() === 'cancelled').length
        };
        res.json({ success: true, data: rows, stats });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch orders' });
    }
});

// POST create order
router.post('/', async (req, res) => {
    const { 
        conversation_id, product_id, custom_product_name, customer_name, customer_phone, 
        address, city, zip_code, price, status, payment_status, payment_method, 
        delivery_method, delivery_fee, items 
    } = req.body;
    
    const initialStatus = status || 'Pending';
    const initialTimeline = JSON.stringify([{ status: initialStatus, timestamp: new Date().toISOString(), description: 'Order has been created successfully.' }]);
    
    try {
        const [result] = await db.execute(`
            INSERT INTO orders (
                conversation_id, product_id, custom_product_name, customer_name, customer_phone, 
                address, city, zip_code, price, status, payment_status, payment_method, 
                delivery_method, delivery_fee, items, timeline
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            conversation_id || null, product_id || null, custom_product_name || null, 
            customer_name, customer_phone, address || '', city || '', zip_code || '', 
            price || 0, initialStatus, payment_status || 'Pending', payment_method || 'COD', 
            delivery_method || 'Standard', delivery_fee || 0, 
            items ? JSON.stringify(items) : JSON.stringify([]), 
            initialTimeline
        ]);
        
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ success: false, error: 'Failed to create order' });
    }
});

// PUT update order
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { status, customer_name, customer_phone, address, city, zip_code, price, payment_status, payment_method, delivery_method, delivery_fee, customer_note, items } = req.body;
    
    try {
        const [rows] = await db.execute('SELECT status, timeline FROM orders WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ success: false, error: 'Order not found' });
        
        let currentStatus = rows[0].status;
        let timeline = typeof rows[0].timeline === 'string' ? JSON.parse(rows[0].timeline) : (rows[0].timeline || []);
        
        const STATUS_DESCRIPTIONS = {
            'Pending': 'Awaiting confirmation.',
            'Confirmed': 'Order has been confirmed.',
            'Processing': 'Order is being processed.',
            'Shipped': 'Order has been shipped.',
            'Delivered': 'Order has been delivered.',
            'Cancelled': 'Order was cancelled.',
        };
        
        if (status && status !== currentStatus) {
            timeline.push({ 
                status, 
                timestamp: new Date().toISOString(),
                description: STATUS_DESCRIPTIONS[status] || `Status updated to ${status}.`
            });
        }
        
        await db.execute(`
            UPDATE orders 
            SET status = COALESCE(?, status), 
                customer_name = COALESCE(?, customer_name),
                customer_phone = COALESCE(?, customer_phone),
                address = COALESCE(?, address), 
                city = COALESCE(?, city), 
                zip_code = COALESCE(?, zip_code), 
                price = COALESCE(?, price),
                payment_status = COALESCE(?, payment_status),
                payment_method = COALESCE(?, payment_method),
                delivery_method = COALESCE(?, delivery_method),
                delivery_fee = COALESCE(?, delivery_fee),
                customer_note = COALESCE(?, customer_note),
                items = COALESCE(?, items),
                timeline = ?
            WHERE id = ?
        `, [
            status ?? null, customer_name ?? null, customer_phone ?? null, address ?? null, city ?? null, zip_code ?? null, price ?? null, 
            payment_status ?? null, payment_method ?? null, delivery_method ?? null, delivery_fee ?? null,
            customer_note ?? null, items ? JSON.stringify(items) : null,
            JSON.stringify(timeline), id
        ]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ success: false, error: 'Failed to update order' });
    }
});

// DELETE order
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute('DELETE FROM orders WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ success: false, error: 'Failed to delete order' });
    }
});

// GET customer search
router.get('/customers/search', async (req, res) => {
    try {
        const search = req.query.q || '';
        const [rows] = await db.query(`
            SELECT DISTINCT customer_name, customer_phone, address, city, zip_code 
            FROM orders 
            WHERE customer_name LIKE ? OR customer_phone LIKE ?
            LIMIT 20
        `, [`%${search}%`, `%${search}%`]);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Customer search error:', err);
        res.status(500).json({ success: false });
    }
});

// GET orders by customer phone
router.get('/customers/:phone/orders', async (req, res) => {
    try {
        const phone = req.params.phone;
        const [rows] = await db.execute(`
            SELECT o.*, p.title as product_title, p.main_image_url 
            FROM orders o 
            LEFT JOIN products p ON o.product_id = p.id 
            WHERE o.customer_phone = ? 
            ORDER BY o.created_at DESC
        `, [phone]);
        res.json({ success: true, data: rows });
    } catch (e) {
        console.error('Failed to fetch customer orders:', e);
        res.status(500).json({ error: 'Failed to fetch customer orders' });
    }
});

// GET single order with full details (must be after /customers/search)
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT o.*, 
                COALESCE(o.custom_product_name, p.title) as product_title,
                p.main_image_url,
                p.minimum_price
             FROM orders o
             LEFT JOIN products p ON o.product_id = p.id
             WHERE o.id = ?`,
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, error: 'Order not found' });

        const [notes] = await db.execute(
            'SELECT * FROM order_notes WHERE order_id = ? ORDER BY created_at DESC',
            [req.params.id]
        );
        const [attachments] = await db.execute(
            'SELECT * FROM order_attachments WHERE order_id = ? ORDER BY uploaded_at ASC',
            [req.params.id]
        );

        res.json({ success: true, data: { ...rows[0], notes, attachments } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to fetch order' });
    }
});

// ===== NOTES =====
// GET notes for order
router.get('/:id/notes', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT * FROM order_notes WHERE order_id = ? ORDER BY created_at DESC',
            [req.params.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// POST add note
router.post('/:id/notes', async (req, res) => {
    try {
        const { note } = req.body;
        if (!note || !note.trim()) return res.status(400).json({ success: false, error: 'Note is required' });
        const [result] = await db.execute(
            'INSERT INTO order_notes (order_id, note) VALUES (?, ?)',
            [req.params.id, note.trim()]
        );
        const [rows] = await db.execute('SELECT * FROM order_notes WHERE id = ?', [result.insertId]);
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// DELETE note
router.delete('/:id/notes/:noteId', async (req, res) => {
    try {
        await db.execute('DELETE FROM order_notes WHERE id = ? AND order_id = ?', [req.params.noteId, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// ===== ATTACHMENTS =====
// GET attachments
router.get('/:id/attachments', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT * FROM order_attachments WHERE order_id = ? ORDER BY uploaded_at ASC',
            [req.params.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// POST upload attachment
router.post('/:id/attachments', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

        const { type } = req.body; // 'payment_screenshot' | 'order_proof' | 'additional'
        const file_url = '/uploads/orders/' + req.file.filename;
        const file_name = req.file.originalname;
        const file_type = req.file.mimetype;
        
        const allowedTypes = ['payment_screenshot', 'order_proof', 'additional'];
        const attachmentType = allowedTypes.includes(type) ? type : 'additional';

        const [result] = await db.execute(
            'INSERT INTO order_attachments (order_id, type, file_url, file_name, file_type) VALUES (?, ?, ?, ?, ?)',
            [req.params.id, attachmentType, file_url, file_name, file_type]
        );
        const [rows] = await db.execute('SELECT * FROM order_attachments WHERE id = ?', [result.insertId]);
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE attachment
router.delete('/:id/attachments/:attachId', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT * FROM order_attachments WHERE id = ? AND order_id = ?',
            [req.params.attachId, req.params.id]
        );
        if (rows.length > 0) {
            const filePath = path.join(__dirname, '../../../', rows[0].file_url);
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch (e) {}
            }
            await db.execute('DELETE FROM order_attachments WHERE id = ?', [req.params.attachId]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// Legacy attachments route (payment_screenshot / delivery_proof columns)
router.post('/:id/legacy-attachments', upload.fields([
    { name: 'payment_screenshot', maxCount: 1 }, 
    { name: 'delivery_proof', maxCount: 1 }
]), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = {};
        if (req.files && req.files.payment_screenshot) {
            updates.payment_screenshot_url = '/uploads/orders/' + req.files.payment_screenshot[0].filename;
        }
        if (req.files && req.files.delivery_proof) {
            updates.delivery_proof_url = '/uploads/orders/' + req.files.delivery_proof[0].filename;
        }
        if (Object.keys(updates).length > 0) {
            const keys = Object.keys(updates);
            const values = Object.values(updates);
            let setClause = keys.map(k => k + ' = ?').join(', ');
            await db.execute('UPDATE orders SET ' + setClause + ' WHERE id = ?', [...values, id]);
        }
        res.json({ success: true, updates });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

module.exports = router;
