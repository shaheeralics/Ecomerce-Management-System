const fs = require('fs');

// 1. WhatsAppDashboard.tsx
let wd = fs.readFileSync('src/components/WhatsAppDashboard.tsx', 'utf8');
wd = wd.replace(/<h1 className="text-xl font-bold tracking-tight text-white capitalize flex items-center gap-2">[\s\S]*?<\/h1>/, '');
wd = wd.replace(/<div className="h-14 bg-\[#09090b\] border-b border-white\/5 flex items-center px-4 shrink-0 shadow-sm z-20">[\s\S]*?<\/div>/, '');
fs.writeFileSync('src/components/WhatsAppDashboard.tsx', wd);

// 2. AIAgentPanel.tsx
let ap = fs.readFileSync('src/components/AIAgentPanel.tsx', 'utf8');
ap = ap.replace(/<h3 className="font-bold text-white text-base">AI Agent Engine<\/h3>\s*<p className="text-xs text-zinc-500">Autonomous responses<\/p>/, '');
ap = ap.replace(/<h1 className="text-lg font-bold text-white">AI Agent Engine<\/h1>/, '');
fs.writeFileSync('src/components/AIAgentPanel.tsx', ap);

// 3. AnalyticsPage.tsx
let an = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');
an = an.replace(/<h3 className="hidden md:block text-2xl font-bold text-white tracking-tight">Analytics & Insights<\/h3>/, '');
fs.writeFileSync('src/components/AnalyticsPage.tsx', an);

console.log('Removed headers');
