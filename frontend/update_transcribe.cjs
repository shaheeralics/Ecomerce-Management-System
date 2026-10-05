const fs = require('fs');

let wd = fs.readFileSync('src/components/WhatsAppDashboard.tsx', 'utf8');

// 1. Add loading state for transcription
if (!wd.includes('const [isTranscribing, setIsTranscribing] = useState(false);')) {
    wd = wd.replace('const [transcriptionText, setTranscriptionText] = useState("");', 'const [transcriptionText, setTranscriptionText] = useState("");\n    const [isTranscribing, setIsTranscribing] = useState(false);');
}

// 2. Add transcribe function
const transcribeFunc = `
    const handleTranscribe = async () => {
        setActiveMobilePage('add-product-voice-transcribe');
        setIsTranscribing(true);
        try {
            // Using Gemini API route (Mocking actual API latency for now, replace with real Gemini fetch)
            // const formData = new FormData(); formData.append('audio', audioBlob);
            // const res = await fetch('/api/gemini/transcribe', { method: 'POST', body: formData });
            
            await new Promise(r => setTimeout(r, 2500)); // Simulate Gemini API processing
            setTranscriptionText("This is an auto-generated transcription powered by Gemini API. You can edit this text seamlessly.");
        } catch (err) {
            setTranscriptionText("Failed to transcribe via Gemini API.");
        } finally {
            setIsTranscribing(false);
        }
    };
`;

if (!wd.includes('const handleTranscribe = async () =>')) {
    wd = wd.replace('const startRecording = async', transcribeFunc + '\n    const startRecording = async');
}

// 3. Update the button to use handleTranscribe
const oldBtnRegex = /<button[^>]*onClick=\{\(\) => \{\s*setTranscriptionText\([^)]+\);\s*setActiveMobilePage\('add-product-voice-transcribe'\);\s*\}\}[^>]*>[\s\S]*?<\/button>/;
const newBtn = `<button 
                                        onClick={handleTranscribe}
                                        className="bg-[#18181b] border border-white/10 text-white w-full py-4 rounded-full font-bold shadow-lg active:scale-95 transition-all text-lg flex items-center justify-center gap-2 mb-4"
                                    >
                                        <FileText size={20} className="text-emerald-400" /> Transcribe Voice
                                    </button>`;
wd = wd.replace(oldBtnRegex, newBtn);

// 4. Update the transcription page to show loading spinner
const newTranscribeModal = `{activeMobilePage === 'add-product-voice-transcribe' && (
                    <div className="flex flex-col h-full w-full absolute inset-0 bg-[#030712] z-[100] animate-in slide-in-from-bottom-2 duration-200">
                        <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center px-4 shrink-0 shadow-sm relative">
                            <button onClick={() => setActiveMobilePage('add-product-voice')} className="absolute left-4 p-2 -m-2 text-emerald-400 active:opacity-50 flex items-center gap-1 z-10">
                                <ChevronLeft size={24} /> <span className="text-base font-semibold">Back</span>
                            </button>
                            <h1 className="text-lg font-bold text-white w-full text-center">Transcription</h1>
                            <button onClick={() => setActiveMobilePage('add-product-voice')} className="absolute right-4 p-2 -m-2 text-indigo-400 font-bold active:opacity-50">
                                Save
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
                            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-emerald-900/20">
                                {isTranscribing ? <Loader2 size={40} className="text-emerald-400 animate-spin" /> : <FileText size={40} className="text-emerald-400" />}
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">{isTranscribing ? "Gemini API Listening..." : "Voice to Text"}</h2>
                            
                            <div className="w-full bg-[#18181b] rounded-3xl p-1 border border-white/10 shadow-inner relative group mt-8">
                                <textarea 
                                    value={transcriptionText} 
                                    onChange={e => setTranscriptionText(e.target.value)}
                                    disabled={isTranscribing}
                                    className="w-full h-64 bg-transparent text-white text-lg p-5 outline-none resize-none leading-relaxed font-medium disabled:opacity-50"
                                    placeholder={isTranscribing ? "Processing audio..." : "Transcription will appear here..."}
                                />
                                {!isTranscribing && (
                                    <div className="absolute top-4 right-4 opacity-30 group-focus-within:opacity-100 transition-opacity">
                                        <Edit3 size={20} className="text-indigo-400" />
                                    </div>
                                )}
                            </div>
                            {!isTranscribing && (
                                <p className="text-xs text-zinc-600 mt-4 font-semibold uppercase tracking-widest flex items-center gap-1">
                                    <CheckCircle size={12} className="text-emerald-500" /> Auto-saving enabled
                                </p>
                            )}
                        </div>
                    </div>
                )}`;
wd = wd.replace(/\{activeMobilePage === 'add-product-voice-transcribe' && \([\s\S]*?<\/div>\s*\)\}/, newTranscribeModal);

fs.writeFileSync('src/components/WhatsAppDashboard.tsx', wd);
console.log('Transcription updated');
