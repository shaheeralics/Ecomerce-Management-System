const fs = require('fs');

let wd = fs.readFileSync('src/components/WhatsAppDashboard.tsx', 'utf8');

wd = wd.replace('} ImageIcon,\n} from \\\'lucide-react\\\';', ', ImageIcon } from \\\'lucide-react\\\';');

fs.writeFileSync('src/components/WhatsAppDashboard.tsx', wd);
console.log('Fixed syntax error');
