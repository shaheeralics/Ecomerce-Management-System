import React, { useState, useEffect, useRef } from 'react';
import { 
    Mic, Play, Pause, Trash2, Edit3, Plus, ChevronLeft, Save, X, RotateCcw, ArrowRight
} from 'lucide-react';
import MobileVoiceEditor from './MobileVoiceEditor';

interface VoiceAssetsTabProps {
    category?: 'policy' | 'prerecorded';
    title?: string;
    description?: string;
}

export default function VoiceAssetsTab({ category = 'policy', title }: VoiceAssetsTabProps) {
    const [voices, setVoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    const [viewState, setViewState] = useState<'list' | 'edit'>('list');
    const [editId, setEditId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'details' | 'voice'>('details');

    const [formData, setFormData] = useState({ title: '', usage_instructions: '', transcription: '' });
    
    // Opus Recorder States
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
    const [recorder, setRecorder] = useState<any>(null);
    const [isEditingVoice, setIsEditingVoice] = useState(false);
    
    const timerRef = useRef<number | null>(null);

    const fetchVoices = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await fetch(`/api/voices/${category}?_t=${Date.now()}`);
            const data = await res.json();
            if (data.success) {
                setVoices(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch voices', err);
        }
        if (!silent) setLoading(false);
    };

    useEffect(() => { fetchVoices(); }, [category]);

    useEffect(() => {
        const OpusRecorder = (window as any).Recorder;
        if (OpusRecorder) {
            const rec = new OpusRecorder({
                encoderPath: '/encoderWorker.min.js',
                encoderSampleRate: 16000,
                originalSampleRateOverride: 16000,
                numberOfChannels: 1, // Mono for Voice Note
                maxFramesPerPage: 40,
                encoderApplication: 2048 // Voice
            });
            setRecorder(rec);
        } else {
            console.error('OpusRecorder is not loaded from CDN');
        }
    }, []);

    const resetForm = () => {
        setFormData({ title: '', usage_instructions: '', transcription: '' });
        setAudioBlob(null);
        if (audioPreviewUrl && audioPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(audioPreviewUrl);
        setAudioPreviewUrl(null);
        setEditId(null);
        setActiveTab('details');
        setRecordingTime(0);
        setIsRecording(false);
        setIsPaused(false);
        setIsEditingVoice(false);
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const handleAddClick = () => {
        resetForm();
        setViewState('edit');
    };

    const handleEditClick = (voice: any) => {
        resetForm();
        setEditId(voice.id);
        setFormData({ title: voice.title, usage_instructions: voice.usage_instructions || '', transcription: voice.transcription || '' });
        setAudioPreviewUrl(voice.voice_url || null);
        setViewState('edit');
    };

    const deleteVoice = async (id: number) => {
        if (!confirm('Delete this voice?')) return;
        setVoices(prev => prev.filter(p => p.id !== id));
        await fetch(`/api/voices/${id}`, { method: 'DELETE' });
    };

    const startRecording = async () => {
        if (!recorder) return;
        try {
            // Reset previous data
            setAudioBlob(null);
            if (audioPreviewUrl && audioPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(audioPreviewUrl);
            setAudioPreviewUrl(null);

            recorder.ondataavailable = (typedArray: Uint8Array) => {
                const file = new File([typedArray as any], 'voice_note.ogg', {
                    type: 'audio/ogg; codecs=opus',
                    lastModified: Date.now()
                });
                setAudioBlob(file);
                setAudioPreviewUrl(URL.createObjectURL(file));
                
                // Auto-transcribe in background
                backgroundTranscribe(file);
            };

            await recorder.start();
            setIsRecording(true);
            setIsPaused(false);
            setRecordingTime(0);

            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = window.setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Microphone access denied:', err);
            alert('Microphone access is required.');
        }
    };

    const pauseRecording = () => {
        if (recorder && isRecording && !isPaused) {
            recorder.pause();
            setIsPaused(true);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const resumeRecording = () => {
        if (recorder && isRecording && isPaused) {
            recorder.resume();
            setIsPaused(false);
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = window.setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        }
    };

    const stopRecording = () => {
        if (recorder && isRecording) {
            recorder.stop();
            setIsRecording(false);
            setIsPaused(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const backgroundTranscribe = async (blob: Blob) => {
        try {
            const fd = new FormData();
            fd.append('audio', blob, 'voice.ogg');
            const res = await fetch('/api/voices/transcribe', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) {
                setFormData(prev => ({ ...prev, transcription: data.transcription }));
            }
        } catch (err) {
            console.error('Auto transcription error', err);
        }
    };

    const submitVoice = async () => {
        if (!formData.title) return alert('Title is required');
        
        const tempId = editId || -Date.now();
        const tempVoice = {
            id: tempId,
            category,
            title: formData.title,
            usage_instructions: formData.usage_instructions,
            transcription: formData.transcription,
            status: editId ? 'updating...' : 'uploading...',
            voice_url: editId ? voices.find(v => v.id === editId)?.voice_url : audioPreviewUrl
        };

        if (editId) {
            setVoices(prev => prev.map(p => p.id === editId ? { ...p, ...tempVoice } : p));
        } else {
            setVoices(prev => [tempVoice, ...prev]);
        }
        
        setViewState('list');

        const fd = new FormData();
        fd.append('title', formData.title);
        fd.append('usage_instructions', formData.usage_instructions);
        fd.append('transcription', formData.transcription);
        if (audioBlob) {
            fd.append('voice', audioBlob, 'voice.ogg');
        }

        const xhr = new XMLHttpRequest();
        xhr.open(editId ? 'PUT' : 'POST', `/api/voices/${editId ? editId : category}`);
        xhr.onload = () => {
            fetchVoices(true);
        };
        xhr.send(fd);
    };

    const formatTimer = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (viewState === 'edit') {
        if (isEditingVoice) {
            return (
                <div className="flex flex-col h-full w-full bg-[#050D10] absolute inset-0 z-50">
                    <MobileVoiceEditor 
                        audioBlob={audioBlob} 
                        onSave={(editedBlob) => {
                            setAudioBlob(editedBlob);
                            if (audioPreviewUrl && audioPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(audioPreviewUrl);
                            setAudioPreviewUrl(URL.createObjectURL(editedBlob));
                            setIsEditingVoice(false);
                            backgroundTranscribe(editedBlob);
                        }} 
                        onCancel={() => setIsEditingVoice(false)} 
                    />
                </div>
            );
        }

        return (
            <div className="flex flex-col h-full w-full bg-[#050D10] absolute inset-0 z-50">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-teal-900/30 bg-[#0B1E26]">
                    <button onClick={() => setViewState('list')} className="text-teal-400 hover:text-teal-300 flex items-center">
                        <ChevronLeft size={24} />
                    </button>
                    <h2 className="text-lg font-bold text-slate-100">
                        {editId ? 'Edit Policy Voice' : 'Add Policy Voice'}
                    </h2>
                    <button onClick={submitVoice} className="text-teal-400 hover:text-teal-300 font-bold flex items-center gap-1 text-sm">
                        <Save size={16} /> Save
                    </button>
                </div>

                {/* Mobile Tabs in 2 Columns */}
                <div className="grid grid-cols-2 border-b border-teal-900/30 bg-[#050D10]">
                    <button 
                        onClick={() => setActiveTab('details')}
                        className={`py-3 text-sm font-semibold transition-colors ${activeTab === 'details' ? 'text-teal-400 border-b-2 border-teal-400' : 'text-slate-500'}`}
                    >
                        Voice Details
                    </button>
                    <button 
                        onClick={() => setActiveTab('voice')}
                        className={`py-3 text-sm font-semibold transition-colors ${activeTab === 'voice' ? 'text-teal-400 border-b-2 border-teal-400' : 'text-slate-500'}`}
                    >
                        Recording
                    </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {activeTab === 'details' ? (
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Voice Title</label>
                                <input 
                                    type="text" 
                                    value={formData.title} 
                                    onChange={e => setFormData({ ...formData, title: e.target.value })} 
                                    className="w-full bg-[#0A181D] border border-teal-900/50 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none focus:border-teal-500 transition-colors" 
                                    placeholder="e.g. Greeting, Policy..." 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">When should AI use this voice?</label>
                                <textarea 
                                    value={formData.usage_instructions} 
                                    onChange={e => setFormData({ ...formData, usage_instructions: e.target.value })} 
                                    className="w-full bg-[#0A181D] border border-teal-900/50 rounded-xl px-4 py-3 text-sm text-slate-100 h-28 outline-none resize-none focus:border-teal-500 transition-colors" 
                                    placeholder="e.g. Play this when customer asks about..." 
                                />
                            </div>

                            <button 
                                onClick={() => setActiveTab('voice')}
                                className="w-full bg-teal-900/30 hover:bg-teal-900/50 text-teal-400 border border-teal-800/50 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 mt-4"
                            >
                                Next: Record Voice <ArrowRight size={18} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full space-y-8">
                            <div className="text-center">
                                <h3 className="text-slate-200 font-bold mb-2">Voice Recording</h3>
                            </div>

                            {!isRecording && !audioPreviewUrl && (
                                <button
                                    onClick={startRecording}
                                    className="w-20 h-20 rounded-full bg-[#FF3B30] hover:bg-red-500 text-white flex items-center justify-center shadow-[0_0_20px_rgba(255,59,48,0.4)] transition-transform active:scale-95"
                                >
                                    <Mic size={32} />
                                </button>
                            )}

                            {isRecording && (
                                <div className="flex flex-col items-center gap-6">
                                    <div className={`text-3xl font-mono ${isPaused ? 'text-amber-400' : 'text-red-400 animate-pulse'} font-bold`}>
                                        {formatTimer(recordingTime)}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={isPaused ? resumeRecording : pauseRecording}
                                            className="w-14 h-14 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center"
                                        >
                                            {isPaused ? <Play size={24} className="ml-1" /> : <Pause size={24} />}
                                        </button>
                                        <button
                                            onClick={stopRecording}
                                            className="w-16 h-16 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center border-2 border-red-500"
                                        >
                                            <div className="w-5 h-5 bg-red-500 rounded-sm"></div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {audioPreviewUrl && !isRecording && (
                                <div className="w-full max-w-sm space-y-6">
                                    <div className="bg-[#0A181D] border border-teal-900/50 rounded-2xl p-4">
                                        <audio src={audioPreviewUrl} controls className="w-full h-10 custom-audio-player" />
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center gap-3">
                                        <button
                                            onClick={startRecording}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition-colors"
                                        >
                                            <RotateCcw size={16} /> Retake
                                        </button>
                                        <button
                                            onClick={() => setIsEditingVoice(true)}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 rounded-lg text-sm font-semibold transition-colors"
                                        >
                                            <Edit3 size={16} /> Edit
                                        </button>
                                        <button
                                            onClick={submitVoice}
                                            className="flex items-center gap-1.5 px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-teal-900/50 transition-colors"
                                        >
                                            <Save size={16} /> Submit
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Auto Transcribed Text (Read Only) */}
                            {formData.transcription && (
                                <div className="w-full max-w-sm mt-4 p-3 bg-teal-950/20 border border-teal-900/30 rounded-xl">
                                    <p className="text-[10px] text-teal-500 font-bold uppercase tracking-wider mb-1">Auto-Transcription</p>
                                    <p className="text-xs text-slate-300 italic">"{formData.transcription}"</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full relative flex flex-col w-full">
            {/* Content List */}
            <div className="flex-1 overflow-y-auto pt-4 px-4 pb-24 custom-scrollbar">
                {loading ? (
                    <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500"></div></div>
                ) : voices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                        <Mic size={40} className="mb-3 text-teal-900/50" />
                        <p className="font-semibold text-slate-400">No voices listed yet</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {voices.map(voice => (
                            <div key={voice.id} className="bg-[#0B1E26] border border-teal-900/40 rounded-2xl p-4 shadow-lg flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="text-slate-100 font-bold text-base">{voice.title}</h4>
                                        <span className="text-[10px] uppercase font-bold text-teal-500">{voice.status || 'Active'}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleEditClick(voice)} className="p-2 text-slate-400 hover:text-amber-400 bg-slate-900/50 rounded-lg">
                                            <Edit3 size={16} />
                                        </button>
                                        <button onClick={() => deleteVoice(voice.id)} className="p-2 text-slate-400 hover:text-red-400 bg-slate-900/50 rounded-lg">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                {voice.voice_url && (
                                    <audio src={voice.voice_url} controls className="w-full h-8 custom-audio-player" />
                                )}
                                <div className="text-xs text-slate-400 line-clamp-2">
                                    <span className="text-teal-600 font-semibold">When: </span>{voice.usage_instructions || 'None'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Floating Action Button */}
            <button 
                onClick={handleAddClick}
                className="absolute bottom-6 right-6 w-14 h-14 bg-teal-600 hover:bg-teal-500 text-white rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(20,184,166,0.3)] transition-transform active:scale-95 z-40"
            >
                <Plus size={28} />
            </button>
        </div>
    );
}
