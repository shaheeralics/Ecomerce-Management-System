const fs = require('fs');

let app = fs.readFileSync('src/App.tsx', 'utf8');

// Hide navbar on mobile
app = app.replace('<nav className="bg-[#0A1A20]', '<nav className="hidden md:flex bg-[#0A1A20]');

fs.writeFileSync('src/App.tsx', app);
console.log('Fixed App.tsx mobile header');
