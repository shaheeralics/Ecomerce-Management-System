const fs = require('fs');

let wd = fs.readFileSync('src/components/MobileVoiceEditor.tsx', 'utf8');

// Replace all instances of \` with `
wd = wd.replace(/\\`/g, '`');
// Replace all instances of \${ with ${
wd = wd.replace(/\\\${/g, '${');

fs.writeFileSync('src/components/MobileVoiceEditor.tsx', wd);
console.log('Fixed syntax errors');
