import os

with open("frontend/src/components/WhatsAppDashboard.tsx", "r", encoding="utf-8") as f:
    dash_code = f.read()

# 1. Extract audio studio JSX (between specific tokens)
start_token = '<div className="space-y-6">'
start_idx = dash_code.find(start_token, dash_code.find('activePhase === 3'))
end_token = '{/* Alternative Audio Upload */}'
end_idx = dash_code.find(end_token, start_idx)
# We need to find the `</div>\n                                            </div>` that precedes Alternative Audio Upload.
# Let's just split lines to be absolutely safe.
dash_lines = dash_code.splitlines()
studio_lines = dash_lines[2067:2514] # 0-indexed corresponding to line 2068 to 2514
studio_jsx = "\n".join(studio_lines)

# 2. Extract state variables
state_start = dash_code.find('// Audio / Voice note states')
state_end = dash_code.find('// Card Gallery Active Image State')
audio_state = dash_code[state_start:state_end]

# 3. Extract helpers
helpers_start = dash_code.find('const formatTimer')
helpers_end = dash_code.find('const WhatsAppDashboard = () =>')
helpers_code = dash_code[helpers_start:helpers_end]

# 4. Extract interfaces
audio_clip_start = dash_code.find('interface AudioTrackClip {')
audio_clip_end = dash_code.find('}', audio_clip_start) + 1
audio_clip_int = dash_code[audio_clip_start:audio_clip_end]

timeline_start = dash_code.find('interface TimelineState {')
timeline_end = dash_code.find('}', timeline_start) + 1
timeline_int = dash_code[timeline_start:timeline_end]


# Now write the new VoiceAssetsTab.tsx by concatenating pieces carefully
new_tab_code = f"""import React, {{ useState, useEffect, useRef }} from 'react';
import {{ 
    Package, MessageSquare, Settings, Plus, Trash2, Edit3, Camera, Video, 
    Mic, Square, Play, Pause, Volume2, CheckCircle, X, ChevronRight, ChevronLeft, 
    FileText, Upload, Check, RotateCcw, Layers, Tag, Move, ZoomIn, ZoomOut, Minimize2, Scissors, ShieldAlert, RefreshCw
}} from 'lucide-react';

{helpers_code}

{audio_clip_int}

{timeline_int}

interface VoiceAsset {{
    id: number;
    category: string;
    title: string;
    usage_instructions: string;
    transcription: string;
    voice_url: string | null;
    status: string;
}}

export default function VoiceAssetsTab({{ category, title, description }}: {{ category: 'policy' | 'prerecorded', title: string, description: string }}) {{
    const [voices, setVoices] = useState<VoiceAsset[]>([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    
    const [formData, setFormData] = useState({{ title: '', usage_instructions: '', transcription: '' }});
    const [isTranscribing, setIsTranscribing] = useState(false);

{audio_state}

    const fetchVoices = async (silentMerge = false) => {{
        if (!silentMerge) setLoading(true);
        try {{
            const res = await fetch(`/api/voices/${{category}}?_t=${{Date.now()}}`);
            const data = await res.json();
            if (data.success) {{
                if (silentMerge) {{
                    setVoices(prev => {{
                        const merged = data.data.map((dbV: any) => {{
                            const loc = prev.find(p => p.id === dbV.id);
                            if (loc && dbV.status === 'uploading') {{
                                return {{ ...dbV, voice_url: dbV.voice_url || loc.voice_url }};
                            }}
                            return dbV;
                        }});
                        const optimistic = prev.filter(p => p.id < 0);
                        return [...optimistic, ...merged];
                    }});
                }} else {{
                    setVoices(data.data);
                }}
            }}
        }} catch (err) {{}}
        if (!silentMerge) setLoading(false);
    }};

    useEffect(() => {{ fetchVoices(); }}, [category]);

    useEffect(() => {{
        const hasUploading = voices.some(v => v.status === 'uploading');
        if (!hasUploading) return;
        const interval = setInterval(() => fetchVoices(true), 3000);
        return () => clearInterval(interval);
    }}, [voices, category]);

    const resetForm = () => {{
        setFormData({{ title: '', usage_instructions: '', transcription: '' }});
        clearAudio();
        setShowModal(false);
    }};

    const transcribeAudio = async () => {{
        if (!audioBlob) return alert('Record or save audio first.');
        setIsTranscribing(true);
        try {{
            const fd = new FormData();
            fd.append('audio', audioBlob, 'voice.wav');
            const res = await fetch('/api/voices/transcribe', {{ method: 'POST', body: fd }});
            const data = await res.json();
            if (data.success) {{
                setFormData(prev => ({{ ...prev, transcription: data.transcription }}));
            }} else {{
                alert('Transcription failed: ' + data.error);
            }}
        }} catch (err) {{
            alert('Transcription error');
        }}
        setIsTranscribing(false);
    }};

    const submitVoice = () => {{
        if (!formData.title || !audioBlob) return alert('Title and Audio required');
        const tempId = -Date.now();
        const tempVoice: VoiceAsset = {{
            id: tempId,
            category,
            title: formData.title,
            usage_instructions: formData.usage_instructions,
            transcription: formData.transcription,
            voice_url: audioPreviewUrl,
            status: 'uploading'
        }};
        setVoices(prev => [tempVoice, ...prev]);
        setShowModal(false);

        const fd = new FormData();
        fd.append('title', formData.title);
        fd.append('usage_instructions', formData.usage_instructions);
        fd.append('transcription', formData.transcription);
        fd.append('voice', audioBlob, 'voice.wav');

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/voices/${{category}}`);
        xhr.onload = () => {{
            if (xhr.status >= 200 && xhr.status < 300) {{
                try {{
                    const resData = JSON.parse(xhr.responseText);
                    if (resData.success) {{
                        setVoices(prev => prev.map(p => p.id === tempId ? {{ ...p, id: resData.id }} : p));
                    }}
                }} catch(e) {{}}
                fetchVoices(true);
            }} else {{
                fetchVoices();
            }}
        }};
        xhr.send(fd);
    }};

    const deleteVoice = async (id: number) => {{
        if (!confirm('Delete this voice?')) return;
        setVoices(prev => prev.filter(p => p.id !== id));
        await fetch(`/api/voices/${{id}}`, {{ method: 'DELETE' }});
    }};

    return (
        <div className="space-y-6 max-w-6xl pb-10">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-100 tracking-tight">{{title}}</h2>
                    <p className="text-slate-400 text-sm mt-1">{{description}}</p>
                </div>
                <button
                    onClick={{() => {{ resetForm(); setShowModal(true); }}}}
                    className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-teal-600/30 transition-all flex items-center gap-2"
                >
                    <Plus size={{18}} /> Add Voice
                </button>
            </div>

            {{loading ? (
                <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div></div>
            ) : voices.length === 0 ? (
                <div className="border border-dashed border-teal-900/30 rounded-2xl h-64 flex flex-col items-center justify-center text-slate-500">
                    <Mic size={{48}} className="mb-3 text-teal-800" />
                    <p className="font-semibold text-slate-300">No voices listed yet</p>
                    <p className="text-xs text-slate-500 mt-1">Click Add Voice to upload your first audio asset.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {{voices.map(voice => (
                        <div key={{voice.id}} className="bg-[#09181E] border border-teal-900/40 rounded-2xl p-5 shadow-xl flex flex-col gap-4 group relative hover:border-teal-700/50 transition-colors">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="text-slate-100 font-bold text-lg">{{voice.title}}</h4>
                                    <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-500/10 text-teal-400 border border-teal-500/20">
                                        {{voice.status}}
                                    </span>
                                </div>
                                <button onClick={{() => deleteVoice(voice.id)}} className="text-slate-500 hover:text-red-400 p-1 bg-teal-950/30 rounded-lg"><Trash2 size={{16}} /></button>
                            </div>
                            
                            {{voice.voice_url && (
                                <audio src={{voice.voice_url}} controls className="w-full h-10 custom-audio-player" />
                            )}}

                            <div>
                                <h5 className="text-teal-500 text-[10px] uppercase font-bold tracking-wider mb-1">When to Use</h5>
                                <p className="text-slate-300 text-xs line-clamp-3">{{voice.usage_instructions || 'None'}}</p>
                            </div>

                            <div className="mt-auto pt-2 border-t border-teal-900/30">
                                <h5 className="text-amber-500 text-[10px] uppercase font-bold tracking-wider mb-1">Transcription (AI Context)</h5>
                                <p className="text-slate-400 text-[11px] italic line-clamp-4 leading-relaxed">{{voice.transcription || 'Not transcribed yet.'}}</p>
                            </div>
                        </div>
                    ))}}
                </div>
            )}}

            {{showModal && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-[#0A181D] border border-teal-900/50 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl my-8 flex flex-col max-h-[90vh]">
                        <div className="bg-[#0B1E26] border-b border-teal-900/50 px-6 py-4 flex items-center justify-between flex-shrink-0">
                            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                                <Mic className="text-teal-400" size={{22}} /> Add New Voice Asset
                            </h2>
                            <button onClick={{resetForm}} className="p-2 bg-[#050D10] text-slate-400 hover:text-slate-200 hover:bg-teal-900/30 rounded-xl transition-all cursor-pointer">
                                <X size={{20}} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-2">Voice Title</label>
                                    <input type="text" value={{formData.title}} onChange={{e => setFormData({{ ...formData, title: e.target.value }})}} className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-4 py-3 text-sm text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="e.g. 7 Days Return Policy" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-2">When should AI use this voice?</label>
                                    <textarea value={{formData.usage_instructions}} onChange={{e => setFormData({{ ...formData, usage_instructions: e.target.value }})}} className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-4 py-3 text-sm text-slate-100 h-[50px] focus:ring-2 focus:ring-teal-500 outline-none resize-none" placeholder="e.g. Play this voice note when..." />
                                </div>
                            </div>

{studio_jsx}

                            {{audioPreviewUrl && (
                                <div className="bg-[#140F08] border border-amber-900/40 rounded-xl p-6 space-y-4 shadow-inner mt-6">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-amber-500 font-semibold text-xs uppercase tracking-wider flex items-center gap-2">
                                            <FileText size={{16}} /> Speech-to-Text Transcription
                                        </h4>
                                        <button onClick={{transcribeAudio}} disabled={{isTranscribing}} className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-lg flex items-center gap-2 disabled:opacity-50">
                                            {{isTranscribing ? <RefreshCw className="animate-spin" size={{14}} /> : <Edit3 size={{14}} />}} 
                                            {{isTranscribing ? 'Transcribing...' : 'Convert to Text'}}
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-slate-400">Convert the recorded audio to text so the AI Agent can understand exactly what you are saying.</p>
                                    <textarea value={{formData.transcription}} onChange={{e => setFormData({{ ...formData, transcription: e.target.value }})}} className="w-full bg-[#050D10] border border-amber-900/50 rounded-xl px-4 py-3 text-sm text-slate-100 h-28 focus:ring-2 focus:ring-amber-500 outline-none resize-none" placeholder="Click 'Convert to Text' to auto-generate, or type manually..." />
                                </div>
                            )}}
                        </div>

                        <div className="p-6 border-t border-teal-900/50 bg-[#0B1E26] flex justify-end gap-3 flex-shrink-0">
                            <button onClick={{resetForm}} className="px-6 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-semibold transition-all">Cancel</button>
                            <button onClick={{submitVoice}} disabled={{!formData.title || !audioBlob}} className="bg-teal-600 hover:bg-teal-500 text-white px-8 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-teal-600/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                <CheckCircle size={{18}} /> Save & Upload Voice
                            </button>
                        </div>
                    </div>
                </div>
            )}}
        </div>
    );
}}
"""

with open("frontend/src/components/VoiceAssetsTab.tsx", "w", encoding="utf-8") as f:
    f.write(new_tab_code)
print("Rebuilt via python!")
