// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Save, Bot, Send, Mic, Square, Play, Pause, Trash2, X, Loader2, Volume2, Sparkles, Plus, Edit3, MessageSquare } from 'lucide-react';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    mediaType?: 'image' | 'video' | 'audio' | null;
    mediaUrl?: string | null;
    timestamp: Date;
}

interface PromptBlock {
    id: string;
    title: string;
    content: string;
}

const parseSystemPrompt = (text: string): PromptBlock[] => {
    if (!text) return [];
    if (text.includes('---[TITLE: ')) {
        const regex = /---\[TITLE: (.*?)\]---\n([\s\S]*?)(?=(?:---\[TITLE: )|$)/g;
        const blocks: PromptBlock[] = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
            blocks.push({
                id: Math.random().toString(),
                title: match[1].trim(),
                content: match[2].trim()
            });
        }
        if (blocks.length > 0) return blocks;
    }
    return [{
        id: Math.random().toString(),
        title: 'General Rules',
        content: text.trim()
    }];
};

const serializeSystemPrompt = (blocks: PromptBlock[]): string => {
    return blocks
        .filter(b => b.title.trim() || b.content.trim())
        .map(b => `---[TITLE: ${b.title.trim() || 'Rule'}]---\n${b.content.trim()}`)
        .join('\n\n');
};

export default function AIAgentPanel() {
    // Config state
    const [agentEnabled, setAgentEnabled] = useState(true);
    const [saving, setSaving] = useState(false);
    const [configLoaded, setConfigLoaded] = useState(false);
    const [promptBlocks, setPromptBlocks] = useState<PromptBlock[]>([]);

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
    
    // View state
    const [activeMobileView, setActiveMobileView] = useState<'prompt' | 'chat' | null>(null);
    const [desktopView, setDesktopView] = useState<'prompts' | 'chat'>('prompts');

    // Load config + chat history on mount
    useEffect(() => {
        fetch('/api/agent-config')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data) {
                    setPromptBlocks(parseSystemPrompt(data.data.system_prompt || ''));
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
        const finalPrompt = serializeSystemPrompt(promptBlocks);
        try {
            const res = await fetch('/api/agent-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_prompt: finalPrompt,
                    agent_enabled: agentEnabled,
                    short_delay_seconds: 0,
                    long_delay_seconds: 0,
                    advance_amount: 0
                })
            });
            if (res.ok) {
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

    // Prompt Block Management
    const addPromptBlock = () => {
        setPromptBlocks([...promptBlocks, { id: Math.random().toString(), title: '', content: '' }]);
    };

    const updatePromptBlock = (id: string, field: 'title' | 'content', value: string) => {
        setPromptBlocks(promptBlocks.map(b => b.id === id ? { ...b, [field]: value } : b));
    };

    const removePromptBlock = (id: string) => {
        setPromptBlocks(promptBlocks.filter(b => b.id !== id));
    };

    // Chat / Voice methods
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
            <div className="h-full w-full flex items-center justify-center bg-[#030712]">
                <Loader2 className="animate-spin text-zinc-500" size={32} />
            </div>
        );
    }

    const renderPromptsView = () => (
        <div className="flex-1 flex flex-col h-full bg-[#030712]">
            <div className="h-16 border-b border-white/5 bg-[#09090b] flex items-center px-4 md:px-6 justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <span className="font-bold text-white">System Prompts</span>
                </div>
                <button
                    id="save-config-btn"
                    onClick={handleSaveConfig}
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 md:px-6 md:py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
                >
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    {saving ? 'Saving...' : 'Save All'}
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-bold text-white">Agent Rules & Behaviors</h2>
                        <button onClick={addPromptBlock} className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg flex items-center gap-2">
                            <Plus size={16} /> Add Prompt
                        </button>
                    </div>
                    
                    {promptBlocks.length === 0 ? (
                        <div className="text-center py-20 border border-white/5 border-dashed rounded-3xl bg-[#09090b]">
                            <p className="text-zinc-500 mb-4">No system prompts defined.</p>
                            <button onClick={addPromptBlock} className="bg-white/5 hover:bg-white/10 text-white px-6 py-2 rounded-xl text-sm font-bold transition-all border border-white/10">
                                Create First Prompt
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6 pb-20">
                            {promptBlocks.map((block, index) => (
                                <div key={block.id} className="bg-[#09090b] border border-white/5 rounded-3xl overflow-hidden shadow-xl group">
                                    <div className="h-12 bg-[#18181b] border-b border-white/5 flex items-center px-4 justify-between">
                                        <div className="flex items-center gap-3 w-full max-w-sm">
                                            <span className="text-zinc-500 font-bold text-xs bg-black/40 px-2 py-1 rounded-lg">#{index + 1}</span>
                                            <input 
                                                type="text" 
                                                value={block.title} 
                                                onChange={e => updatePromptBlock(block.id, 'title', e.target.value)} 
                                                placeholder="Prompt Title (e.g. Store Policy)" 
                                                className="bg-transparent border-none outline-none text-white font-bold w-full text-sm placeholder:text-zinc-600" 
                                            />
                                        </div>
                                        <button onClick={() => removePromptBlock(block.id)} className="text-zinc-500 hover:text-red-400 transition-colors p-2">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <div className="p-4">
                                        <textarea
                                            value={block.content}
                                            onChange={e => updatePromptBlock(block.id, 'content', e.target.value)}
                                            placeholder="Enter rules or instructions here..."
                                            className="w-full h-40 bg-transparent border-none outline-none text-sm text-zinc-300 resize-y custom-scrollbar leading-relaxed placeholder:text-zinc-700"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderChatView = () => (
        <div className="flex-1 flex flex-col h-full bg-[#0b141a] md:bg-[#030712]">
            <div className="h-14 md:h-16 border-b border-white/5 bg-[#202c33] md:bg-[#09090b] flex items-center px-2 md:px-6 justify-between shrink-0 shadow-sm">
                <div className="flex items-center gap-2 md:gap-3">
                    {/* Only show back button on mobile if needed, but since we use sidebar, let's keep it consistent */}
                    <div className="w-9 h-9 md:w-8 md:h-8 rounded-full bg-indigo-500/20 flex items-center justify-center overflow-hidden border border-white/10 md:border-indigo-500/30">
                        <Bot size={20} className="text-indigo-200 md:text-indigo-400 md:w-4 md:h-4"/>
                    </div>
                    <span className="font-bold text-white md:text-base text-sm">Agent Sandbox</span>
                </div>
                <button onClick={clearChat} className="p-3 md:p-0 md:text-xs text-white/80 md:text-red-400 hover:text-red-300 font-semibold flex items-center gap-1 transition-colors active:opacity-50">
                    <Trash2 size={20} className="md:w-3.5 md:h-3.5" /> <span className="hidden md:inline">Clear</span>
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 md:p-6 bg-[#0b141a] md:bg-transparent relative custom-scrollbar">
                <div className="relative z-10 space-y-2 md:space-y-4 max-w-4xl mx-auto">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center mt-10 md:mt-20 opacity-50">
                            <Sparkles size={48} className="text-zinc-500 mb-3" />
                            <p className="text-zinc-400 font-medium text-sm md:text-base">Test your AI Agent</p>
                        </div>
                    )}
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                            {/* Mobile uses Whatsapp styling, Desktop uses modern styling */}
                            <div className={`
                                md:hidden max-w-[85%] rounded-lg px-2 pt-2 pb-1 text-[15px] shadow-sm relative
                                ${msg.role === 'user' ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none' : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'}
                            `}>
                                {msg.mediaType === 'audio' && msg.mediaUrl && (
                                    <button onClick={() => toggleAudioPlay(msg.id, msg.mediaUrl!)} className="flex items-center gap-2 p-2 bg-black/20 rounded-lg mb-1 text-xs">
                                        {playingAudioId === msg.id ? <Pause size={14} /> : <Play size={14} />} Play
                                    </button>
                                )}
                                {msg.content && <p className="whitespace-pre-wrap leading-tight">{msg.content}</p>}
                                <div className="text-[10px] text-right mt-1 opacity-60 flex justify-end items-center gap-1 float-right ml-3">
                                    {msg.timestamp.toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit'})}
                                </div>
                                <div className="clear-both" />
                            </div>

                            <div className={`
                                hidden md:block max-w-[75%] rounded-2xl px-5 py-3 text-sm shadow-sm
                                ${msg.role === 'user' ? 'bg-[#18181b] border border-white/5 text-zinc-200 rounded-tr-sm' : 'bg-white text-black rounded-tl-sm font-medium'}
                            `}>
                                {msg.mediaType === 'audio' && msg.mediaUrl && (
                                    <button onClick={() => toggleAudioPlay(msg.id, msg.mediaUrl!)} className={`flex items-center gap-2 p-2 rounded-lg mb-2 text-xs ${msg.role === 'user' ? 'bg-white/10' : 'bg-black/5'}`}>
                                        {playingAudioId === msg.id ? <Pause size={14} /> : <Play size={14} />} Play Audio
                                    </button>
                                )}
                                {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                            </div>
                        </div>
                    ))}
                    {sending && (
                        <div className="flex justify-start w-full">
                            <div className="md:hidden bg-[#202c33] text-[#e9edef] rounded-lg rounded-tl-none px-3 py-2 text-[13px] shadow-sm italic opacity-70">
                                Typing...
                            </div>
                            <div className="hidden md:block bg-white text-black rounded-2xl rounded-tl-sm px-5 py-3 text-sm shadow-sm italic opacity-70 font-medium">
                                Agent is thinking...
                            </div>
                        </div>
                    )}
                </div>
                <div ref={chatEndRef} className="h-4" />
            </div>

            {/* Chat Input */}
            <div className="p-1.5 md:p-4 pb-safe bg-[#0b141a] md:bg-[#09090b] md:border-t md:border-white/5 flex items-end gap-1.5 md:gap-3 w-full shrink-0 justify-center">
                <div className="flex-1 max-w-4xl flex items-end gap-1.5 md:gap-3 w-full">
                    {isRecording ? (
                        <div className="flex-1 flex items-center gap-3 bg-red-950/40 border border-red-800/40 rounded-full px-4 py-2.5 md:py-3.5 shadow-sm">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-sm text-red-300 font-bold">{formatTime(recordingTime)}</span>
                            <button onClick={stopRecording} className="ml-auto text-red-400 hover:text-red-300 font-bold p-1"><Square size={16}/></button>
                        </div>
                    ) : (
                        <div className="flex-1 bg-[#2a2f32] md:bg-[#18181b] md:border md:border-white/5 rounded-3xl min-h-[44px] md:min-h-[50px] max-h-[100px] overflow-y-auto flex items-end px-4 py-2.5 md:py-3.5 shadow-sm md:focus-within:ring-1 md:focus-within:ring-white/20 transition-all">
                            <input 
                                type="text" 
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSendText()}
                                placeholder="Message..." 
                                disabled={sending}
                                className="w-full bg-transparent text-[15px] md:text-sm text-zinc-100 outline-none leading-tight disabled:opacity-50"
                            />
                        </div>
                    )}
                    {!isRecording && (
                        <>
                            {inputText ? (
                                <button onClick={handleSendText} disabled={sending} className="w-[44px] h-[44px] md:w-[50px] md:h-[50px] rounded-full bg-[#00a884] md:bg-white text-white md:text-black flex items-center justify-center shrink-0 shadow-md active:scale-95 transition-transform disabled:opacity-50 hover:bg-zinc-200">
                                    <Send size={18} className="ml-0.5 md:ml-0" />
                                </button>
                            ) : (
                                <button onClick={startRecording} disabled={sending} className="w-[44px] h-[44px] md:w-[50px] md:h-[50px] rounded-full bg-[#00a884] md:bg-[#18181b] md:border md:border-white/5 text-white flex items-center justify-center shrink-0 shadow-md active:scale-95 transition-transform disabled:opacity-50 md:hover:bg-white/10">
                                    <Mic size={18} />
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );


    // =======================================
    // ========== MOBILE VIEW ================
    // =======================================
    if (activeMobileView) {
        return (
            <div className="absolute inset-0 z-50 flex flex-col md:hidden">
                {/* Back button header if in a mobile subview, though we can just render the views */}
                {activeMobileView === 'prompt' && (
                    <div className="absolute inset-0 z-50 bg-[#030712] flex flex-col animate-in slide-in-from-right duration-200">
                        <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center px-2 shrink-0 shadow-sm relative">
                            <button onClick={() => setActiveMobileView(null)} className="absolute left-2 p-3 text-indigo-400 active:opacity-50 flex items-center gap-1 z-10">
                                <ChevronLeft size={24} />
                            </button>
                            <h1 className="w-full text-center font-bold text-white">Prompts</h1>
                        </div>
                        {renderPromptsView()}
                    </div>
                )}
                {activeMobileView === 'chat' && (
                    <div className="absolute inset-0 z-50 flex flex-col animate-in slide-in-from-right duration-200">
                        <div className="h-14 bg-[#202c33] flex items-center px-2 shrink-0 shadow-sm relative z-50">
                            <button onClick={() => setActiveMobileView(null)} className="absolute left-2 p-2 text-white active:opacity-50 flex items-center gap-1 z-10">
                                <ChevronLeft size={28} />
                            </button>
                        </div>
                        <div className="absolute inset-0 pt-14 flex flex-col">
                            {renderChatView()}
                        </div>
                    </div>
                )}
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
                            <h3 className="font-bold text-white">Agent Status</h3>
                            <p className="text-xs text-zinc-500">{agentEnabled ? 'Active' : 'Disabled'}</p>
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
                        <div>
                            <h3 className="font-bold text-white text-base">System Prompts</h3>
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
                {/* Left Sidebar */}
                <div className="w-[320px] lg:w-[400px] border-r border-white/5 flex flex-col h-full bg-[#09090b]">
                    <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <Bot size={24} className="text-white" />
                            <span className="font-bold text-white">Agent Options</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer" title="Enable/Disable Agent">
                            <input type="checkbox" checked={agentEnabled} onChange={e => {setAgentEnabled(e.target.checked); setTimeout(handleSaveConfig, 100);}} className="sr-only peer" />
                            <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                        </label>
                    </div>
                    <div className="p-4 space-y-2 flex-1">
                        <button
                            onClick={() => setDesktopView('prompts')}
                            className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-all ${desktopView === 'prompts' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm' : 'text-zinc-400 hover:bg-white/5 border border-transparent'}`}
                        >
                            <div className="text-left flex-1">
                                <h3 className="font-bold text-sm">System Prompts</h3>
                                <p className="text-[11px] opacity-70">Manage agent rules</p>
                            </div>
                        </button>
                        <button
                            onClick={() => setDesktopView('chat')}
                            className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-all ${desktopView === 'chat' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' : 'text-zinc-400 hover:bg-white/5 border border-transparent'}`}
                        >
                            <div className="text-left flex-1">
                                <h3 className="font-bold text-sm">Test Agent</h3>
                                <p className="text-[11px] opacity-70">Sandbox chat</p>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Right Content Area */}
                <div className="flex-1 flex flex-col h-full bg-[#030712] relative">
                    {desktopView === 'prompts' ? renderPromptsView() : renderChatView()}
                </div>
            </div>
        </div>
    );
}
