const fs = require('fs');
const file = 'frontend/src/components/WhatsAppDashboard.tsx';
let lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

// Find the last </div> before the end
let injectIndex = -1;
for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('            </div>') && lines[i+1].includes('        </div>')) {
        injectIndex = i;
        break;
    }
}

if (injectIndex !== -1) {
    const injection = [
        "                {/* ===== POLICY VOICES TAB ===== */}",
        "                {subTab === 'policy' && (",
        "                    <VoiceAssetsTab ",
        "                        category=\"policy\" ",
        "                        title=\"Policy Voices\" ",
        "                        description=\"Manage standard policy audio clips (e.g., Shipping Policy, Return Policy) for AI Agent use.\" ",
        "                    />",
        "                )}",
        "",
        "                {/* ===== PRERECORDED VOICES TAB ===== */}",
        "                {subTab === 'prerecorded' && (",
        "                    <VoiceAssetsTab ",
        "                        category=\"prerecorded\" ",
        "                        title=\"Pre-recorded Voices\" ",
        "                        description=\"Manage casual pre-recorded voice notes for common FAQs and greetings.\" ",
        "                    />",
        "                )}"
    ];
    
    // insert right after </div> which is at injectIndex
    lines.splice(injectIndex + 1, 0, ...injection);
    fs.writeFileSync(file, lines.join('\\n'));
    console.log('Successfully injected lines');
} else {
    console.log('Could not find injection point');
}
