const fs = require('fs');

const addImports = (file, icons) => {
    let content = fs.readFileSync(file, 'utf8');
    const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/;
    const match = content.match(importRegex);
    if (match) {
        let existing = match[1].split(',').map(s => s.trim());
        icons.forEach(i => {
            if (!existing.includes(i)) existing.push(i);
        });
        const newImport = `import { ${existing.join(', ')} } from 'lucide-react'`;
        content = content.replace(importRegex, newImport);
        fs.writeFileSync(file, content);
    }
};

addImports('src/components/LiveConversations.tsx', ['MessageSquare', 'Video', 'Plus']);
addImports('src/components/AIAgentPanel.tsx', ['Pause', 'Play', 'Square', 'Bot', 'Trash2', 'Send', 'Mic', 'Save', 'Sparkles', 'ChevronLeft']);
addImports('src/components/WhatsAppDashboard.tsx', ['Menu', 'Plus', 'Camera', 'Play', 'Edit3', 'Trash2', 'Video', 'Volume2', 'ChevronLeft', 'ChevronRight', 'Mic', 'Square']);

console.log('Fixed imports');
