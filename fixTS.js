const fs = require('fs');
let content = fs.readFileSync('frontend/src/components/WhatsAppDashboard.tsx', 'utf8');

content = content.replace(
  'Array.from(productImages).map((file, i) => (',
  'productImages.map((img, i) => ('
);

content = content.replace(
  '<img src={URL.createObjectURL(file)} className="w-full h-full object-cover" />',
  '<img src={img.url} className="w-full h-full object-cover" />'
);

content = content.replace(
  'Loader2 size={16}',
  'Loader2 size={16} as any'
); // Fix if Loader2 isn't imported, but actually I used loading spinner CSS instead.

fs.writeFileSync('frontend/src/components/WhatsAppDashboard.tsx', content);
