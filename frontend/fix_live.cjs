const fs = require('fs');
let lc = fs.readFileSync('src/components/LiveConversations.tsx', 'utf8');
let lcLines = lc.split('\n');

// The main old UI starts at line 174, new UI starts at line 446.
// In 0-indexed, line 174 is index 173. Line 446 is index 445.
// We need to delete lines from index 173 to index 444 (inclusive).

lcLines.splice(173, 445 - 173);

fs.writeFileSync('src/components/LiveConversations.tsx', lcLines.join('\n'));
console.log('Deleted old UI from LiveConversations');
