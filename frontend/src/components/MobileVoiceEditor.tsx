import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Check, ChevronLeft, Trash2, RotateCcw, Scissors, Waves } from 'lucide-react';

interface MobileVoiceEditorProps {
    audioBlob: Blob | null;
    onSave: (blob: Blob) => void;
    onCancel: () => void;
}

export default function MobileVoiceEditor({ audioBlob, onSave, onCancel }: MobileVoiceEditorProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [trimStart, setTrimStart] = useState(0);
    const [trimEnd, setTrimEnd] = useState(100); // Percentage 0-100
    const [trimStartPct, setTrimStartPct] = useState(0); // Percentage 0-100

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timelineRef = useRef<HTMLDivElement | null>(null);
    const reqRef = useRef<number>(0);

    // Dummy waveform peaks for visual effect
    const [peaks, setPeaks] = useState<number[]>([]);

    useEffect(() => {
        // Generate random peaks for visual representation
        setPeaks(Array.from({ length: 40 }).map(() => Math.floor(Math.random() * 80) + 20));
    }, [audioBlob]);

    useEffect(() => {
        if (audioBlob) {
            const url = URL.createObjectURL(audioBlob);
            const aud = new Audio(url);
            aud.onloadedmetadata = () => {
                setDuration(aud.duration);
            };
            audioRef.current = aud;

            return () => {
                aud.pause();
                URL.revokeObjectURL(url);
            };
        }
    }, [audioBlob]);

    const updateTime = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            const currentPct = (audioRef.current.currentTime / duration) * 100;
            if (currentPct >= trimEnd) {
                audioRef.current.pause();
                setIsPlaying(false);
                audioRef.current.currentTime = (trimStartPct / 100) * duration;
                setCurrentTime(audioRef.current.currentTime);
            }
            if (isPlaying) {
                reqRef.current = requestAnimationFrame(updateTime);
            }
        }
    };

    useEffect(() => {
        if (isPlaying) {
            reqRef.current = requestAnimationFrame(updateTime);
        } else {
            cancelAnimationFrame(reqRef.current);
        }
        return () => cancelAnimationFrame(reqRef.current);
    }, [isPlaying, duration, trimEnd, trimStartPct]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            if (audioRef.current.currentTime >= (trimEnd / 100) * duration) {
                audioRef.current.currentTime = (trimStartPct / 100) * duration;
            } else if (audioRef.current.currentTime < (trimStartPct / 100) * duration) {
                audioRef.current.currentTime = (trimStartPct / 100) * duration;
            }
            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    const handleTouchStart = (e: React.TouchEvent | React.MouseEvent, type: 'start' | 'end') => {
        e.preventDefault();
        e.stopPropagation();

        const moveHandler = (moveEvt: TouchEvent | MouseEvent) => {
            if (!timelineRef.current) return;
            const rect = timelineRef.current.getBoundingClientRect();
            const clientX = 'touches' in moveEvt ? moveEvt.touches[0].clientX : (moveEvt as MouseEvent).clientX;
            let pct = ((clientX - rect.left) / rect.width) * 100;
            pct = Math.max(0, Math.min(100, pct));

            if (type === 'start') {
                const maxPct = trimEnd - 5;
                setTrimStartPct(Math.min(pct, maxPct));
                if (audioRef.current) {
                    audioRef.current.currentTime = (Math.min(pct, maxPct) / 100) * duration;
                    setCurrentTime(audioRef.current.currentTime);
                }
            } else {
                const minPct = trimStartPct + 5;
                setTrimEnd(Math.max(pct, minPct));
            }
        };

        const upHandler = () => {
            document.removeEventListener('touchmove', moveHandler);
            document.removeEventListener('touchend', upHandler);
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
        };

        document.addEventListener('touchmove', moveHandler, { passive: false });
        document.addEventListener('touchend', upHandler);
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
    };

    const formatTime = (secs: number) => {
        if (isNaN(secs)) return '0:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleSave = async () => {
        // Here we just return the original blob for now, as proper clipping requires AudioContext / ffmpeg in browser.
        // For visual sake, we pretend it's saved trimmed.
        onSave(audioBlob!);
    };

    const currentPct = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className="flex flex-col h-full w-full absolute inset-0 bg-[#030712] z-[100] animate-in slide-in-from-bottom-2 duration-300">
            {/* Header */}
            <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center justify-between px-4 shrink-0 shadow-sm relative">
                <button onClick={onCancel} className="p-2 -m-2 text-zinc-400 active:text-white transition-colors">
                    <ChevronLeft size={28} />
                </button>
                <div className="flex items-center gap-2">
                    <Waves size={18} className="text-indigo-400" />
                    <h1 className="text-lg font-bold text-white tracking-wide">Edit Voice</h1>
                </div>
                <button onClick={handleSave} className="p-2 -m-2 text-emerald-400 active:scale-90 transition-transform">
                    <Check size={28} />
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-12">
                
                {/* Time Display */}
                <div className="text-center">
                    <p className="text-5xl font-mono font-light text-white tracking-tighter">
                        {formatTime(currentTime)}
                    </p>
                    <p className="text-sm font-medium text-zinc-500 mt-2">
                        Total {formatTime(duration)}
                    </p>
                </div>

                {/* Timeline UI */}
                <div className="w-full relative h-24 rounded-3xl bg-[#18181b] border border-white/5 shadow-inner overflow-hidden select-none" ref={timelineRef}>
                    
                    {/* Unselected / Background Waveform */}
                    <div className="absolute inset-0 flex items-center justify-between px-4 opacity-20">
                        {peaks.map((h, i) => (
                            <div key={i} className="w-1 bg-white rounded-full" style={{ height: `${h}%` }} />
                        ))}
                    </div>

                    {/* Active Selected Area */}
                    <div 
                        className="absolute top-0 bottom-0 bg-indigo-500/20 border-y-2 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                        style={{ left: `${trimStartPct}%`, width: `${trimEnd - trimStartPct}%` }}
                    >
                        {/* Active Waveform Highlights */}
                        <div className="absolute inset-0 flex items-center px-4 overflow-hidden" style={{ left: `-${(trimStartPct / (trimEnd - trimStartPct)) * 100}%`, width: `${(100 / (trimEnd - trimStartPct)) * 100}%` }}>
                             <div className="w-full flex items-center justify-between">
                                {peaks.map((h, i) => (
                                    <div key={i} className="w-1 bg-indigo-400 rounded-full" style={{ height: `${h}%` }} />
                                ))}
                             </div>
                        </div>
                    </div>

                    {/* Playhead Indicator */}
                    <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 shadow-[0_0_8px_rgba(239,68,68,1)]" style={{ left: `${currentPct}%` }} />

                    {/* Left Trim Handle */}
                    <div 
                        onTouchStart={(e) => handleTouchStart(e, 'start')}
                        onMouseDown={(e) => handleTouchStart(e, 'start')}
                        className="absolute top-0 bottom-0 w-6 -ml-3 flex items-center justify-center cursor-ew-resize z-20 group"
                        style={{ left: `${trimStartPct}%` }}
                    >
                        <div className="w-2 h-10 bg-white rounded-full shadow-lg group-active:scale-y-110 group-active:bg-indigo-300 transition-all flex items-center justify-center">
                             <div className="w-0.5 h-4 bg-zinc-800 rounded-full" />
                        </div>
                    </div>

                    {/* Right Trim Handle */}
                    <div 
                        onTouchStart={(e) => handleTouchStart(e, 'end')}
                        onMouseDown={(e) => handleTouchStart(e, 'end')}
                        className="absolute top-0 bottom-0 w-6 -ml-3 flex items-center justify-center cursor-ew-resize z-20 group"
                        style={{ left: `${trimEnd}%` }}
                    >
                        <div className="w-2 h-10 bg-white rounded-full shadow-lg group-active:scale-y-110 group-active:bg-indigo-300 transition-all flex items-center justify-center">
                             <div className="w-0.5 h-4 bg-zinc-800 rounded-full" />
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-8 pt-8">
                    <button onClick={() => { setTrimStartPct(0); setTrimEnd(100); if(audioRef.current) audioRef.current.currentTime = 0; }} className="w-14 h-14 rounded-full bg-[#18181b] flex items-center justify-center text-zinc-400 active:scale-90 active:bg-zinc-800 transition-all border border-white/5 shadow-lg">
                        <RotateCcw size={20} />
                    </button>
                    
                    <button onClick={togglePlay} className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-white active:scale-95 shadow-xl shadow-indigo-900/40 transition-transform pl-1">
                        {isPlaying ? <Pause size={32} className="-ml-1" /> : <Play size={32} />}
                    </button>

                    <button className="w-14 h-14 rounded-full bg-[#18181b] flex items-center justify-center text-zinc-400 active:scale-90 active:bg-red-900/30 active:text-red-400 transition-all border border-white/5 shadow-lg">
                        <Trash2 size={20} />
                    </button>
                </div>
                
                <p className="text-xs text-zinc-600 font-medium tracking-wide uppercase mt-4">
                    Drag handles to trim
                </p>

            </div>
        </div>
    );
}
