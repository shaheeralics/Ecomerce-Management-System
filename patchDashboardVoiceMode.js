const fs = require('fs');

let dashCode = fs.readFileSync('frontend/src/components/WhatsAppDashboard.tsx', 'utf8');

// 1. Add Voices State and isVoiceMode
const stateInjection = \`
    const [voices, setVoices] = useState<any[]>([]);
    const isVoiceMode = subTab === 'policy' || subTab === 'prerecorded';
\`;
dashCode = dashCode.replace(
    'const [products, setProducts] = useState<Product[]>([]);',
    'const [products, setProducts] = useState<Product[]>([]);' + stateInjection
);

// 2. Add Voice Functions
const voiceFunctions = \`
    const fetchVoices = async (silentMerge = false) => {
        if (!silentMerge) setLoading(true);
        try {
            const category = subTab;
            const res = await fetch(\\\`/api/voices/\\\${category}?_t=\\\${Date.now()}\\\`);
            const data = await res.json();
            if (data.success) {
                if (silentMerge) {
                    setVoices(prev => {
                        const merged = data.data.map((dbV: any) => {
                            const loc = prev.find((p: any) => p.id === dbV.id);
                            if (loc && dbV.status === 'uploading') {
                                return { ...dbV, voice_url: dbV.voice_url || loc.voice_url };
                            }
                            return dbV;
                        });
                        const optimistic = prev.filter((p: any) => p.id < 0);
                        return [...optimistic, ...merged];
                    });
                } else {
                    setVoices(data.data);
                }
            }
        } catch (err) {}
        if (!silentMerge) setLoading(false);
    };

    useEffect(() => {
        if (isVoiceMode) fetchVoices();
    }, [subTab]);

    useEffect(() => {
        if (!isVoiceMode) return;
        const hasUploading = voices.some((v: any) => v.status === 'uploading');
        if (!hasUploading) return;
        const interval = setInterval(() => fetchVoices(true), 3000);
        return () => clearInterval(interval);
    }, [voices, subTab, isVoiceMode]);

    const submitVoice = () => {
        if (!formData.title || !audioBlob) return alert('Title and Audio required');
        const tempId = -Date.now();
        const category = subTab;
        const tempVoice = {
            id: tempId,
            category,
            title: formData.title,
            usage_instructions: formData.description,
            transcription: formData.brand, // reusing brand for transcription to save adding state to formData
            voice_url: audioPreviewUrl,
            status: 'uploading'
        };
        setVoices(prev => [tempVoice, ...prev]);
        setShowAddModal(false);

        const fd = new FormData();
        fd.append('title', formData.title);
        fd.append('usage_instructions', formData.description);
        fd.append('transcription', formData.brand);
        fd.append('voice', audioBlob, 'voice.wav');

        const xhr = new XMLHttpRequest();
        xhr.open('POST', \\\`/api/voices/\\\${category}\\\`);
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const resData = JSON.parse(xhr.responseText);
                    if (resData.success) {
                        setVoices(prev => prev.map((p: any) => p.id === tempId ? { ...p, id: resData.id } : p));
                    }
                } catch(e) {}
                fetchVoices(true);
            } else {
                fetchVoices();
            }
        };
        xhr.send(fd);
    };

    const deleteVoice = async (id: number) => {
        if (!confirm('Delete this voice?')) return;
        setVoices(prev => prev.filter((p: any) => p.id !== id));
        await fetch(\\\`/api/voices/\\\${id}\\\`, { method: 'DELETE' });
    };

    const transcribeVoice = async () => {
        if (!audioBlob) return alert('Record or save audio first.');
        try {
            const fd = new FormData();
            fd.append('audio', audioBlob, 'voice.wav');
            const res = await fetch('/api/voices/transcribe', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) {
                setFormData(prev => ({ ...prev, brand: data.transcription }));
            } else {
                alert('Transcription failed: ' + data.error);
            }
        } catch (err) {
            alert('Transcription error');
        }
    };
\`;

dashCode = dashCode.replace(
    '// Submit Product (preserving exact image sequence & uploads)',
    voiceFunctions + '\\n\\n    // Submit Product (preserving exact image sequence & uploads)'
);

// 3. Route handleSubmit
dashCode = dashCode.replace(
    'const handleSubmit = async () => {',
    \`const handleSubmit = async () => {
        if (isVoiceMode) return submitVoice();\`
);

// 4. Update the Grid
const originalGridStart = \`{subTab === 'products' && (\`;
const originalGridEnd = \`)}
                            {/* ===== CONVERSATIONS TAB ===== */}\`;

// Let's manually replace the grid conditionally!
// It's safer to just inject VoiceAssetsTab inside the subtabs switch instead of reusing the products grid!
// Yes! Just add \`{isVoiceMode && <VoiceAssetsTab category={subTab} title={subTab === 'policy' ? 'Policy Voices' : 'Pre-recorded Voices'} description="..." />}\`
// BUT WAIT! We want to use the full CapCut editor, which is inside WhatsAppDashboard!
// Okay, let's just make \`subTab === 'policy'\` render a Custom Grid right below the products grid!

const voiceGridJSX = \`
                            {/* ===== VOICES TAB ===== */}
                            {isVoiceMode && (
                                <div className="space-y-6 max-w-6xl pb-10">
                                    <div className="flex items-center justify-between mb-8">
                                        <div>
                                            <h2 className="text-3xl font-bold text-slate-100 tracking-tight">
                                                {subTab === 'policy' ? 'Policy Voices' : 'Pre-recorded Voices'}
                                            </h2>
                                            <p className="text-slate-400 text-sm mt-1">
                                                Manage AI Voice Assets with full Timeline Studio.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => { resetForm(); setShowAddModal(true); }}
                                            className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-teal-600/30 transition-all flex items-center gap-2"
                                        >
                                            <Plus size={18} /> Add Voice
                                        </button>
                                    </div>
                                    
                                    {loading ? (
                                        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div></div>
                                    ) : voices.length === 0 ? (
                                        <div className="border border-dashed border-teal-900/30 rounded-2xl h-64 flex flex-col items-center justify-center text-slate-500">
                                            <Mic size={48} className="mb-3 text-teal-800" />
                                            <p className="font-semibold text-slate-300">No voices listed yet</p>
                                            <p className="text-xs text-slate-500 mt-1">Click Add Voice to upload your first audio asset.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                            {voices.map(voice => (
                                                <div key={voice.id} className="bg-[#09181E] border border-teal-900/40 rounded-2xl p-5 shadow-xl flex flex-col gap-4 group relative hover:border-teal-700/50 transition-colors">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h4 className="text-slate-100 font-bold text-lg">{voice.title}</h4>
                                                            <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-500/10 text-teal-400 border border-teal-500/20">
                                                                {voice.status}
                                                            </span>
                                                        </div>
                                                        <button onClick={() => deleteVoice(voice.id)} className="text-slate-500 hover:text-red-400 p-1 bg-teal-950/30 rounded-lg"><Trash2 size={16} /></button>
                                                    </div>
                                                    
                                                    {voice.voice_url && (
                                                        <audio src={voice.voice_url} controls className="w-full h-10 custom-audio-player" />
                                                    )}

                                                    <div>
                                                        <h5 className="text-teal-500 text-[10px] uppercase font-bold tracking-wider mb-1">When to Use</h5>
                                                        <p className="text-slate-300 text-xs line-clamp-3">{voice.usage_instructions || 'None'}</p>
                                                    </div>

                                                    <div className="mt-auto pt-2 border-t border-teal-900/30">
                                                        <h5 className="text-amber-500 text-[10px] uppercase font-bold tracking-wider mb-1">Transcription</h5>
                                                        <p className="text-slate-400 text-[11px] italic line-clamp-4 leading-relaxed">{voice.transcription || 'Not transcribed yet.'}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
\`;

dashCode = dashCode.replace(
    '{/* ===== CONVERSATIONS TAB ===== */}',
    voiceGridJSX + '\\n                            {/* ===== CONVERSATIONS TAB ===== */}'
);

// 5. Update the Modal JSX Phase 1
// We need to conditionally render the Voice fields or Product fields
// We'll just replace the Phase 1 form with a conditional!
const phase1Start = dashCode.indexOf('{/* PHASE 1: DETAILS */}');
const phase2Start = dashCode.indexOf('{/* PHASE 2: PRODUCT MEDIA */}');

let phase1Block = dashCode.substring(phase1Start, phase2Start);
phase1Block = phase1Block.replace(
    '<div className="space-y-5">',
    \`<div className="space-y-5">
                                                    {isVoiceMode ? (
                                                        <>
                                                            <div>
                                                                <label className="block text-xs font-medium text-slate-300 mb-1.5">Voice Title</label>
                                                                <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-[#050D10] border border-teal-900/50 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none" placeholder="e.g. Return Policy" />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-slate-300 mb-1.5">When should AI use this voice?</label>
                                                                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-[#050D10] border border-teal-900/50 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none h-24 resize-none" placeholder="e.g. Play this when customer asks for returns..." />
                                                            </div>
                                                            <div className="flex justify-between items-center mt-4">
                                                                <label className="block text-xs font-medium text-slate-300">Speech-to-Text Transcription</label>
                                                                <button type="button" onClick={transcribeVoice} className="bg-amber-600/20 text-amber-500 px-3 py-1.5 rounded text-[10px] font-bold">Convert to Text</button>
                                                            </div>
                                                            <textarea value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} className="w-full bg-[#050D10] border border-amber-900/50 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 h-24 focus:ring-2 focus:ring-amber-500 outline-none resize-none" placeholder="Transcription text..." />
                                                        </>
                                                    ) : (\`
);

// We need to add the closing \`)\` for the conditional before \`</div>\` that closes Phase 1
const phase1EndDiv = phase1Block.lastIndexOf('</div>');
phase1Block = phase1Block.substring(0, phase1EndDiv) + ')}\n' + phase1Block.substring(phase1EndDiv);

dashCode = dashCode.substring(0, phase1Start) + phase1Block + dashCode.substring(phase2Start);

// 6. Skip Phase 2 if isVoiceMode
// When in Phase 1, the Next button goes to Phase 2.
dashCode = dashCode.replace(
    \`onClick={() => setActivePhase(2)}\`,
    \`onClick={() => setActivePhase(isVoiceMode ? 3 : 2)}\`
);

// Update title in modal
dashCode = dashCode.replace(
    '{editingProduct ? \'Edit Product\' : \'Add New Product\'}',
    '{isVoiceMode ? "Add Voice Asset" : (editingProduct ? "Edit Product" : "Add New Product")}'
);

fs.writeFileSync('frontend/src/components/WhatsAppDashboard.tsx', dashCode);
console.log('WhatsAppDashboard patched successfully for Voice mode!');
