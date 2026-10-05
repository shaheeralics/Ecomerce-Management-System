const fs = require('fs');

let lc = fs.readFileSync('src/components/LiveConversations.tsx', 'utf8');

// 1. Fix possible substring crashes
lc = lc.replace(/conv\.customer_name\.substring/g, 'String(conv.customer_name).substring');
lc = lc.replace(/activeConv\.customer_name\.substring/g, 'String(activeConv.customer_name).substring');

// 2. Fix height collapse by adding min-h-screen and removing absolute inset-0 from the mobile chat list
lc = lc.replace(
    '<div className="h-full w-full bg-[#030712] text-zinc-100 flex font-sans overflow-hidden">',
    '<div className="h-full min-h-[100dvh] w-full bg-[#030712] text-zinc-100 flex font-sans overflow-hidden">'
);

lc = lc.replace(
    '<div className="absolute inset-0 flex flex-col w-full h-full bg-[#030712] overflow-hidden">',
    '<div className="flex flex-col w-full h-full bg-[#030712] overflow-hidden">'
);

// Just in case, add an error boundary approach conceptually if needed, but these fixes usually solve it.
// Also fix activeConv?.customer_name crashing if activeConv is null (handled by ?.)

fs.writeFileSync('src/components/LiveConversations.tsx', lc);
console.log('Fixed LiveConversations CSS and substring crashes');
