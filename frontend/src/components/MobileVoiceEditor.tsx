import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Check, ChevronLeft, Trash2, RotateCcw, Scissors, Waves, Undo, Redo, Music, Volume2, Mic, Settings2 } from 'lucide-react';

interface MobileVoiceEditorProps {
    audioBlob: Blob | null;
    onSave: (blob: Blob) => void;
    onCancel: () => void;
}

export default function MobileVoiceEditor({ audioBlob, onSave, onCancel }: MobileVoiceEditorProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [trimStartPct, setTrimStartPct] = useState(0);
    const [trimEndPct, setTrimEndPct] = useState(100);

    const [showVolume, setShowVolume] = useState(false);
    const [mainVolume, setMainVolume] = useState(1);
    const [bgmVolume, setBgmVolume] = useState(0.5);

    const [bgmBlob, setBgmBlob] = useState<Blob | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const bgmRef = useRef<HTMLAudioElement | null>(null);
    const timelineRef = useRef<HTMLDivElement | null>(null);
    const reqRef = useRef<number>(0);

    const [peaks, setPeaks] = useState<number[]>([]);
    
    // History for Undo/Redo
    const [history, setHistory] = useState<{start: number, end: number}[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    useEffect(() => {
        setPeaks(Array.from({ length: 40 }).map(() => Math.floor(Math.random() * 80) + 20));
        setHistory([{start: 0, end: 100}]);
        setHistoryIndex(0);
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

    useEffect(() => {
        if (bgmBlob) {
            const url = URL.createObjectURL(bgmBlob);
            const aud = new Audio(url);
            aud.loop = true;
            bgmRef.current = aud;
            return () => {
                aud.pause();
                URL.revokeObjectURL(url);
            };
        } else {
            bgmRef.current = null;
        }
    }, [bgmBlob]);

    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = mainVolume;
        if (bgmRef.current) bgmRef.current.volume = bgmVolume;
    }, [mainVolume, bgmVolume]);

    const updateTime = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            const currentPct = (audioRef.current.currentTime / duration) * 100;
            if (currentPct >= trimEndPct) {
                audioRef.current.pause();
                if (bgmRef.current) bgmRef.current.pause();
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
    }, [isPlaying, duration, trimEndPct, trimStartPct]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            if (bgmRef.current) bgmRef.current.pause();
            setIsPlaying(false);
        } else {
            if (audioRef.current.currentTime >= (trimEndPct / 100) * duration) {
                audioRef.current.currentTime = (trimStartPct / 100) * duration;
            } else if (audioRef.current.currentTime < (trimStartPct / 100) * duration) {
                audioRef.current.currentTime = (trimStartPct / 100) * duration;
            }
            audioRef.current.play();
            if (bgmRef.current) bgmRef.current.play();
            setIsPlaying(true);
        }
    };

    const pushHistory = (s: number, e: number) => {
        const newHist = history.slice(0, historyIndex + 1);
        newHist.push({start: s, end: e});
        setHistory(newHist);
        setHistoryIndex(newHist.length - 1);
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            const p = history[historyIndex - 1];
            setTrimStartPct(p.start);
            setTrimEndPct(p.end);
            setHistoryIndex(historyIndex - 1);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const p = history[historyIndex + 1];
            setTrimStartPct(p.start);
            setTrimEndPct(p.end);
            setHistoryIndex(historyIndex + 1);
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
                const maxPct = trimEndPct - 5;
                const newStart = Math.min(pct, maxPct);
                setTrimStartPct(newStart);
                if (audioRef.current) {
                    audioRef.current.currentTime = (newStart / 100) * duration;
                    setCurrentTime(audioRef.current.currentTime);
                }
            } else {
                const minPct = trimStartPct + 5;
                setTrimEndPct(Math.max(pct, minPct));
            }
        };

        const upHandler = () => {
            document.removeEventListener('touchmove', moveHandler);
            document.removeEventListener('touchend', upHandler);
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
            // Save state on release for undo/redo
            pushHistory(trimStartPct, trimEndPct);
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

    const handleBgmUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setBgmBlob(e.target.files[0]);
        }
    };

    const currentPct = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className="flex flex-col h-full w-full absolute inset-0 bg-[#030712] z-[100] animate-in slide-in-from-bottom-2 duration-300">
            {/* Header */}
            <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center justify-between px-4 shrink-0 shadow-sm relative">
                <button onClick={onCancel} className="p-2 -m-2 text-zinc-400 active:text-white transition-colors">
                    <ChevronLeft size={28} />
                </button>
                <div className="flex items-center gap-4">
                    <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-2 text-zinc-400 active:text-white disabled:opacity-30">
                        <Undo size={22} />
                    </button>
                    <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-2 text-zinc-400 active:text-white disabled:opacity-30">
                        <Redo size={22} />
                    </button>
                </div>
                <button onClick={() => onSave(audioBlob!)} className="p-2 -m-2 text-emerald-400 active:scale-90 transition-transform">
                    <Check size={28} />
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center p-6 justify-center">
                
                {/* Time Display */}
                <div className="text-center mb-12">
                    <p className="text-5xl font-mono font-light text-white tracking-tighter">
                        {formatTime(currentTime)}
                    </p>
                    <p className="text-sm font-medium text-zinc-500 mt-2">
                        {formatTime(duration)}
                    </p>
                </div>

                {/* Timeline UI */}
                <div className="w-full relative h-24 rounded-2xl bg-[#18181b] border border-white/5 shadow-inner overflow-hidden select-none mb-12" ref={timelineRef}>
                    <div className="absolute inset-0 flex items-center justify-between px-4 opacity-20">
                        {peaks.map((h, i) => (
                            <div key={i} className="w-1 bg-white rounded-full" style={{ height: `${h}%` }} />
                        ))}
                    </div>
                    
                    <div 
                        className="absolute top-0 bottom-0 bg-indigo-500/20 border-y-2 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                        style={{ left: `${trimStartPct}%`, width: `${trimEndPct - trimStartPct}%` }}
                    >
                        <div className="absolute inset-0 flex items-center px-4 overflow-hidden" style={{ left: `-${(trimStartPct / (trimEndPct - trimStartPct)) * 100}%`, width: `${(100 / (trimEndPct - trimStartPct)) * 100}%` }}>
                             <div className="w-full flex items-center justify-between">
                                {peaks.map((h, i) => (
                                    <div key={i} className="w-1 bg-indigo-400 rounded-full" style={{ height: `${h}%` }} />
                                ))}
                             </div>
                        </div>
                    </div>

                    <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 shadow-[0_0_8px_rgba(239,68,68,1)]" style={{ left: `${currentPct}%` }} />

                    {/* Trim Handles */}
                    <div 
                        onTouchStart={(e) => handleTouchStart(e, 'start')}
                        onMouseDown={(e) => handleTouchStart(e, 'start')}
                        className="absolute top-0 bottom-0 w-8 -ml-4 flex items-center justify-center cursor-ew-resize z-20 active:scale-110 transition-transform"
                        style={{ left: `${trimStartPct}%` }}
                    >
                        <div className="w-3 h-12 bg-white rounded-full shadow-lg flex items-center justify-center border border-zinc-200">
                             <div className="w-0.5 h-5 bg-zinc-800 rounded-full" />
                        </div>
                    </div>

                    <div 
                        onTouchStart={(e) => handleTouchStart(e, 'end')}
                        onMouseDown={(e) => handleTouchStart(e, 'end')}
                        className="absolute top-0 bottom-0 w-8 -ml-4 flex items-center justify-center cursor-ew-resize z-20 active:scale-110 transition-transform"
                        style={{ left: `${trimEndPct}%` }}
                    >
                        <div className="w-3 h-12 bg-white rounded-full shadow-lg flex items-center justify-center border border-zinc-200">
                             <div className="w-0.5 h-5 bg-zinc-800 rounded-full" />
                        </div>
                    </div>
                </div>

                {/* Secondary Actions (BGM & Volume) */}
                <div className="flex items-center justify-between w-full px-4 mb-8">
                    <div className="relative">
                        <button onClick={() => setShowVolume(!showVolume)} className="w-12 h-12 rounded-full bg-[#18181b] border border-white/5 flex items-center justify-center text-zinc-400 active:bg-zinc-800">
                            <Settings2 size={22} />
                        </button>
                        {showVolume && (
                            <div className="absolute bottom-full left-0 mb-4 bg-[#18181b] border border-white/10 rounded-2xl p-4 w-48 shadow-xl flex flex-col gap-4">
                                <div className="flex items-center gap-3">
                                    <Mic size={16} className="text-indigo-400" />
                                    <input type="range" min="0" max="1" step="0.05" value={mainVolume} onChange={e=>setMainVolume(parseFloat(e.target.value))} className="flex-1 accent-indigo-500" />
                                </div>
                                <div className="flex items-center gap-3">
                                    <Music size={16} className="text-emerald-400" />
                                    <input type="range" min="0" max="1" step="0.05" value={bgmVolume} onChange={e=>setBgmVolume(parseFloat(e.target.value))} className="flex-1 accent-emerald-500" />
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div>
                        <input type="file" id="bgm-upload" accept="audio/*" className="hidden" onChange={handleBgmUpload} />
                        <label htmlFor="bgm-upload" className={`w-12 h-12 rounded-full border flex items-center justify-center cursor-pointer transition-colors ${bgmBlob ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-[#18181b] border-white/5 text-zinc-400 active:bg-zinc-800'}`}>
                            <Music size={22} />
                        </label>
                    </div>

                    <button onClick={() => { setTrimStartPct(0); setTrimEndPct(100); pushHistory(0, 100); if(audioRef.current) audioRef.current.currentTime = 0; }} className="w-12 h-12 rounded-full bg-[#18181b] border border-white/5 flex items-center justify-center text-zinc-400 active:bg-zinc-800">
                        <RotateCcw size={22} />
                    </button>
                </div>

                {/* Primary Play Action */}
                <div className="flex items-center justify-center w-full">
                    <button onClick={togglePlay} className="w-24 h-24 rounded-full bg-indigo-600 flex items-center justify-center text-white active:scale-95 shadow-[0_0_30px_rgba(79,70,229,0.3)] transition-transform">
                        {isPlaying ? <Pause size={38} className="-ml-1" /> : <Play size={38} className="ml-1" />}
                    </button>
                </div>

            </div>
        </div>
    );
}
