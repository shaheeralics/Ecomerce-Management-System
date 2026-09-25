const fs = require('fs');

const dashCode = fs.readFileSync('frontend/src/components/WhatsAppDashboard.tsx', 'utf8');

const jsxStart = dashCode.indexOf('<div className="flex flex-col items-center justify-center gap-4">');
const jsxEnd = dashCode.indexOf('{/* Alternative Audio Upload */}');
let audioStudioJsx = dashCode.substring(jsxStart, jsxEnd).trim();

const stateStart = dashCode.indexOf('// Audio / Voice note states');
const stateEnd = dashCode.indexOf('// Card Gallery Active Image State');
let audioStateCode = dashCode.substring(stateStart, stateEnd);

const helpersStart = dashCode.indexOf('const formatTimer');
const helpersEnd = dashCode.indexOf('const WhatsAppDashboard = () =>');
let helpersCode = dashCode.substring(helpersStart, helpersEnd);

const newTabCode = 
"import React, { useState, useEffect, useRef } from 'react';\n" +
"import { \n" +
"    Package, MessageSquare, Settings, Plus, Trash2, Edit3, Camera, Video, \n" +
"    Mic, Square, Play, Pause, Volume2, CheckCircle, X, ChevronRight, ChevronLeft, \n" +
"    FileText, Upload, Check, RotateCcw, Layers, Tag, Move, ZoomIn, ZoomOut, Minimize2, Scissors, ShieldAlert, RefreshCw\n" +
"} from 'lucide-react';\n\n" +
helpersCode + "\n\n" +
"interface VoiceAsset {\n" +
"    id: number;\n" +
"    category: string;\n" +
"    title: string;\n" +
"    usage_instructions: string;\n" +
"    transcription: string;\n" +
"    voice_url: string | null;\n" +
"    status: string;\n" +
"}\n\n" +
"export default function VoiceAssetsTab({ category, title, description }: { category: 'policy' | 'prerecorded', title: string, description: string }) {\n" +
"    const [voices, setVoices] = useState<VoiceAsset[]>([]);\n" +
"    const [loading, setLoading] = useState(false);\n" +
"    const [showModal, setShowModal] = useState(false);\n" +
"    \n" +
"    const [formData, setFormData] = useState({ title: '', usage_instructions: '', transcription: '' });\n" +
"    const [isTranscribing, setIsTranscribing] = useState(false);\n\n" +
audioStateCode + "\n\n" +
"    const fetchVoices = async (silentMerge = false) => {\n" +
"        if (!silentMerge) setLoading(true);\n" +
"        try {\n" +
"            const res = await fetch(`/api/voices/${category}?_t=${Date.now()}`);\n" +
"            const data = await res.json();\n" +
"            if (data.success) {\n" +
"                if (silentMerge) {\n" +
"                    setVoices(prev => {\n" +
"                        const merged = data.data.map((dbV: any) => {\n" +
"                            const loc = prev.find(p => p.id === dbV.id);\n" +
"                            if (loc && dbV.status === 'uploading') {\n" +
"                                return { ...dbV, voice_url: dbV.voice_url || loc.voice_url };\n" +
"                            }\n" +
"                            return dbV;\n" +
"                        });\n" +
"                        const optimistic = prev.filter(p => p.id < 0);\n" +
"                        return [...optimistic, ...merged];\n" +
"                    });\n" +
"                } else {\n" +
"                    setVoices(data.data);\n" +
"                }\n" +
"            }\n" +
"        } catch (err) {}\n" +
"        if (!silentMerge) setLoading(false);\n" +
"    };\n\n" +
"    useEffect(() => { fetchVoices(); }, [category]);\n\n" +
"    useEffect(() => {\n" +
"        const hasUploading = voices.some(v => v.status === 'uploading');\n" +
"        if (!hasUploading) return;\n" +
"        const interval = setInterval(() => fetchVoices(true), 3000);\n" +
"        return () => clearInterval(interval);\n" +
"    }, [voices, category]);\n\n" +
"    const resetForm = () => {\n" +
"        setFormData({ title: '', usage_instructions: '', transcription: '' });\n" +
"        clearAudio();\n" +
"        setShowModal(false);\n" +
"    };\n\n" +
"    const transcribeAudio = async () => {\n" +
"        if (!audioBlob) return alert('Record or save audio first.');\n" +
"        setIsTranscribing(true);\n" +
"        try {\n" +
"            const fd = new FormData();\n" +
"            fd.append('audio', audioBlob, 'voice.wav');\n" +
"            const res = await fetch('/api/voices/transcribe', { method: 'POST', body: fd });\n" +
"            const data = await res.json();\n" +
"            if (data.success) {\n" +
"                setFormData(prev => ({ ...prev, transcription: data.transcription }));\n" +
"            } else {\n" +
"                alert('Transcription failed: ' + data.error);\n" +
"            }\n" +
"        } catch (err) {\n" +
"            alert('Transcription error');\n" +
"        }\n" +
"        setIsTranscribing(false);\n" +
"    };\n\n" +
"    const submitVoice = () => {\n" +
"        if (!formData.title || !audioBlob) return alert('Title and Audio required');\n" +
"        const tempId = -Date.now();\n" +
"        const tempVoice: VoiceAsset = {\n" +
"            id: tempId,\n" +
"            category,\n" +
"            title: formData.title,\n" +
"            usage_instructions: formData.usage_instructions,\n" +
"            transcription: formData.transcription,\n" +
"            voice_url: audioPreviewUrl,\n" +
"            status: 'uploading'\n" +
"        };\n" +
"        setVoices(prev => [tempVoice, ...prev]);\n" +
"        setShowModal(false);\n\n" +
"        const fd = new FormData();\n" +
"        fd.append('title', formData.title);\n" +
"        fd.append('usage_instructions', formData.usage_instructions);\n" +
"        fd.append('transcription', formData.transcription);\n" +
"        fd.append('voice', audioBlob, 'voice.wav');\n\n" +
"        const xhr = new XMLHttpRequest();\n" +
"        xhr.open('POST', `/api/voices/${category}`);\n" +
"        xhr.onload = () => {\n" +
"            if (xhr.status >= 200 && xhr.status < 300) {\n" +
"                try {\n" +
"                    const resData = JSON.parse(xhr.responseText);\n" +
"                    if (resData.success) {\n" +
"                        setVoices(prev => prev.map(p => p.id === tempId ? { ...p, id: resData.id } : p));\n" +
"                    }\n" +
"                } catch(e) {}\n" +
"                fetchVoices(true);\n" +
"            } else {\n" +
"                fetchVoices();\n" +
"            }\n" +
"        };\n" +
"        xhr.send(fd);\n" +
"    };\n\n" +
"    const deleteVoice = async (id: number) => {\n" +
"        if (!confirm('Delete this voice?')) return;\n" +
"        setVoices(prev => prev.filter(p => p.id !== id));\n" +
"        await fetch(`/api/voices/${id}`, { method: 'DELETE' });\n" +
"    };\n\n" +
"    return (\n" +
"        <div className=\"space-y-6 max-w-6xl\">\n" +
"            <div className=\"flex items-center justify-between mb-8\">\n" +
"                <div>\n" +
"                    <h2 className=\"text-3xl font-bold text-slate-100 tracking-tight\">{title}</h2>\n" +
"                    <p className=\"text-slate-400 text-sm mt-1\">{description}</p>\n" +
"                </div>\n" +
"                <button\n" +
"                    onClick={() => { resetForm(); setShowModal(true); }}\n" +
"                    className=\"bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-teal-600/30 transition-all flex items-center gap-2\"\n" +
"                >\n" +
"                    <Plus size={18} />\n" +
"                    Add Voice\n" +
"                </button>\n" +
"            </div>\n\n" +
"            {loading ? (\n" +
"                <div className=\"flex justify-center py-20\"><div className=\"animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500\"></div></div>\n" +
"            ) : voices.length === 0 ? (\n" +
"                <div className=\"border border-dashed border-teal-900/30 rounded-2xl h-64 flex flex-col items-center justify-center text-slate-500\">\n" +
"                    <Mic size={48} className=\"mb-3 text-teal-800\" />\n" +
"                    <p className=\"font-semibold text-slate-300\">No voices listed yet</p>\n" +
"                    <p className=\"text-xs text-slate-500 mt-1\">Click Add Voice to upload your first audio asset.</p>\n" +
"                </div>\n" +
"            ) : (\n" +
"                <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6\">\n" +
"                    {voices.map(voice => (\n" +
"                        <div key={voice.id} className=\"bg-[#09181E] border border-teal-900/40 rounded-2xl p-5 shadow-xl flex flex-col gap-4 group relative hover:border-teal-700/50 transition-colors\">\n" +
"                            <div className=\"flex justify-between items-start\">\n" +
"                                <div>\n" +
"                                    <h4 className=\"text-slate-100 font-bold text-lg\">{voice.title}</h4>\n" +
"                                    <span className=\"inline-flex mt-1 items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-500/10 text-teal-400 border border-teal-500/20\">\n" +
"                                        {voice.status}\n" +
"                                    </span>\n" +
"                                </div>\n" +
"                                <button onClick={() => deleteVoice(voice.id)} className=\"text-slate-500 hover:text-red-400 p-1 bg-teal-950/30 rounded-lg\"><Trash2 size={16} /></button>\n" +
"                            </div>\n" +
"                            \n" +
"                            {voice.voice_url && (\n" +
"                                <audio src={voice.voice_url} controls className=\"w-full h-10 custom-audio-player\" />\n" +
"                            )}\n\n" +
"                            <div>\n" +
"                                <h5 className=\"text-teal-500 text-[10px] uppercase font-bold tracking-wider mb-1\">When to Use</h5>\n" +
"                                <p className=\"text-slate-300 text-xs line-clamp-3\">{voice.usage_instructions || 'None'}</p>\n" +
"                            </div>\n\n" +
"                            <div className=\"mt-auto pt-2 border-t border-teal-900/30\">\n" +
"                                <h5 className=\"text-amber-500 text-[10px] uppercase font-bold tracking-wider mb-1\">Transcription (AI Context)</h5>\n" +
"                                <p className=\"text-slate-400 text-[11px] italic line-clamp-4 leading-relaxed\">{voice.transcription || 'Not transcribed yet.'}</p>\n" +
"                            </div>\n" +
"                        </div>\n" +
"                    ))}\n" +
"                </div>\n" +
"            )}\n\n" +
"            {showModal && (\n" +
"                <div className=\"fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto\">\n" +
"                    <div className=\"bg-[#0A181D] border border-teal-900/50 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl my-8 flex flex-col max-h-[90vh]\">\n" +
"                        <div className=\"bg-[#0B1E26] border-b border-teal-900/50 px-6 py-4 flex items-center justify-between flex-shrink-0\">\n" +
"                            <h2 className=\"text-xl font-bold text-slate-100 flex items-center gap-2\">\n" +
"                                <Mic className=\"text-teal-400\" size={22} /> Add New Voice Asset\n" +
"                            </h2>\n" +
"                            <button onClick={resetForm} className=\"p-2 bg-[#050D10] text-slate-400 hover:text-slate-200 hover:bg-teal-900/30 rounded-xl transition-all cursor-pointer\">\n" +
"                                <X size={20} />\n" +
"                            </button>\n" +
"                        </div>\n\n" +
"                        <div className=\"p-6 overflow-y-auto flex-1 custom-scrollbar\">\n" +
"                            <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6\">\n" +
"                                <div>\n" +
"                                    <label className=\"block text-xs font-semibold text-slate-300 mb-2\">Voice Title</label>\n" +
"                                    <input type=\"text\" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className=\"w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-4 py-3 text-sm text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none\" placeholder=\"e.g. 7 Days Return Policy\" />\n" +
"                                </div>\n" +
"                                <div>\n" +
"                                    <label className=\"block text-xs font-semibold text-slate-300 mb-2\">When should AI use this voice?</label>\n" +
"                                    <textarea value={formData.usage_instructions} onChange={e => setFormData({ ...formData, usage_instructions: e.target.value })} className=\"w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-4 py-3 text-sm text-slate-100 h-[50px] focus:ring-2 focus:ring-teal-500 outline-none resize-none\" placeholder=\"e.g. Play this voice note when...\" />\n" +
"                                </div>\n" +
"                            </div>\n\n" +
"                            <div className=\"bg-[#050D10] border border-teal-900/40 rounded-xl p-6 text-center shadow-inner mb-6\">\n" +
"                                <h4 className=\"text-teal-400 font-semibold text-xs uppercase tracking-wider mb-4\">Record & Edit Voice</h4>\n" +
audioStudioJsx + "\n" +
"                            </div>\n\n" +
"                            {audioPreviewUrl && (\n" +
"                                <div className=\"bg-[#140F08] border border-amber-900/40 rounded-xl p-6 space-y-4 shadow-inner\">\n" +
"                                    <div className=\"flex justify-between items-center\">\n" +
"                                        <h4 className=\"text-amber-500 font-semibold text-xs uppercase tracking-wider flex items-center gap-2\">\n" +
"                                            <FileText size={16} /> Speech-to-Text Transcription\n" +
"                                        </h4>\n" +
"                                        <button onClick={transcribeAudio} disabled={isTranscribing} className=\"bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-lg flex items-center gap-2 disabled:opacity-50\">\n" +
"                                            {isTranscribing ? <RefreshCw className=\"animate-spin\" size={14} /> : <Edit3 size={14} />} \n" +
"                                            {isTranscribing ? 'Transcribing...' : 'Convert to Text'}\n" +
"                                        </button>\n" +
"                                    </div>\n" +
"                                    <p className=\"text-[11px] text-slate-400\">Convert the recorded audio to text so the AI Agent can understand exactly what you are saying.</p>\n" +
"                                    <textarea value={formData.transcription} onChange={e => setFormData({ ...formData, transcription: e.target.value })} className=\"w-full bg-[#050D10] border border-amber-900/50 rounded-xl px-4 py-3 text-sm text-slate-100 h-28 focus:ring-2 focus:ring-amber-500 outline-none resize-none\" placeholder=\"Click 'Convert to Text' to auto-generate, or type manually...\" />\n" +
"                                </div>\n" +
"                            )}\n" +
"                        </div>\n\n" +
"                        <div className=\"p-6 border-t border-teal-900/50 bg-[#0B1E26] flex justify-end gap-3 flex-shrink-0\">\n" +
"                            <button onClick={resetForm} className=\"px-6 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-semibold transition-all\">Cancel</button>\n" +
"                            <button onClick={submitVoice} disabled={!formData.title || !audioBlob} className=\"bg-teal-600 hover:bg-teal-500 text-white px-8 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-teal-600/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed\">\n" +
"                                <CheckCircle size={18} /> Save & Upload Voice\n" +
"                            </button>\n" +
"                        </div>\n" +
"                    </div>\n" +
"                </div>\n" +
"            )}\n" +
"        </div>\n" +
"    );\n" +
"}\n";

fs.writeFileSync('frontend/src/components/VoiceAssetsTab.tsx', newTabCode);
console.log('VoiceAssetsTab.tsx rebuilt successfully!');
