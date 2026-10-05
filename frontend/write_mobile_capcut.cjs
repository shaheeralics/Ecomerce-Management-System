const fs = require('fs');

const editorCode = `import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Check, ChevronLeft, Trash2, Scissors, ZoomIn, ZoomOut, Minimize2, Mic, Move, Settings2, Undo, Redo } from 'lucide-react';

interface AudioTrackClip {
    id: string;
    track: 'main' | 'voiceover';
    start: number;
    end: number;
    sourceStart?: number;
    buffer?: AudioBuffer;
    isDeleted?: boolean;
}

interface MobileVoiceEditorProps {
    audioBlob: Blob | null;
    onSave: (blob: Blob) => void;
    onCancel: () => void;
}

export default function MobileVoiceEditor({ audioBlob, onSave, onCancel }: MobileVoiceEditorProps) {
    const [audioDuration, setAudioDuration] = useState(0);
    const [seekTime, setSeekTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [mainClips, setMainClips] = useState<AudioTrackClip[]>([]);
    const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
    
    const [timelineZoom, setTimelineZoom] = useState(1);
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

    const [history, setHistory] = useState<AudioTrackClip[][]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const timelineTrackRef = useRef<HTMLDivElement | null>(null);
    const reqRef = useRef<number>(0);

    const pushHistory = (clips: AudioTrackClip[]) => {
        const newHist = history.slice(0, historyIndex + 1);
        newHist.push(JSON.parse(JSON.stringify(clips)));
        setHistory(newHist);
        setHistoryIndex(newHist.length - 1);
    };

    const undo = () => {
        if (historyIndex > 0) {
            setMainClips(history[historyIndex - 1]);
            setHistoryIndex(historyIndex - 1);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            setMainClips(history[historyIndex + 1]);
            setHistoryIndex(historyIndex + 1);
        }
    };

    useEffect(() => {
        if (audioBlob) {
            const url = URL.createObjectURL(audioBlob);
            const aud = new Audio(url);
            aud.onloadedmetadata = () => {
                setAudioDuration(aud.duration);
                if (mainClips.length === 0) {
                    const initialClip: AudioTrackClip = { id: 'main-1', track: 'main', start: 0, end: aud.duration, sourceStart: 0 };
                    setMainClips([initialClip]);
                    setHistory([[initialClip]]);
                    setHistoryIndex(0);
                }
            };
            audioElementRef.current = aud;

            generateRealWaveformPeaks(audioBlob);

            return () => {
                aud.pause();
                URL.revokeObjectURL(url);
            };
        }
    }, [audioBlob]);

    const generateRealWaveformPeaks = async (blob: Blob) => {
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const arrayBuf = await blob.arrayBuffer();
            const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
            const channelData = audioBuf.getChannelData(0);

            const samplesCount = 100;
            const blockSize = Math.floor(channelData.length / samplesCount);
            const peaks: number[] = [];

            for (let i = 0; i < samplesCount; i++) {
                const start = i * blockSize;
                let sum = 0;
                for (let j = 0; j < blockSize; j += 100) {
                    sum += Math.abs(channelData[start + j] || 0);
                }
                peaks.push(sum);
            }
            const maxPeak = Math.max(...peaks, 0.001);
            const normalized = peaks.map(p => Math.max(10, (p / maxPeak) * 90));
            setWaveformPeaks(normalized);
        } catch (e) {
            setWaveformPeaks(Array.from({length: 100}).map(() => Math.random() * 80 + 20));
        }
    };

    const updateTime = () => {
        if (audioElementRef.current) {
            setSeekTime(audioElementRef.current.currentTime);
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
    }, [isPlaying]);

    const togglePlayPause = () => {
        if (!audioElementRef.current) return;
        if (isPlaying) {
            audioElementRef.current.pause();
            setIsPlaying(false);
        } else {
            audioElementRef.current.play();
            setIsPlaying(true);
        }
    };

    const handleTimelineTouch = (e: React.TouchEvent | React.MouseEvent) => {
        if (!timelineTrackRef.current) return;
        const rect = timelineTrackRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clickX = clientX - rect.left;
        const newSeek = (clickX / rect.width) * audioDuration;
        setSeekTime(Math.max(0, Math.min(newSeek, audioDuration)));
        if (audioElementRef.current) {
            audioElementRef.current.currentTime = Math.max(0, Math.min(newSeek, audioDuration));
        }
    };

    const splitClip = () => {
        const clipIdx = mainClips.findIndex(c => !c.isDeleted && c.start < seekTime && c.end > seekTime);
        if (clipIdx !== -1) {
            const clip = mainClips[clipIdx];
            const c1: AudioTrackClip = { ...clip, id: Date.now().toString() + '-1', end: seekTime };
            const c2: AudioTrackClip = { ...clip, id: Date.now().toString() + '-2', start: seekTime, sourceStart: (clip.sourceStart || 0) + (seekTime - clip.start) };
            const newClips = [...mainClips];
            newClips.splice(clipIdx, 1, c1, c2);
            setMainClips(newClips);
            pushHistory(newClips);
        }
    };

    const deleteSelected = () => {
        if (selectedClipId) {
            const newClips = mainClips.map(c => c.id === selectedClipId ? { ...c, isDeleted: true } : c);
            setMainClips(newClips);
            setSelectedClipId(null);
            pushHistory(newClips);
        }
    };

    const handleClipMove = (e: React.TouchEvent | React.MouseEvent, clip: AudioTrackClip) => {
        e.stopPropagation();
        setSelectedClipId(clip.id);
        const startX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const initialStart = clip.start;
        const clipDur = clip.end - clip.start;
        let moved = false;

        const moveHandler = (moveEvt: TouchEvent | MouseEvent) => {
            if (!timelineTrackRef.current) return;
            const currentX = 'touches' in moveEvt ? moveEvt.touches[0].clientX : (moveEvt as MouseEvent).clientX;
            const rect = timelineTrackRef.current.getBoundingClientRect();
            const deltaX = currentX - startX;
            const deltaTime = (deltaX / rect.width) * audioDuration;
            
            const newStart = Math.max(0, initialStart + deltaTime);
            const newEnd = newStart + clipDur;
            
            setMainClips(prev => prev.map(c => c.id === clip.id ? { ...c, start: newStart, end: newEnd } : c));
            moved = true;
        };

        const upHandler = () => {
            document.removeEventListener('touchmove', moveHandler);
            document.removeEventListener('touchend', upHandler);
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
            if (moved) {
                setMainClips(prev => {
                    pushHistory(prev);
                    return prev;
                });
            }
        };

        document.addEventListener('touchmove', moveHandler, { passive: false });
        document.addEventListener('touchend', upHandler);
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
    };

    const handleClipTrim = (e: React.TouchEvent | React.MouseEvent, clip: AudioTrackClip, side: 'start'|'end') => {
        e.stopPropagation();
        setSelectedClipId(clip.id);
        const startX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const initialStart = clip.start;
        const initialEnd = clip.end;

        const moveHandler = (moveEvt: TouchEvent | MouseEvent) => {
            if (!timelineTrackRef.current) return;
            const currentX = 'touches' in moveEvt ? moveEvt.touches[0].clientX : (moveEvt as MouseEvent).clientX;
            const rect = timelineTrackRef.current.getBoundingClientRect();
            const deltaX = currentX - startX;
            const deltaTime = (deltaX / rect.width) * audioDuration;

            if (side === 'start') {
                const newStart = Math.min(initialEnd - 0.1, Math.max(0, initialStart + deltaTime));
                setMainClips(prev => prev.map(c => c.id === clip.id ? { ...c, start: newStart, sourceStart: (clip.sourceStart||0) + (newStart - initialStart) } : c));
            } else {
                const newEnd = Math.max(initialStart + 0.1, initialEnd + deltaTime);
                setMainClips(prev => prev.map(c => c.id === clip.id ? { ...c, end: newEnd } : c));
            }
        };

        const upHandler = () => {
            document.removeEventListener('touchmove', moveHandler);
            document.removeEventListener('touchend', upHandler);
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
            setMainClips(prev => {
                pushHistory(prev);
                return prev;
            });
        };

        document.addEventListener('touchmove', moveHandler, { passive: false });
        document.addEventListener('touchend', upHandler);
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
    };

    const formatTimer = (s: number) => {
        const m = Math.floor(s / 60);
        const secs = Math.floor(s % 60);
        return \`\${m}:\${secs.toString().padStart(2, '0')}\`;
    };

    return (
        <div className="flex flex-col h-full w-full absolute inset-0 bg-[#030712] z-[100] animate-in slide-in-from-bottom-2 duration-300 select-none">
            
            {/* Header */}
            <div className="h-14 bg-[#0B1E26] border-b border-teal-900/50 flex items-center justify-between px-4 shrink-0 shadow-sm relative z-50">
                <button onClick={onCancel} className="p-2 -m-2 text-teal-400 active:text-white">
                    <ChevronLeft size={28} />
                </button>
                <div className="flex items-center gap-3">
                    <button onClick={undo} disabled={historyIndex <= 0} className="p-2 text-teal-300 disabled:opacity-30"><Undo size={22} /></button>
                    <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 text-teal-300 disabled:opacity-30"><Redo size={22} /></button>
                </div>
                <button onClick={() => onSave(audioBlob!)} className="p-2 -m-2 text-teal-400 font-bold active:scale-90">
                    <Check size={28} />
                </button>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col p-4 bg-[#050D10]">
                
                {/* Big Time Display */}
                <div className="text-center py-6">
                    <p className="text-5xl font-mono text-teal-100 tracking-tighter">
                        {formatTimer(seekTime)}
                    </p>
                    <p className="text-sm font-medium text-teal-700 mt-2 font-mono">
                        / {formatTimer(audioDuration)}
                    </p>
                </div>

                {/* Toolbar */}
                <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex items-center gap-4">
                        <button onClick={togglePlayPause} className="w-12 h-12 bg-teal-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-teal-900/50 active:scale-95 transition-all">
                            {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                        </button>
                        <button onClick={splitClip} className="w-10 h-10 bg-[#0B1E26] border border-teal-900/50 rounded-full flex items-center justify-center text-teal-400 active:bg-teal-900/50">
                            <Scissors size={18} />
                        </button>
                        <button onClick={deleteSelected} disabled={!selectedClipId} className="w-10 h-10 bg-[#0B1E26] border border-teal-900/50 rounded-full flex items-center justify-center text-red-400 active:bg-red-900/30 disabled:opacity-30">
                            <Trash2 size={18} />
                        </button>
                    </div>
                    <div className="flex items-center gap-2 bg-[#0B1E26] rounded-full p-1 border border-teal-900/50">
                        <button onClick={() => setTimelineZoom(z => Math.max(1, z - 0.5))} className="p-2 text-teal-400"><ZoomOut size={16} /></button>
                        <button onClick={() => setTimelineZoom(z => Math.min(4, z + 0.5))} className="p-2 text-teal-400"><ZoomIn size={16} /></button>
                    </div>
                </div>

                {/* Multi-Track Timeline Canvas */}
                <div className="w-full bg-[#08181F] border border-teal-900/60 rounded-2xl h-40 overflow-x-auto overflow-y-hidden shadow-inner custom-scrollbar relative">
                    <div 
                        ref={timelineTrackRef}
                        onMouseDown={handleTimelineTouch}
                        onTouchStart={handleTimelineTouch}
                        className="relative h-full cursor-pointer p-2"
                        style={{ minWidth: \`\${timelineZoom * 100}%\` }}
                    >
                        {/* Grid lines */}
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f2e3a_1px,transparent_1px)] bg-[size:20px_100%] opacity-20 pointer-events-none" />

                        {/* Playhead */}
                        <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-50 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.8)]" style={{ left: \`\${(seekTime / audioDuration) * 100}%\` }}>
                            <div className="absolute -top-1 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-sm rotate-45" />
                        </div>

                        {/* Track 1: Main */}
                        <div className="absolute top-4 left-2 right-2 h-20 bg-[#051116] rounded-xl border border-teal-900/30 overflow-hidden">
                            {audioDuration > 0 && mainClips.map((clip) => {
                                if (clip.isDeleted) return null;
                                const leftPercent = (clip.start / audioDuration) * 100;
                                const widthPercent = ((clip.end - clip.start) / audioDuration) * 100;
                                const isSelected = selectedClipId === clip.id;

                                const totalPeaks = waveformPeaks.length > 0 ? waveformPeaks.length : 100;
                                const srcStart = clip.sourceStart || clip.start;
                                const srcEnd = srcStart + (clip.end - clip.start);
                                const startIdx = Math.max(0, Math.floor((srcStart / audioDuration) * totalPeaks));
                                const endIdx = Math.min(totalPeaks, Math.max(startIdx + 4, Math.ceil((srcEnd / audioDuration) * totalPeaks)));
                                const clipPeaks = (waveformPeaks.length > 0 ? waveformPeaks : Array.from({length:100}).fill(40) as number[]).slice(startIdx, endIdx);

                                return (
                                    <div 
                                        key={clip.id}
                                        onTouchStart={(e) => handleClipMove(e, clip)}
                                        onMouseDown={(e) => handleClipMove(e, clip)}
                                        className={\`absolute top-1 bottom-1 rounded-lg border-2 flex items-center justify-between px-1 transition-colors cursor-grab active:cursor-grabbing z-10 \${isSelected ? 'bg-teal-500/30 border-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.5)]' : 'bg-teal-950/80 border-teal-800'}\`}
                                        style={{ left: \`\${leftPercent}%\`, width: \`\${widthPercent}%\` }}
                                    >
                                        <div onTouchStart={(e) => handleClipTrim(e, clip, 'start')} onMouseDown={(e) => handleClipTrim(e, clip, 'start')} className="absolute left-0 top-0 bottom-0 w-4 -ml-2 bg-teal-400/80 z-20 rounded-l flex items-center justify-center"><div className="w-0.5 h-4 bg-teal-950" /></div>
                                        
                                        <div className="absolute inset-0 flex items-center justify-between px-2 opacity-50 pointer-events-none">
                                            {clipPeaks.map((h, i) => <div key={i} className="w-1 bg-teal-300 rounded-full" style={{height: \`\${h}%\`}} />)}
                                        </div>

                                        <div onTouchStart={(e) => handleClipTrim(e, clip, 'end')} onMouseDown={(e) => handleClipTrim(e, clip, 'end')} className="absolute right-0 top-0 bottom-0 w-4 -mr-2 bg-teal-400/80 z-20 rounded-r flex items-center justify-center"><div className="w-0.5 h-4 bg-teal-950" /></div>
                                    </div>
                                )
                            })}
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}`;

fs.writeFileSync('src/components/MobileVoiceEditor.tsx', editorCode);
console.log('Written pure mobile CapCut-style timeline');
