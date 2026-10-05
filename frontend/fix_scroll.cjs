const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');
if (!css.includes('overflow-x: hidden')) {
    css += '\nbody {\n  overflow-x: hidden;\n  overscroll-behavior-x: none;\n}\n';
    fs.writeFileSync('src/index.css', css);
    console.log('Added overflow-x constraints');
}
