const fs = require('fs');
const file = 'frontend/src/components/WhatsAppDashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

const target = `            </div>\n        </div>\n    );\n}`;
const replacement = `                {/* ===== POLICY VOICES TAB ===== */}
                {subTab === 'policy' && (
                    <VoiceAssetsTab 
                        category="policy" 
                        title="Policy Voices" 
                        description="Manage standard policy audio clips (e.g., Shipping Policy, Return Policy) for AI Agent use." 
                    />
                )}

                {/* ===== PRERECORDED VOICES TAB ===== */}
                {subTab === 'prerecorded' && (
                    <VoiceAssetsTab 
                        category="prerecorded" 
                        title="Pre-recorded Voices" 
                        description="Manage casual pre-recorded voice notes for common FAQs and greetings." 
                    />
                )}
            </div>
        </div>
    );
}`;

// Handle CRLF or LF
const targetCRLF = target.replace(/\n/g, '\r\n');
if (code.includes(targetCRLF)) {
    code = code.replace(targetCRLF, replacement.replace(/\n/g, '\r\n'));
} else if (code.includes(target)) {
    code = code.replace(target, replacement);
} else {
    // If exact spacing fails, just use a regex
    code = code.replace(/(\s*)<\/div>(\s*)<\/div>(\s*)\);(\s*)};/, 
    \`$1    {/* ===== POLICY VOICES TAB ===== */}
                {subTab === 'policy' && (
                    <VoiceAssetsTab 
                        category="policy" 
                        title="Policy Voices" 
                        description="Manage standard policy audio clips (e.g., Shipping Policy, Return Policy) for AI Agent use." 
                    />
                )}

                {/* ===== PRERECORDED VOICES TAB ===== */}
                {subTab === 'prerecorded' && (
                    <VoiceAssetsTab 
                        category="prerecorded" 
                        title="Pre-recorded Voices" 
                        description="Manage casual pre-recorded voice notes for common FAQs and greetings." 
                    />
                )}$1</div>$2</div>$3);$4};\`);
}

fs.writeFileSync(file, code);
console.log('Patched');
