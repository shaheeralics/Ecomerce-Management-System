import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Play, Pause, Edit3, Trash2, Move, ZoomIn, ZoomOut, Minimize2, Scissors, ShieldAlert, CheckCircle, RefreshCw, X, Plus, FileText } from 'lucide-react';

const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const createWavFile = async (blob: Blob): Promise<Blob> => {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const buffer = await audioContext.decodeAudioData(arrayBuffer);

    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    const channels = [];
    let sampleRate = buffer.sampleRate;
    let offset = 0;
    let pos = 0;

    const writeString = (str: string) => {
        for (let i = 0; i < str.length; i++) {
            out.setUint8(pos + i, str.charCodeAt(i));
        }
        pos += str.length;
    };
    const writeUint16 = (data: number) => { out.setUint16(pos, data, true); pos += 2; };
    const writeUint32 = (data: number) => { out.setUint32(pos, data, true); pos += 4; };

    writeString('RIFF');
    writeUint32(length - 8);
    writeString('WAVE');
    writeString('fmt ');
    writeUint32(16);
    writeUint16(1);
    writeUint16(numOfChan);
    writeUint32(sampleRate);
    writeUint32(sampleRate * 2 * numOfChan);
    writeUint16(numOfChan * 2);
    writeUint16(16);
    writeString('data');
    writeUint32(length - pos - 4);

    for (let i = 0; i < buffer.numberOfChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    while (offset < buffer.length) {
        for (let i = 0; i < numOfChan; i++) {
            let sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            out.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }
    return new Blob([out], { type: 'audio/wav' });
};

interface VoiceAsset {
    id: number;
    category: string;
    title: string;
    usage_instructions: string;
    transcription: string;
    voice_url: string | null;
    status: string;
}

export default function VoiceAssetsTab({ category, title, description }: { category: 'policy' | 'prerecorded', title: string, description: string }) {
    const [voices, setVoices] = useState<VoiceAsset[]>([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    
    const [formData, setFormData] = useState({ title: '', usage_instructions: '', transcription: '' });
    const [isTranscribing, setIsTranscribing] = useState(false);

    // Audio States
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
    const [visualizerData, setVisualizerData] = useState<number[]>(Array(24).fill(10));

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerIntervalRef = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const fetchVoices = async (silentMerge = false) => {
        if (!silentMerge) setLoading(true);
        try {
            const res = await fetch(`/api/voices/${category}?_t=${Date.now()}`);
            const data = await res.json();
            if (data.success) {
                if (silentMerge) {
                    setVoices(prev => {
                        const merged = data.data.map((dbV: any) => {
                            const loc = prev.find(p => p.id === dbV.id);
                            if (loc && dbV.status === 'uploading') {
                                return { ...dbV, voice_url: dbV.voice_url || loc.voice_url };
                            }
                            return dbV;
                        });
                        const optimistic = prev.filter(p => p.id < 0);
                        return [...optimistic, ...merged];
                    });
                } else {
                    setVoices(data.data);
                }
            }
        } catch (err) {}
        if (!silentMerge) setLoading(false);
    };

    useEffect(() => { fetchVoices(); }, [category]);

    useEffect(() => {
        const hasUploading = voices.some(v => v.status === 'uploading');
        if (!hasUploading) return;
        const interval = setInterval(() => fetchVoices(true), 3000);
        return () => clearInterval(interval);
    }, [voices, category]);

    const resetForm = () => {
        setFormData({ title: '', usage_instructions: '', transcription: '' });
        setAudioBlob(null);
        setAudioPreviewUrl(null);
        setIsRecording(false);
        setIsPaused(false);
        setShowModal(false);
    };

    const drawVisualizer = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);
        const newData = [];
        const step = Math.floor(dataArrayRef.current.length / 24);
        for (let i = 0; i < 24; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) {
                sum += dataArrayRef.current[i * step + j];
            }
            let avg = sum / step;
            let percent = (avg / 255) * 100;
            newData.push(Math.max(15, percent));
        }
        setVisualizerData(newData);
        animationFrameRef.current = requestAnimationFrame(drawVisualizer);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;
            dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
            drawVisualizer();

            recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            recorder.onstop = async () => {
                let blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                blob = await createWavFile(blob);
                setAudioBlob(blob);
                setAudioPreviewUrl(URL.createObjectURL(blob));
                if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
                stream.getTracks().forEach(t => t.stop());
                if (audioContextRef.current) audioContextRef.current.close();
            };

            recorder.start(100);
            setIsRecording(true);
            setIsPaused(false);
            setRecordingTime(0);
            timerIntervalRef.current = window.setInterval(() => setRecordingTime(t => t + 1), 1000);
        } catch (err) {
            alert('Mic access denied');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsPaused(false);
        }
    };

    const transcribeAudio = async () => {
        if (!audioBlob) return alert('Record audio first.');
        setIsTranscribing(true);
        try {
            const fd = new FormData();
            fd.append('audio', audioBlob, 'voice.wav');
            const res = await fetch('/api/voices/transcribe', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) {
                setFormData(prev => ({ ...prev, transcription: data.transcription }));
            } else {
                alert('Transcription failed: ' + data.error);
            }
        } catch (err) {
            alert('Transcription error');
        }
        setIsTranscribing(false);
    };

    const submitVoice = () => {
        if (!formData.title || !audioBlob) return alert('Title and Audio required');
        const tempId = -Date.now();
        const tempVoice: VoiceAsset = {
            id: tempId,
            category,
            title: formData.title,
            usage_instructions: formData.usage_instructions,
            transcription: formData.transcription,
            voice_url: audioPreviewUrl,
            status: 'uploading'
        };
        setVoices(prev => [tempVoice, ...prev]);
        setShowModal(false);

        const fd = new FormData();
        fd.append('title', formData.title);
        fd.append('usage_instructions', formData.usage_instructions);
        fd.append('transcription', formData.transcription);
        fd.append('voice', audioBlob, 'voice.wav');

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/voices/${category}`);
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const resData = JSON.parse(xhr.responseText);
                    if (resData.success) {
                        setVoices(prev => prev.map(p => p.id === tempId ? { ...p, id: resData.id } : p));
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
        setVoices(prev => prev.filter(p => p.id !== id));
        await fetch(`/api/voices/${id}`, { method: 'DELETE' });
    };

    return (
        <div className="space-y-6 max-w-6xl pb-10">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-bold text-slate-100 tracking-tight">{title}</h3>
                    <p className="text-slate-400 text-xs mt-1">{description}</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-teal-600/30 flex items-center gap-2"
                >
                    <Plus size={16} /> Add Voice
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div></div>
            ) : voices.length === 0 ? (
                <div className="border border-dashed border-teal-900/40 rounded-3xl h-64 flex flex-col items-center justify-center text-slate-500">
                    <p className="font-semibold text-slate-300">No voices listed yet</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {voices.map(voice => (
                        <div key={voice.id} className="bg-[#09181E] border border-teal-900/40 rounded-2xl p-5 shadow-xl flex flex-col gap-4 group relative">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="text-slate-100 font-bold text-lg">{voice.title}</h4>
                                    <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-500/10 text-teal-400 border border-teal-500/20">
                                        {voice.status}
                                    </span>
                                </div>
                                <button onClick={() => deleteVoice(voice.id)} className="text-slate-500 hover:text-red-400 p-1"><Trash2 size={16} /></button>
                            </div>
                            
                            {voice.voice_url && (
                                <audio src={voice.voice_url} controls className="w-full h-10 custom-audio-player" />
                            )}

                            <div>
                                <h5 className="text-teal-500 text-[10px] uppercase font-bold tracking-wider mb-1">When to Use</h5>
                                <p className="text-slate-300 text-xs line-clamp-3">{voice.usage_instructions || 'None'}</p>
                            </div>

                            <div className="mt-auto pt-2 border-t border-teal-900/30">
                                <h5 className="text-amber-500 text-[10px] uppercase font-bold tracking-wider mb-1">Transcription (AI Context)</h5>
                                <p className="text-slate-400 text-[11px] italic line-clamp-4 leading-relaxed">{voice.transcription || 'Not transcribed yet.'}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-[#09181E] border border-teal-900/50 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
                        <div className="bg-[#0B1E26] border-b border-teal-900/50 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
                            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                                <Mic className="text-teal-400" size={22} /> Add New Voice Asset
                            </h2>
                            <button onClick={resetForm} className="p-2 bg-[#050D10] text-slate-400 hover:text-slate-200 hover:bg-teal-900/30 rounded-xl transition-all cursor-pointer">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-2">Voice Title</label>
                                <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-4 py-3 text-sm text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="e.g. 7 Days Return Policy" />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-2">When should AI use this voice?</label>
                                <textarea value={formData.usage_instructions} onChange={e => setFormData({ ...formData, usage_instructions: e.target.value })} className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-4 py-3 text-sm text-slate-100 h-24 focus:ring-2 focus:ring-teal-500 outline-none resize-none" placeholder="e.g. Play this voice note when the customer specifically asks about our refund or return policy." />
                            </div>

                            <div className="bg-[#050D10] border border-teal-900/40 rounded-xl p-6 text-center shadow-inner">
                                <h4 className="text-teal-400 font-semibold text-xs uppercase tracking-wider mb-4">Record Voice</h4>
                                {!isRecording && !audioPreviewUrl && (
                                    <button onClick={startRecording} className="mx-auto w-[60px] h-[60px] rounded-full bg-[#FF3B30] hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/40 transform hover:scale-105 transition-all"><Mic size={28} /></button>
                                )}
                                {isRecording && (
                                    <div className="flex items-center w-full max-w-[320px] mx-auto relative h-[60px]">
                                        <div className="bg-[#FF3B30] h-[48px] w-full rounded-full flex items-center pl-6 pr-2 justify-between gap-[3px] shadow-sm overflow-hidden animate-fade-in">
                                            <div className="flex items-center gap-1.5 text-white font-mono text-sm ml-1">
                                                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                                {formatTimer(recordingTime)}
                                            </div>
                                            <div className="flex items-center justify-between gap-[3px] h-full flex-1 mx-2 overflow-hidden">
                                                {visualizerData.map((h, i) => (
                                                    <div key={i} className="w-[3px] rounded-full bg-white transition-all duration-150" style={{ height: `${h}%` }} />
                                                ))}
                                            </div>
                                            <button onClick={stopRecording} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors flex-shrink-0 mr-1 text-white">
                                                <Square size={12} className="fill-current" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {audioPreviewUrl && !isRecording && (
                                    <div className="space-y-4">
                                        <audio src={audioPreviewUrl} controls className="w-full custom-audio-player h-12" />
                                        <div className="flex items-center gap-2 justify-center pt-2">
                                            <button onClick={() => { setAudioBlob(null); setAudioPreviewUrl(null); }} className="text-red-400 font-semibold text-xs px-3 py-1.5 bg-red-950/30 hover:bg-red-900/50 rounded-lg transition-colors border border-red-900/40">Discard & Re-record</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {audioPreviewUrl && (
                                <div className="bg-[#140F08] border border-amber-900/40 rounded-xl p-6 space-y-4 shadow-inner">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-amber-500 font-semibold text-xs uppercase tracking-wider flex items-center gap-2">
                                            <FileText size={16} /> Speech-to-Text Transcription
                                        </h4>
                                        <button onClick={transcribeAudio} disabled={isTranscribing} className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-lg flex items-center gap-2 disabled:opacity-50">
                                            {isTranscribing ? <RefreshCw className="animate-spin" size={14} /> : <Edit3 size={14} />} 
                                            {isTranscribing ? 'Transcribing...' : 'Convert to Text'}
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-slate-400">Convert the recorded audio to text so the AI Agent can understand exactly what you are saying and use this voice accurately.</p>
                                    <textarea value={formData.transcription} onChange={e => setFormData({ ...formData, transcription: e.target.value })} className="w-full bg-[#050D10] border border-amber-900/50 rounded-xl px-4 py-3 text-sm text-slate-100 h-28 focus:ring-2 focus:ring-amber-500 outline-none resize-none" placeholder="Click 'Convert to Text' to auto-generate, or type manually..." />
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-teal-900/50 bg-[#0A181D] flex justify-end gap-3 z-20 sticky bottom-0">
                            <button onClick={resetForm} className="px-6 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-semibold transition-all">Cancel</button>
                            <button onClick={submitVoice} disabled={!formData.title || !audioBlob} className="bg-teal-600 hover:bg-teal-500 text-white px-8 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-teal-600/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                <CheckCircle size={18} /> Save & Upload Voice
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
