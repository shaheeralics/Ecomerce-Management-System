// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft,
    Save, Bot, Send, Mic, Square, Play, Pause, Image as ImageIcon,
    Video, Trash2, X, Loader2, RotateCcw, Volume2, Sparkles
} from 'lucide-react';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    mediaType?: 'image' | 'video' | 'audio' | null;
    mediaUrl?: string | null;
    timestamp: Date;
}

export default function AIAgentPanel() {
    // Config state
    const [systemPrompt, setSystemPrompt] = useState('');
    const [agentEnabled, setAgentEnabled] = useState(true);
    const [saving, setSaving] = useState(false);
    const [configLoaded, setConfigLoaded] = useState(false);

    // Chat state
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);

    // Voice recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Audio playback state
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    // Chat scroll ref
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Load config + chat history on mount
    useEffect(() => {
        fetch('/api/agent-config')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data) {
                    setSystemPrompt(data.data.system_prompt || '');
                    setAgentEnabled(data.data.agent_enabled === 1 || data.data.agent_enabled === true);
                }
                setConfigLoaded(true);
            })
            .catch(err => {
                console.error('Failed to load agent config:', err);
                setConfigLoaded(true);
            });

        // Load saved chat history
        fetch('/api/agent-test/history')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.messages) {
                    const loaded: ChatMessage[] = data.messages.map((m: any) => ({
                        id: `db-${m.id}`,
                        role: m.role as 'user' | 'assistant' | 'system',
                        content: m.content || '',
                        mediaType: m.media_type || null,
                        mediaUrl: m.media_url || null,
                        timestamp: new Date(m.created_at)
                    }));
                    setMessages(loaded);
                }
            })
            .catch(err => console.error('Failed to load chat history:', err));
    }, []);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Save config
    const handleSaveConfig = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/agent-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_prompt: systemPrompt,
                    agent_enabled: agentEnabled,
                    short_delay_seconds: 0,
                    long_delay_seconds: 0,
                    advance_amount: 0
                })
            });
            if (res.ok) {
                // Brief green flash instead of alert
                const btn = document.getElementById('save-config-btn');
                if (btn) {
                    btn.classList.add('!bg-emerald-500');
                    setTimeout(() => btn.classList.remove('!bg-emerald-500'), 1200);
                }
            }
        } catch (e) {
            alert('Error saving configuration.');
        }
        setSaving(false);
    };

    // Send text message to test agent
    const handleSendText = async () => {
        const text = inputText.trim();
        if (!text || sending) return;

        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setSending(true);

        try {
            const res = await fetch('/api/agent-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    history: messages.filter(m => m.role !== 'system').map(m => ({
                        role: m.role,
                        content: m.content
                    }))
                })
            });
            const data = await res.json();
            if (data.success && data.replies) {
                for (const reply of data.replies) {
                    const agentMsg: ChatMessage = {
                        id: `agent-${Date.now()}-${Math.random()}`,
                        role: 'assistant',
                        content: reply.text || '',
                        mediaType: reply.mediaType || null,
                        mediaUrl: reply.mediaUrl || null,
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, agentMsg]);
                }
            } else if (data.error) {
                setMessages(prev => [...prev, {
                    id: `err-${Date.now()}`,
                    role: 'system',
                    content: `Error: ${data.error}`,
                    timestamp: new Date()
                }]);
            }
        } catch (e: any) {
            setMessages(prev => [...prev, {
                id: `err-${Date.now()}`,
                role: 'system',
                content: `Network error: ${e.message}`,
                timestamp: new Date()
            }]);
        }
        setSending(false);
    };

    // Voice recording
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const mimeType = MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')
                ? 'audio/ogg; codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
                ? 'audio/webm; codecs=opus'
                : '';
            const recorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                const finalMime = recorder.mimeType || 'audio/ogg';
                const blob = new Blob(audioChunksRef.current, { type: finalMime });
                stream.getTracks().forEach(t => t.stop());
                streamRef.current = null;

                // Send voice message to test agent
                await sendVoiceMessage(blob);
            };

            recorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = window.setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (e) {
            console.error('Mic access denied:', e);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const sendVoiceMessage = async (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const userMsg: ChatMessage = {
            id: `user-voice-${Date.now()}`,
            role: 'user',
            content: 'Voice Message',
            mediaType: 'audio',
            mediaUrl: url,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMsg]);
        setSending(true);

        try {
            const fd = new FormData();
            fd.append('voice', blob, `voice_${Date.now()}.ogg`);
            fd.append('history', JSON.stringify(messages.filter(m => m.role !== 'system').map(m => ({
                role: m.role,
                content: m.content
            }))));

            const res = await fetch('/api/agent-test/voice', {
                method: 'POST',
                body: fd
            });
            const data = await res.json();
            if (data.success && data.replies) {
                for (const reply of data.replies) {
                    setMessages(prev => [...prev, {
                        id: `agent-${Date.now()}-${Math.random()}`,
                        role: 'assistant',
                        content: reply.text || '',
                        mediaType: reply.mediaType || null,
                        mediaUrl: reply.mediaUrl || null,
                        timestamp: new Date()
                    }]);
                }
            }
        } catch (e: any) {
            setMessages(prev => [...prev, {
                id: `err-${Date.now()}`,
                role: 'system',
                content: `Error: ${e.message}`,
                timestamp: new Date()
            }]);
        }
        setSending(false);
    };

    // Play/pause audio
    const toggleAudioPlay = (msgId: string, url: string) => {
        if (playingAudioId === msgId) {
            audioPlayerRef.current?.pause();
            setPlayingAudioId(null);
            return;
        }
        if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
        }
        const audio = new Audio(url);
        audioPlayerRef.current = audio;
        audio.onended = () => setPlayingAudioId(null);
        audio.play();
        setPlayingAudioId(msgId);
    };

    const clearChat = async () => {
        setMessages([]);
        try {
            await fetch('/api/agent-test/history', { method: 'DELETE' });
        } catch (e) {
            console.error('Failed to clear chat from DB:', e);
        }
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const [activeMobileView, setActiveMobileView] = useState<'prompt' | 'chat' | null>(null);

    if (!configLoaded) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-[#030712]">
                <Loader2 className="animate-spin text-zinc-500" size={32} />
            </div>
        );
    }

    // =======================================
    // ========== MOBILE VIEWS ===============
    // =======================================
    if (activeMobileView === 'prompt') {
        return (
            <div className="absolute inset-0 z-50 bg-[#030712] flex flex-col animate-in slide-in-from-right duration-200 md:hidden">
                <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center px-2 justify-between shrink-0 shadow-sm">
                    <button onClick={() => setActiveMobileView(null)} className="p-3 text-indigo-400 active:opacity-50 flex items-center gap-1">
                        <ChevronLeft size={24} /> <span className="font-semibold">Back</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSaveConfig}
                            disabled={saving}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-sm"
                        >
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
                <div className="flex-1 p-4 overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-white">Agent Status</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={agentEnabled} onChange={e => setAgentEnabled(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                        </label>
                    </div>
                    <label className="text-sm font-bold text-slate-300 mb-2 block">System Prompt</label>
                    <textarea
                        value={systemPrompt}
                        onChange={e => setSystemPrompt(e.target.value)}
                        className="w-full h-64 bg-[#09090b] border border-white/5 rounded-2xl p-4 text-sm text-slate-100 outline-none focus:border-indigo-500 transition-colors"
                        placeholder="Define agent's rules here..."
                    />
                </div>
            </div>
        );
    }

    if (activeMobileView === 'chat') {
        return (
            <div className="absolute inset-0 z-50 bg-[#030712] flex flex-col animate-in slide-in-from-right duration-200 md:hidden">
                <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center px-2 justify-between shrink-0 shadow-sm">
                    <button onClick={() => setActiveMobileView(null)} className="p-3 text-indigo-400 active:opacity-50 flex items-center gap-1">
                        <ChevronLeft size={24} /> <span className="font-semibold">Back</span>
                    </button>
                    <button onClick={clearChat} className="p-3 text-red-400 active:opacity-50 flex items-center gap-1">
                        <Trash2 size={20} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#030712]">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full opacity-50">
                            <Bot size={40} className="text-zinc-500 mb-2" />
                            <p className="text-sm text-zinc-400">Send a message to test agent</p>
                        </div>
                    )}
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                msg.role === 'user' ? 'bg-[#18181b] border border-white/5 text-zinc-200 rounded-tl-sm'
                                : 'bg-white text-black rounded-tr-sm font-medium'
                            }`}>
                                {msg.mediaType === 'audio' && msg.mediaUrl && (
                                    <button onClick={() => toggleAudioPlay(msg.id, msg.mediaUrl!)} className="flex items-center gap-2 p-2 bg-black/10 rounded-lg">
                                        {playingAudioId === msg.id ? <Pause size={14} /> : <Play size={14} />} Audio
                                    </button>
                                )}
                                {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                                <p className="text-[10px] mt-1 opacity-50 text-right">{msg.timestamp.toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit'})}</p>
                            </div>
                        </div>
                    ))}
                    {sending && (
                        <div className="flex justify-start">
                            <div className="bg-white text-black rounded-2xl rounded-tr-sm px-4 py-3 text-sm font-medium opacity-70">
                                Thinking...
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
                <div className="p-2 pb-safe border-t border-white/5 bg-[#09090b] flex items-end gap-2 w-full">
                    {isRecording ? (
                        <div className="flex-1 flex items-center gap-3 bg-red-950/40 border border-red-800/40 rounded-[24px] px-4 py-2 min-h-[44px]">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-base text-red-300">{formatTime(recordingTime)}</span>
                            <div className="flex-1 text-right">
                                <button onClick={stopRecording} className="text-red-400 font-bold p-1"><Square size={20}/></button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 bg-[#18181b] border border-white/5 rounded-[24px] min-h-[44px] flex items-center px-4 py-2">
                                <input 
                                    type="text" 
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSendText()}
                                    placeholder="Message..." 
                                    className="w-full bg-transparent text-base text-zinc-100 outline-none"
                                />
                            </div>
                            {inputText ? (
                                <button onClick={handleSendText} className="bg-indigo-500 text-white p-3 rounded-full font-bold active:scale-95 shrink-0 shadow-lg">
                                    <Send size={20} className="ml-0.5" />
                                </button>
                            ) : (
                                <button onClick={startRecording} className="p-3 text-zinc-400 active:text-white shrink-0">
                                    <Mic size={24} />
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col overflow-hidden bg-[#030712] font-sans">
            
            {/* ======================================= */}
            {/* ========== MOBILE MENU VIEW =========== */}
            {/* ======================================= */}
            <div className="md:hidden flex-1 overflow-y-auto px-4 py-4 space-y-3 pt-6">
                <div className="bg-[#09090b] rounded-2xl border border-white/5 p-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#18181b] flex items-center justify-center text-zinc-400">
                            <Bot size={20} />
                        </div>
                        <div>
                            
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={agentEnabled} onChange={e => {setAgentEnabled(e.target.checked); setTimeout(handleSaveConfig, 100);}} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                    </label>
                </div>

                <div 
                    onClick={() => setActiveMobileView('prompt')}
                    className="bg-[#09090b] rounded-2xl border border-white/5 p-4 active:bg-white/5 transition-colors flex items-center justify-between cursor-pointer shadow-sm"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                            <Save size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-base">System Prompt</h3>
                            <p className="text-xs text-zinc-500">Edit rules & behaviors</p>
                        </div>
                    </div>
                    <ChevronLeft size={20} className="text-zinc-600 rotate-180" />
                </div>

                <div 
                    onClick={() => setActiveMobileView('chat')}
                    className="bg-[#09090b] rounded-2xl border border-white/5 p-4 active:bg-white/5 transition-colors flex items-center justify-between cursor-pointer shadow-sm"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                            <Sparkles size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-base">Test AI Agent</h3>
                            <p className="text-xs text-zinc-500">Live chat sandbox</p>
                        </div>
                    </div>
                    <ChevronLeft size={20} className="text-zinc-600 rotate-180" />
                </div>
            </div>

            {/* ======================================= */}
            {/* ========== DESKTOP VIEW =============== */}
            {/* ======================================= */}
            <div className="hidden md:flex h-full w-full">
                {/* Left: Configuration */}
                <div className="w-[400px] border-r border-white/5 flex flex-col h-full bg-[#09090b]">
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Bot size={24} className="text-white" />
                            
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={agentEnabled} onChange={e => setAgentEnabled(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                        </label>
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-bold text-white">System Prompt</label>
                            <span className="text-[10px] bg-[#18181b] border border-white/10 px-2 py-1 rounded text-zinc-400">ReAct Powered</span>
                        </div>
                        <textarea
                            value={systemPrompt}
                            onChange={e => setSystemPrompt(e.target.value)}
                            className="w-full flex-1 bg-[#18181b] border border-white/5 rounded-xl p-4 text-sm text-slate-200 outline-none focus:border-indigo-500 resize-none custom-scrollbar mb-4"
                        />
                        <button
                            onClick={handleSaveConfig}
                            disabled={saving}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white w-full py-3 rounded-xl font-bold transition-colors"
                        >
                            {saving ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                </div>

                {/* Right: Testing Chat */}
                <div className="flex-1 flex flex-col h-full bg-[#030712]">
                    <div className="h-16 border-b border-white/5 bg-[#09090b] flex items-center px-6 justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#18181b] flex items-center justify-center">
                                <Sparkles size={14} className="text-zinc-400" />
                            </div>
                            <span className="font-bold text-white">Agent Sandbox</span>
                        </div>
                        <button onClick={clearChat} className="text-xs text-red-400 hover:text-red-300 font-semibold flex items-center gap-1 transition-colors">
                            <Trash2 size={14} /> Clear
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full opacity-50">
                                <Bot size={48} className="text-zinc-600 mb-3" />
                                <p className="text-zinc-400 font-medium">Test your AI Agent</p>
                            </div>
                        )}
                        {messages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] rounded-2xl px-5 py-3 text-sm shadow-sm ${
                                    msg.role === 'user' ? 'bg-[#18181b] border border-white/5 text-zinc-200 rounded-tl-sm'
                                    : 'bg-white text-black rounded-tr-sm font-medium'
                                }`}>
                                    {msg.mediaType === 'audio' && msg.mediaUrl && (
                                        <button onClick={() => toggleAudioPlay(msg.id, msg.mediaUrl!)} className="flex items-center gap-2 p-2 bg-black/10 rounded-lg">
                                            {playingAudioId === msg.id ? <Pause size={14} /> : <Play size={14} />} Play Audio
                                        </button>
                                    )}
                                    {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="p-4 border-t border-white/5 bg-[#09090b]">
                        <div className="flex items-center gap-2">
                            {isRecording ? (
                                <div className="flex-1 flex items-center gap-3 bg-red-950/40 border border-red-800/40 rounded-full px-4 py-3">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                                    <span className="text-sm text-red-300">{formatTime(recordingTime)}</span>
                                    <button onClick={stopRecording} className="ml-auto text-red-400 font-bold"><Square size={16}/></button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex-1 bg-[#18181b] border border-white/5 rounded-full px-5 py-3 flex items-center focus-within:ring-1 focus-within:ring-white/20 transition-all">
                                        <input
                                            type="text"
                                            value={inputText}
                                            onChange={e => setInputText(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSendText()}
                                            placeholder="Message..."
                                            disabled={sending}
                                            className="w-full bg-transparent text-sm text-zinc-100 outline-none disabled:opacity-50"
                                        />
                                    </div>
                                    <button onClick={startRecording} disabled={sending} className="bg-[#18181b] hover:bg-white/10 border border-white/5 text-white p-3.5 rounded-full transition-colors"><Mic size={16}/></button>
                                    <button onClick={handleSendText} disabled={!inputText.trim() || sending} className="bg-white hover:bg-zinc-200 text-black p-3.5 rounded-full transition-colors"><Send size={16}/></button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
