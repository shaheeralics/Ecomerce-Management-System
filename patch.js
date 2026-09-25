const fs = require('fs');
const file = 'frontend/src/components/WhatsAppDashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!code.includes('VoiceAssetsTab')) {
    code = code.replace("import React", "import VoiceAssetsTab from './VoiceAssetsTab';\nimport React");
}

// 2. Add icons
if (!code.includes('ShieldAlert')) {
    code = code.replace("Package,", "Package,\n    ShieldAlert,\n    Mic2,");
}

// 3. Update subTab state
code = code.replace(
    "const [subTab, setSubTab] = useState<'products' | 'conversations' | 'settings'>('products');",
    "const [subTab, setSubTab] = useState<'products' | 'conversations' | 'policy' | 'prerecorded'>('products');"
);

// 4. Add Sidebar items
const sidebarTarget = `                        <MessageSquare size={17} />
                        Live Conversations
                    </button>`;
const sidebarReplacement = `                        <MessageSquare size={17} />
                        Live Conversations
                    </button>
                    <button
                        onClick={() => setSubTab('policy')}
                        className={\`text-left px-4 py-3 rounded-xl font-medium text-xs transition-all flex items-center gap-3 \${subTab === 'policy' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30 font-semibold' : 'text-slate-400 hover:bg-teal-950/40 hover:text-slate-200'}\`}
                    >
                        <ShieldAlert size={17} />
                        Policy Voices
                    </button>
                    <button
                        onClick={() => setSubTab('prerecorded')}
                        className={\`text-left px-4 py-3 rounded-xl font-medium text-xs transition-all flex items-center gap-3 \${subTab === 'prerecorded' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30 font-semibold' : 'text-slate-400 hover:bg-teal-950/40 hover:text-slate-200'}\`}
                    >
                        <Mic2 size={17} />
                        Pre-recorded Voices
                    </button>`;

if (code.includes(sidebarTarget)) {
    code = code.replace(sidebarTarget, sidebarReplacement);
}

// 5. Add tabs in main content area
// There's a section:
//                 {/* ===== CONVERSATIONS TAB ===== */}
// and it ends before: 
//                 {/* ===== CONFIGURATION TAB ===== */} (which we deleted)
// Actually we can just inject it right before `            </div>`
// `        </div>`
// `    );`
// Wait, the main content area ends with:
// `            </div>`
// `        </div>`
// `    );`
// `};`
const mainContentInjectPoint = `            </div>
        </div>
    );
};`;
const tabsToInject = `
                {/* ===== POLICY VOICES TAB ===== */}
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
};`;

if (code.includes(mainContentInjectPoint)) {
    code = code.replace(mainContentInjectPoint, tabsToInject);
}

fs.writeFileSync(file, code);
console.log('Patched successfully');
