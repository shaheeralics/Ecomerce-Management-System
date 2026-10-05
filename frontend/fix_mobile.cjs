const fs = require('fs');

let lc = fs.readFileSync('src/components/LiveConversations.tsx', 'utf8');

const block = `        const filteredConversations = conversations.filter((c: any) => {
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
    });`;

lc = lc.replace(block + '\n', '');
lc = lc.replace(/filteredConversations/g, 'filteredConvs');
fs.writeFileSync('src/components/LiveConversations.tsx', lc);

let wd = fs.readFileSync('src/components/WhatsAppDashboard.tsx', 'utf8');
wd = wd.replace(/<h1 className="text-lg font-bold tracking-tight text-white capitalize w-full text-center">Menu<\/h1>/g, '');
wd = wd.replace(/<h1 className="text-lg font-bold tracking-tight text-white w-full text-center">\{editingProduct \? 'Edit Product' : 'New Product'\}<\/h1>/g, '');
fs.writeFileSync('src/components/WhatsAppDashboard.tsx', wd);

console.log('Fixed LiveConvs and removed Menu header');
