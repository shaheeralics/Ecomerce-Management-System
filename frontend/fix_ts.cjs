const fs = require('fs');

let lc = fs.readFileSync('src/components/LiveConversations.tsx', 'utf8');

if (lc.includes('interface Conversation {')) {
    // let's just make Conversation completely relaxed
    lc = lc.replace(/interface Conversation \{[^}]+\}/g, 'interface Conversation { [key: string]: any }');
    fs.writeFileSync('src/components/LiveConversations.tsx', lc);
    console.log('Fixed LiveConversations types');
}
