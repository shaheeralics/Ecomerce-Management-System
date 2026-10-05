const fs = require('fs');
let wd = fs.readFileSync('src/components/WhatsAppDashboard.tsx', 'utf8');

wd = wd.replace(/from \\'lucide-react\\';/, "from 'lucide-react';");

fs.writeFileSync('src/components/WhatsAppDashboard.tsx', wd);
console.log('Fixed backslash error');
