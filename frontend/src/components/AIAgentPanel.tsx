import React, { useState, useEffect, useRef } from 'react';
import {
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

    if (!configLoaded) {
        return (
            <div className="h-full w-full flex items-center justify-center">
                <Loader2 className="animate-spin text-teal-400" size={32} />
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col overflow-hidden">
            {/* Top: Agent Config Section */}
            <div className="flex-shrink-0 p-3 md:p-6 pb-4 border-b border-teal-900/30 overflow-y-auto custom-scrollbar" style={{ maxHeight: '45%' }}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-600/30">
                            <Bot size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-base md:text-lg font-bold text-slate-100 tracking-tight">AI Agent</h1>
                            <p className="text-[10px] text-slate-500">Autonomous sales agent powered by your system prompt</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Agent ON/OFF Toggle */}
                        <div className="flex items-center gap-2.5 bg-[#0A181D] border border-teal-900/40 rounded-xl px-4 py-2.5">
                            <span className={`text-xs font-semibold ${agentEnabled ? 'text-emerald-400' : 'text-red-400'}`}>
                                {agentEnabled ? 'Active' : 'Inactive'}
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={agentEnabled}
                                    onChange={e => setAgentEnabled(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                            </label>
                        </div>
                        <button
                            id="save-config-btn"
                            onClick={handleSaveConfig}
                            disabled={saving}
                            className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                        >
                            <Save size={14} /> {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>

                {/* System Prompt */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-slate-300">System Prompt</label>
                        <span className="text-[10px] text-teal-400 bg-teal-950/60 border border-teal-800/40 px-2 py-0.5 rounded-md font-mono">
                            Product Catalog Access & ReAct Reasoning
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mb-2">
                        Define your agent's personality, store rules, tone, and policies. The agent uses this prompt combined with autonomous thinking, product search, and sales protection to respond to customers.
                    </p>
                    <textarea
                        value={systemPrompt}
                        onChange={e => setSystemPrompt(e.target.value)}
                        rows={6}
                        className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-teal-500 outline-none resize-y custom-scrollbar"
                        placeholder="You are an elite sales assistant for Pawanda Shoes. Greet customers politely in Roman Urdu, showcase available shoes, and assist them..."
                    />
                </div>
            </div>

            {/* Bottom: Testing Chat UI */}
            <div className="flex-1 flex flex-col min-h-0">
                {/* Chat Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-teal-900/30 bg-[#0A181D]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                            <Sparkles size={14} className="text-white" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-200">Agent Testing Chat</p>
                            <p className="text-[10px] text-slate-500">Test your agent's behavior live</p>
                        </div>
                    </div>
                    <button
                        onClick={clearChat}
                        className="text-[10px] text-red-400 hover:text-red-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                        <RotateCcw size={12} /> Clear Chat
                    </button>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 custom-scrollbar" style={{ background: 'linear-gradient(180deg, #071317 0%, #0A1A1F 100%)' }}>
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                            <Bot size={40} className="text-teal-600 mb-3" />
                            <p className="text-xs text-slate-400">Send a message to test your AI agent</p>
                            <p className="text-[10px] text-slate-600 mt-1">The agent will use the system prompt above</p>
                        </div>
                    )}

                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-md ${
                                    msg.role === 'user'
                                        ? 'bg-teal-600 text-white rounded-br-md'
                                        : msg.role === 'system'
                                        ? 'bg-red-950/60 text-red-300 border border-red-900/40 rounded-bl-md'
                                        : 'bg-[#0D2128] text-slate-200 border border-teal-900/30 rounded-bl-md'
                                }`}
                            >
                                {/* Media content */}
                                {msg.mediaType === 'image' && msg.mediaUrl && (
                                    <img src={msg.mediaUrl} alt="Product" className="rounded-lg mb-2 max-w-full max-h-48 object-cover" />
                                )}
                                {msg.mediaType === 'video' && msg.mediaUrl && (
                                    <video src={msg.mediaUrl} controls className="rounded-lg mb-2 max-w-full max-h-48" />
                                )}
                                {msg.mediaType === 'audio' && msg.mediaUrl && (
                                    <button
                                        onClick={() => toggleAudioPlay(msg.id, msg.mediaUrl!)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-1.5 transition-colors cursor-pointer ${
                                            msg.role === 'user'
                                                ? 'bg-teal-700/60 hover:bg-teal-700'
                                                : 'bg-teal-950/60 hover:bg-teal-900/60'
                                        }`}
                                    >
                                        {playingAudioId === msg.id
                                            ? <Pause size={14} className="text-white" />
                                            : <Play size={14} className="text-white" />}
                                        <div className="flex items-center gap-[2px]">
                                            {Array.from({ length: 20 }).map((_, i) => (
                                                <div
                                                    key={i}
                                                    className={`w-[2px] rounded-full ${
                                                        playingAudioId === msg.id ? 'bg-white animate-pulse' : 'bg-white/50'
                                                    }`}
                                                    style={{ height: `${8 + Math.sin(i * 0.7) * 6 + Math.random() * 4}px` }}
                                                />
                                            ))}
                                        </div>
                                        <Volume2 size={12} className="text-white/60" />
                                    </button>
                                )}
                                {/* Text content */}
                                {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                                {/* Timestamp */}
                                <p className={`text-[9px] mt-1 ${
                                    msg.role === 'user' ? 'text-teal-200/60' : 'text-slate-500'
                                }`}>
                                    {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ))}

                    {sending && (
                        <div className="flex justify-start">
                            <div className="bg-[#0D2128] border border-teal-900/30 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span className="text-[10px] text-slate-500">Agent is thinking...</span>
                            </div>
                        </div>
                    )}

                    <div ref={chatEndRef} />
                </div>

                {/* Chat Input Bar */}
                <div className="flex-shrink-0 px-6 py-3 border-t border-teal-900/30 bg-[#0A181D]">
                    {isRecording ? (
                        <div className="flex items-center gap-3">
                            <div className="flex-1 flex items-center gap-3 bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-xs text-red-300 font-mono">{formatTime(recordingTime)}</span>
                                <span className="text-[10px] text-red-400/60">Recording voice message...</span>
                            </div>
                            <button
                                onClick={stopRecording}
                                className="w-10 h-10 rounded-xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg cursor-pointer transition-colors"
                            >
                                <Square size={16} className="fill-current" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }}
                                placeholder="Type a message to test the agent..."
                                disabled={sending}
                                className="flex-1 bg-[#050D10] border border-teal-900/50 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-50"
                            />
                            <button
                                onClick={startRecording}
                                disabled={sending}
                                className="w-10 h-10 rounded-xl bg-[#0D2128] border border-teal-900/40 hover:bg-teal-950/60 text-teal-400 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50"
                                title="Record Voice Message"
                            >
                                <Mic size={16} />
                            </button>
                            <button
                                onClick={handleSendText}
                                disabled={!inputText.trim() || sending}
                                className="w-10 h-10 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-30 text-white flex items-center justify-center cursor-pointer transition-colors shadow-lg shadow-teal-600/20"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
