const fs = require('fs');

let wd = fs.readFileSync('src/components/MobileVoiceEditor.tsx', 'utf8');

// Fix the literal backslashes
wd = wd.replace("style={{ left: \\`-\\${(trimStartPct / (trimEnd - trimStartPct)) * 100}%\\`, width: \\`\\${(100 / (trimEnd - trimStartPct)) * 100}%\\` }}", "style={{ left: `-${(trimStartPct / (trimEnd - trimStartPct)) * 100}%`, width: `${(100 / (trimEnd - trimStartPct)) * 100}%` }}");

fs.writeFileSync('src/components/MobileVoiceEditor.tsx', wd);
console.log('Fixed backslashes');
