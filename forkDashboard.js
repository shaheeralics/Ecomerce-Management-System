const fs = require('fs');

const dashCode = fs.readFileSync('frontend/src/components/WhatsAppDashboard.tsx', 'utf8');

// The main component starts around line 133: const WhatsAppDashboard = () => {
const compStart = dashCode.indexOf('const WhatsAppDashboard = () => {');
const preComp = dashCode.substring(0, compStart);
let mainComp = dashCode.substring(compStart);

// 1. Rename Component
mainComp = mainComp.replace('const WhatsAppDashboard = () => {', 
    'export default function VoiceAssetsTab({ category, title, description }: { category: \'policy\' | \'prerecorded\', title: string, description: string }) {');

// Remove export default WhatsAppDashboard at the end
mainComp = mainComp.replace('export default WhatsAppDashboard;', '');

// 2. State & API logic replacements
// Replace products with voices
mainComp = mainComp.replace(/const \[products, setProducts\] = useState<Product\[\]>\(\[\]\);/g, 
    'const [voices, setVoices] = useState<any[]>([]);');

mainComp = mainComp.replace(/const fetchProducts = async /g, 'const fetchVoices = async ');
mainComp = mainComp.replace(/\/api\/products/g, '`/api/voices/${category}`');
mainComp = mainComp.replace(/setProducts\(/g, 'setVoices(');
mainComp = mainComp.replace(/fetchProducts\(/g, 'fetchVoices(');
mainComp = mainComp.replace(/products\.length/g, 'voices.length');
mainComp = mainComp.replace(/products\.some/g, 'voices.some');
mainComp = mainComp.replace(/products\.map/g, 'voices.map');
mainComp = mainComp.replace(/products\.filter/g, 'voices.filter');

// 3. Remove Sidebar and Keep Only the Grid + Modal
const contentStart = mainComp.indexOf('<div className="flex-1 p-8 bg-[#071317] overflow-auto">');
const modalStart = mainComp.indexOf('{showAddModal && (');
const modalEnd = mainComp.lastIndexOf('</div>\n                )}');

// We just extract the Grid and Modal parts
// Wait, the grid is under {/* ===== PRODUCTS TAB ===== */}
const gridStart = mainComp.indexOf('{/* ===== PRODUCTS TAB ===== */}');
const gridEnd = mainComp.indexOf('{/* ===== CONVERSATIONS TAB ===== */}');

let gridBlock = mainComp.substring(gridStart, gridEnd);
gridBlock = gridBlock.replace('{subTab === \'products\' && (', '');
gridBlock = gridBlock.replace(')}', ''); // be careful

// We can just regex replace the specific UI parts in gridBlock.
gridBlock = gridBlock.replace('Products Catalog', '{title}');
gridBlock = gridBlock.replace('Manage your eCommerce products and AI configurations.', '{description}');
gridBlock = gridBlock.replace('Add New Product', 'Add Voice');

// Fix mapping
gridBlock = gridBlock.replace(/product\./g, 'voice.');
gridBlock = gridBlock.replace(/products\.map\(\(voice\) => \(/g, 'voices.map((voice) => (');

// Remove image in grid, replace with audio
const imgRegex = /<div className="aspect-square bg-\[#050D10\].*?<\/div>/s;
gridBlock = gridBlock.replace(imgRegex, 
    \`{voice.voice_url && (
        <audio src={voice.voice_url} controls className="w-full h-10 custom-audio-player mt-2 mb-2" />
    )}\`
);

// We need to inject Transcription and Usage instructions instead of Price/Description
gridBlock = gridBlock.replace(/{voice\.description}/g, '{voice.usage_instructions || "No instructions"}');
gridBlock = gridBlock.replace(/<span className="text-teal-400 font-bold">\${voice\.price}<\/span>/g, '');

const finalJSX = \`
    return (
        <div className="h-full w-full">
            \${gridBlock}
        </div>
    );
}
\`;

// Replace the return block in mainComp
const returnStart = mainComp.indexOf('return (');
mainComp = mainComp.substring(0, returnStart) + finalJSX;

// Replace Phase 2 with Phase 3 (skip Phase 2)
mainComp = mainComp.replace(/setActivePhase\(2\)/g, 'setActivePhase(3)');

fs.writeFileSync('frontend/src/components/VoiceAssetsTab.tsx', preComp + '\\n' + mainComp);
console.log('VoiceAssetsTab.tsx forked from WhatsAppDashboard');
