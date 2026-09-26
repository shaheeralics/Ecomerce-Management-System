const express = require('express');
const router = express.Router();
const db = require('../../db');

// Helper to filter dates
const getDateCondition = (range, startDate, endDate) => {
    if (startDate && endDate) {
        // Prevent SQL injection by strictly validating ISO dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            return `created_at >= '${start.toISOString().split('T')[0]} 00:00:00' AND created_at <= '${end.toISOString().split('T')[0]} 23:59:59'`;
        }
    }
    
    switch(range) {
        case 'today': return "DATE(created_at) = CURDATE()";
        case 'yesterday': return "DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
        case 'last7days': return "created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        case 'last30days': return "created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        case 'thismonth': return "YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())";
        case 'lastmonth': return "YEAR(created_at) = YEAR(CURRENT_DATE - INTERVAL 1 MONTH) AND MONTH(created_at) = MONTH(CURRENT_DATE - INTERVAL 1 MONTH)";
        case 'thisyear': return "YEAR(created_at) = YEAR(CURDATE())";
        default: return "1=1"; // all time fallback
    }
};

// Helper to get previous date range condition
const getPrevDateCondition = (range, startDate, endDate) => {
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const prevEnd = new Date(start.getTime() - (1000 * 60 * 60 * 24));
        const prevStart = new Date(prevEnd.getTime() - (diffDays * 1000 * 60 * 60 * 24));
        
        return `created_at >= '${prevStart.toISOString().split('T')[0]} 00:00:00' AND created_at <= '${prevEnd.toISOString().split('T')[0]} 23:59:59'`;
    }
    
    switch(range) {
        case 'today': return "DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)"; // yesterday
        case 'yesterday': return "DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 2 DAY)";
        case 'last7days': return "created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)";
        case 'last30days': return "created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)";
        case 'thismonth': return "YEAR(created_at) = YEAR(CURRENT_DATE - INTERVAL 1 MONTH) AND MONTH(created_at) = MONTH(CURRENT_DATE - INTERVAL 1 MONTH)";
        case 'lastmonth': return "YEAR(created_at) = YEAR(CURRENT_DATE - INTERVAL 2 MONTH) AND MONTH(created_at) = MONTH(CURRENT_DATE - INTERVAL 2 MONTH)";
        case 'thisyear': return "YEAR(created_at) = YEAR(CURRENT_DATE - INTERVAL 1 YEAR)";
        default: return "1=0"; // all time has no previous
    }
};

// GET master analytics
router.get('/', async (req, res) => {
    try {
        const range = req.query.range || 'last30days';
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        
        const dateCond = getDateCondition(range, startDate, endDate);
        const prevDateCond = getPrevDateCondition(range, startDate, endDate);
        
        // We will do a robust set of queries to pull analytics based on orders
        
        // 1. KPI Cards
        const [[{ total_revenue, total_orders }]] = await db.query(`
            SELECT 
                SUM(price + IFNULL(delivery_fee, 0)) as total_revenue,
                COUNT(id) as total_orders
            FROM orders 
            WHERE ${dateCond} AND status != 'Cancelled'
        `);
        
        const [[{ active_customers }]] = await db.query(`
            SELECT COUNT(DISTINCT customer_phone) as active_customers
            FROM orders
            WHERE ${dateCond}
        `);
        
        const [[{ total_completed }]] = await db.query(`
            SELECT COUNT(id) as total_completed
            FROM orders
            WHERE ${dateCond} AND status IN ('Shipped', 'Delivered')
        `);

        const [[{ total_conversations }]] = await db.query(`
            SELECT COUNT(id) as total_conversations
            FROM conversations
            WHERE ${dateCond}
        `);

        // Average Order Value
        const aov = total_orders > 0 ? (total_revenue || 0) / total_orders : 0;
        const conversion_rate = total_conversations > 0 ? (total_orders / total_conversations) * 100 : null;
        
        // --- Previous Period KPIs ---
        const [[{ total_revenue: prev_revenue, total_orders: prev_orders }]] = await db.query(`
            SELECT 
                SUM(price + IFNULL(delivery_fee, 0)) as total_revenue,
                COUNT(id) as total_orders
            FROM orders 
            WHERE ${prevDateCond} AND status != 'Cancelled'
        `);
        
        const [[{ active_customers: prev_customers }]] = await db.query(`
            SELECT COUNT(DISTINCT customer_phone) as active_customers
            FROM orders
            WHERE ${prevDateCond}
        `);
        
        const [[{ total_completed: prev_completed }]] = await db.query(`
            SELECT COUNT(id) as total_completed
            FROM orders
            WHERE ${prevDateCond} AND status IN ('Shipped', 'Delivered')
        `);

        const [[{ total_conversations: prev_conversations }]] = await db.query(`
            SELECT COUNT(id) as total_conversations
            FROM conversations
            WHERE ${prevDateCond}
        `);
        
        const prev_aov = prev_orders > 0 ? (prev_revenue || 0) / prev_orders : 0;
        const prev_conversion_rate = prev_conversations > 0 ? (prev_orders / prev_conversations) * 100 : null;
        
        const calcChange = (curr, prev) => {
            if (!prev) return curr ? 100 : 0;
            return (((curr - prev) / prev) * 100).toFixed(1);
        };
        
        const changes = {
            revenue: calcChange(total_revenue || 0, prev_revenue || 0),
            orders: calcChange(total_orders || 0, prev_orders || 0),
            customers: calcChange(active_customers || 0, prev_customers || 0),
            aov: calcChange(aov, prev_aov),
            conversion: calcChange(conversion_rate, prev_conversion_rate)
        };
        // ------------------------------
        
        // 2. Orders by Status
        const [statusData] = await db.query(`
            SELECT status as name, COUNT(id) as value
            FROM orders
            WHERE ${dateCond}
            GROUP BY status
        `);
        
        // 3. Payment Methods
        const [paymentData] = await db.query(`
            SELECT payment_method as name, COUNT(id) as value
            FROM orders
            WHERE ${dateCond}
            GROUP BY payment_method
        `);
        
        // 4. Top Customer Locations
        const [locationData] = await db.query(`
            SELECT city as name, COUNT(id) as value
            FROM orders
            WHERE ${dateCond} AND city IS NOT NULL AND city != ''
            GROUP BY city
            ORDER BY value DESC
            LIMIT 5
        `);
        
        // 5. Daily Trend (Orders & Revenue)
        const [trendData] = await db.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(id) as orders,
                COUNT(DISTINCT customer_phone) as customers,
                SUM(IF(status IN ('Shipped', 'Delivered'), 1, 0)) as deliveredOrders,
                SUM(IF(status != 'Cancelled', price + IFNULL(delivery_fee, 0), 0)) as revenue
            FROM orders
            WHERE ${dateCond}
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) ASC
        `);
        
        // 6. Top Selling Products
        // Need to parse JSON items from orders. Since MySQL JSON functions are limited for nested arrays across rows in group by,
        // we'll fetch raw orders and aggregate in JS.
        const [itemsRows] = await db.query(`
            SELECT items 
            FROM orders
            WHERE ${dateCond} AND status != 'Cancelled'
        `);
        
        const [products] = await db.query(`SELECT id, gender, brand FROM products`);
        const productMap = {};
        products.forEach(p => productMap[p.id] = p);

        const productStats = {};
        const categoryStats = {};

        itemsRows.forEach(row => {
            try {
                const items = JSON.parse(row.items);
                items.forEach(item => {
                    const id = item.product_id || item.product_name; // fallback to name if ID missing
                    const prod = productMap[id] || {};
                    const catName = prod.gender || prod.brand || 'Others';

                    if(!productStats[id]) {
                        productStats[id] = {
                            id: id,
                            name: item.product_name || item.title || 'Unknown',
                            image: item.product_image || item.main_image_url || null,
                            units_sold: 0,
                            revenue: 0
                        };
                    }
                    productStats[id].units_sold += parseInt(item.quantity || 1);
                    productStats[id].revenue += parseInt(item.quantity || 1) * parseFloat(item.unit_price || 0);

                    if (!categoryStats[catName]) categoryStats[catName] = 0;
                    categoryStats[catName] += parseInt(item.quantity || 1) * parseFloat(item.unit_price || 0);
                });
            } catch(e) {}
        });
        
        const topProducts = Object.values(productStats).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
        
        // 7. Sales by Category
        const categoryData = Object.keys(categoryStats).map(name => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value: categoryStats[name]
        })).sort((a, b) => b.value - a.value).slice(0, 6);

        // 8. Customer Growth
        const customerGrowthData = trendData.map(d => ({
            date: d.date,
            customers: d.customers
        }));

        // 9. Orders Trend (New vs Delivered)
        const ordersTrendData = trendData.map(d => ({
            date: d.date,
            newOrders: d.orders,
            deliveredOrders: d.deliveredOrders
        }));
        console.log("SENDING KPI CHANGES:", changes);
        res.json({
            success: true,
            data: {
                kpi: {
                    totalRevenue: parseFloat(total_revenue || 0),
                    totalOrders: total_orders || 0,
                    activeCustomers: active_customers || 0,
                    aov: parseFloat((aov || 0).toFixed(2)),
                    conversionRate: parseFloat((conversion_rate || 0).toFixed(1)),
                    changes
                },
                statusDistribution: statusData,
                paymentMethods: paymentData,
                locations: locationData,
                trend: trendData,
                topProducts: topProducts,
                categorySales: categoryData,
                customerGrowth: customerGrowthData,
                ordersTrend: ordersTrendData
            }
        });

    } catch (err) {
        console.error('Analytics error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
    }
});

module.exports = router;
