const fs = require('fs');
let wd = fs.readFileSync('src/components/WhatsAppDashboard.tsx', 'utf8');

// The exact string in the file is:
// "... ChevronRight } ImageIcon,\r\n} from 'lucide-react';" (Windows line endings!)

wd = wd.replace(/\} ImageIcon,\r?\n\} from 'lucide-react';/, ', ImageIcon } from \\\'lucide-react\\\';');

fs.writeFileSync('src/components/WhatsAppDashboard.tsx', wd);
console.log('Fixed syntax error permanently');
