const fs = require('fs');
let wd = fs.readFileSync('src/components/WhatsAppDashboard.tsx', 'utf8');

// Fix ImageIcon import
if (!wd.includes('ImageIcon,')) {
    wd = wd.replace("from 'lucide-react';", "ImageIcon,\n} from 'lucide-react';");
}

fs.writeFileSync('src/components/WhatsAppDashboard.tsx', wd);
console.log('Fixed ImageIcon import');
