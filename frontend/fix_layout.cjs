const fs = require('fs');

let wd = fs.readFileSync('src/components/WhatsAppDashboard.tsx', 'utf8');

// Fix Desktop container
wd = wd.replace(
    '<div className="flex-1 overflow-y-auto custom-scrollbar relative bg-[#030712]">',
    '<div className={`flex-1 ${activeTab === \\\'conversations\\\' ? \\\'overflow-hidden flex flex-col\\\' : \\\'overflow-y-auto custom-scrollbar\\\'} relative bg-[#030712]`}>'
);

// Fix Mobile container
wd = wd.replace(
    '<div className="flex-1 overflow-y-auto w-full custom-scrollbar pt-2 pb-[85px]">',
    '<div className={`flex-1 ${subTab === \\\'conversations\\\' ? \\\'overflow-hidden flex flex-col\\\' : \\\'overflow-y-auto custom-scrollbar pt-2\\\'} w-full pb-[85px]`}>'
);

fs.writeFileSync('src/components/WhatsAppDashboard.tsx', wd);
console.log('Fixed WhatsAppDashboard containers for LiveConversations');
