const fs = require('fs');
let content = fs.readFileSync('frontend/src/components/AnalyticsPage.tsx', 'utf8');

// Replace teal/emerald colors with clean white/black/indigo styling
content = content.replace(/border-teal-900\/40/g, 'border-white/5');
content = content.replace(/border-teal-900\/50/g, 'border-white/5');
content = content.replace(/bg-\[#09181E\]/g, 'bg-[#18181b]');
content = content.replace(/bg-\[#0b1426\]/g, 'bg-[#09090b]');
content = content.replace(/text-teal-400/g, 'text-zinc-400');
content = content.replace(/bg-teal-600/g, 'bg-indigo-600');
content = content.replace(/hover:bg-teal-500/g, 'hover:bg-indigo-500');

// Fix numbers cutting off on mobile
content = content.replace(/className="text-base md:text-xl font-bold text-white truncate"/g, 'className="text-lg md:text-xl font-bold text-white tracking-tight"');

// Fix headers that had "text-base md:text-lg md:text-2xl"
content = content.replace(/text-base md:text-lg md:text-2xl font-bold text-white tracking-tight/g, 'hidden md:block text-2xl font-bold text-white tracking-tight');

fs.writeFileSync('frontend/src/components/AnalyticsPage.tsx', content);
console.log('Fixed Analytics UI');
