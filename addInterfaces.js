const fs = require('fs');

const dashCode = fs.readFileSync('frontend/src/components/WhatsAppDashboard.tsx', 'utf8');

const audioClipStart = dashCode.indexOf('interface AudioTrackClip {');
const audioClipEnd = dashCode.indexOf('}', audioClipStart) + 1;
const audioClipInt = dashCode.substring(audioClipStart, audioClipEnd);

const timelineStart = dashCode.indexOf('interface TimelineState {');
const timelineEnd = dashCode.indexOf('}', timelineStart) + 1;
const timelineInt = dashCode.substring(timelineStart, timelineEnd);

let tabCode = fs.readFileSync('frontend/src/components/VoiceAssetsTab.tsx', 'utf8');
tabCode = tabCode.replace('interface VoiceAsset {', audioClipInt + '\\n\\n' + timelineInt + '\\n\\ninterface VoiceAsset {');

fs.writeFileSync('frontend/src/components/VoiceAssetsTab.tsx', tabCode);
console.log('Interfaces added');
