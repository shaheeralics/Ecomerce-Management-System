const fs = require('fs');
const content = fs.readFileSync('frontend/src/components/WhatsAppDashboard.tsx', 'utf8');
const lines = content.split('\n');

let mainReturnLine = -1;
for (let i = 1500; i < lines.length; i++) {
    if (lines[i].includes('return (') && lines[i+1] && lines[i+1].includes('<div className="h-full w-full')) {
        mainReturnLine = i;
        break;
    }
}

if (mainReturnLine !== -1) {
    const logicLines = lines.slice(0, mainReturnLine);
    const newUIPart = fs.readFileSync('NewUI.tsx.part', 'utf8');
    
    fs.writeFileSync('frontend/src/components/WhatsAppDashboard.tsx', logicLines.join('\n') + '\n' + newUIPart);
    console.log('Successfully replaced WhatsAppDashboard.tsx UI!');
} else {
    console.log('Error finding main return line.');
}
