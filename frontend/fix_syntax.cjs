const fs = require('fs');

let lc = fs.readFileSync('src/components/LiveConversations.tsx', 'utf8');
let lcLines = lc.split('\n');
let mainReturnIdx = lcLines.findIndex(l => l.includes('return ('));
let brokenStart = -1;
for (let i = mainReturnIdx - 1; i >= 0; i--) {
    if (lcLines[i].includes('messages.map') || lcLines[i].includes('loading && messages.length === 0') || lcLines[i].includes('<div className="flex-1 overflow-y-auto')) {
        brokenStart = i;
    } else if (lcLines[i].includes('export default function')) {
        break;
    }
}
if (brokenStart !== -1) {
    lcLines.splice(brokenStart, mainReturnIdx - brokenStart);
    fs.writeFileSync('src/components/LiveConversations.tsx', lcLines.join('\n'));
}

let ap = fs.readFileSync('src/components/AIAgentPanel.tsx', 'utf8');
ap = ap.replace(/    if \(\!configLoaded\) \{\n    const \[activeMobileView/g, '    const [activeMobileView');
fs.writeFileSync('src/components/AIAgentPanel.tsx', ap);

console.log('Fixed syntax errors');
