const fs = require('fs');
let lc = fs.readFileSync('src/components/LiveConversations.tsx', 'utf8');

// Add filteredConversations
if (!lc.includes('const filteredConversations')) {
    lc = lc.replace('    return (', `    const filteredConversations = conversations.filter(c => {
        if (filter === 'unread') return c.unread_count && c.unread_count > 0;
        if (filter === 'open') return c.status === 'bot_active';
        if (filter === 'closed') return c.status === 'human_takeover';
        return true;
    }).filter(c => {
        if (searchQuery) {
            const s = searchQuery.toLowerCase();
            return c.customer_phone.includes(s) || (c.customer_name && c.customer_name.toLowerCase().includes(s)) || (c.known_slots && JSON.stringify(c.known_slots).toLowerCase().includes(s));
        }
        return true;
    });

    return (`);
}

// Fix direction -> sender
lc = lc.replace(/msg\.direction === 'inbound'/g, "msg.sender === 'customer'");
lc = lc.replace(/msg\.direction === 'agent'/g, "msg.sender === 'agent'");

// Fix phone_number -> customer_phone
lc = lc.replace(/conv\.phone_number/g, "conv.customer_phone");

// Fix missing imports
if (!lc.includes('MessageSquare')) {
    lc = lc.replace('import {', 'import { MessageSquare, Video, Plus,');
}

fs.writeFileSync('src/components/LiveConversations.tsx', lc);

let op = fs.readFileSync('src/components/OrdersPage.tsx', 'utf8');
op = op.replace(/isFullScreen=\{true\}/g, '');
fs.writeFileSync('src/components/OrdersPage.tsx', op);

let wd = fs.readFileSync('src/components/WhatsAppDashboard.tsx', 'utf8');
wd = wd.replace(/product\.voice_note_url\)/g, 'product.voice_note_url as string)');
fs.writeFileSync('src/components/WhatsAppDashboard.tsx', wd);

console.log('Fixed TS errors');
