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