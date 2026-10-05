const fs = require('fs');
let file = fs.readFileSync('src/components/LiveConversations.tsx', 'utf8');

file = file.replace(
    'return c.customer_phone.includes(s) || (c.customer_name && c.customer_name.toLowerCase().includes(s))',
    'const phone = c.customer_phone || c.phone_number || \\\'\\\';\\n            return phone.includes(s) || (c.customer_name && c.customer_name.toLowerCase().includes(s))'
);

fs.writeFileSync('src/components/LiveConversations.tsx', file);
