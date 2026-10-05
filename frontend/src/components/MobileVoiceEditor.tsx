import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Mic, Edit3, Scissors, ZoomIn, ZoomOut, Minimize2, ChevronLeft, Check, Move, Trash2 } from 'lucide-react';

interface AudioTrackClip {
    id: string;
    track: 'main' | 'voiceover';
    name?: string;
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
    const [mainClips, setMainClips] = useState<AudioTrackClip[]>([]);
    const [voiceoverClips, setVoiceoverClips] = useState<AudioTrackClip[]>([]);
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const [selectedTrack, setSelectedTrack] = useState<'main' | 'voiceover'>('main');
    const [trimStart, setTrimStart] = useState(0);
    const [trimEnd, setTrimEnd] = useState(0);
    const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [timelineZoom, setTimelineZoom] = useState(1);
    const [isTimelineRecording, setIsTimelineRecording] = useState(false);
    const [audioDuration, setAudioDuration] = useState(0);
    const [seekTime, setSeekTime] = useState(0);
    const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);

    const timelineScrollRef = useRef<HTMLDivElement | null>(null);
    const timelineTrackRef = useRef<HTMLDivElement | null>(null);
    const originalMainBlobRef = useRef<Blob | null>(null);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const overwriteSeekRef = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    const [visualizerData, setVisualizerData] = useState<number[]>(new Array(35).fill(30));
    const animationFrameRef = useRef<number | null>(null);
    
    // Add missing state for recording
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const timerIntervalRef = useRef<number | null>(null);

    // Initialize from props
    useEffect(() => {
        if (audioBlob) {
            originalMainBlobRef.current = audioBlob;
            const url = URL.createObjectURL(audioBlob);
            setAudioPreviewUrl(url);
            generateRealWaveformPeaks(audioBlob, url);
            const aud = new Audio(url);
            aud.onloadedmetadata = () => {
                setAudioDuration(aud.duration);
                setTrimEnd(aud.duration);
                setMainClips([{ id: `main-${Date.now()}`, track: 'main', start: 0, end: aud.duration, sourceStart: 0 }]);
            };
        }
    }, [audioBlob]);

    const formatTimer = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const generateRealWaveformPeaks = async (blob: Blob | null, url: string | null) => {
        let sourceBlob = blob;
        if (!sourceBlob && url) {
            try {
                const res = await fetch(url);
                sourceBlob = await res.blob();
            } catch (e) { }
        }
        if (!sourceBlob) return;

        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const arrayBuf = await sourceBlob.arrayBuffer();
            const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
            const channelData = audioBuf.getChannelData(0);

            const samplesCount = 72;
            const blockSize = Math.floor(channelData.length / samplesCount);
            const peaks: number[] = [];

            for (let i = 0; i < samplesCount; i++) {
                const start = i * blockSize;
                let sum = 0;
                const stride = Math.max(1, Math.floor(blockSize / 20));
                let count = 0;
                for (let j = 0; j < blockSize; j += stride) {
                    sum += Math.abs(channelData[start + j] || 0);
                    count++;
                }
                const avg = count > 0 ? sum / count : 0;
                peaks.push(avg);
            }

            const maxPeak = Math.max(...peaks, 0.001);
            const normalized = peaks.map(p => Math.max(15, Math.min(95, (p / maxPeak) * 85 + 10)));
            setWaveformPeaks(normalized);
        } catch (err) {}
    };

    const calculateMaxClipEnd = (mClips: AudioTrackClip[], voClips: AudioTrackClip[]) => {
        let max = 0;
        mClips.forEach(c => { if (!c.isDeleted && c.end > max) max = c.end; });
        voClips.forEach(c => { if (!c.isDeleted && c.end > max) max = c.end; });
        return max;
    };

    const autoMixPreview = async (mClips: AudioTrackClip[], voClips: AudioTrackClip[], currentMaxDur: number) => {
        let mainSourceBlob = originalMainBlobRef.current;
        const activeMain = mClips.filter(c => !c.isDeleted);
        const activeVO = voClips.filter(c => !c.isDeleted);

        if (!mainSourceBlob && activeVO.length === 0) return;

        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            let sampleRate = 44100;
            let channels = 1;
            let mainAudioBuf: AudioBuffer | null = null;

            if (mainSourceBlob) {
                const mainArr = await mainSourceBlob.arrayBuffer();
                mainAudioBuf = await audioCtx.decodeAudioData(mainArr);
                sampleRate = mainAudioBuf.sampleRate;
                channels = mainAudioBuf.numberOfChannels;
            }

            let maxDur = calculateMaxClipEnd(mClips, voClips);
            if (maxDur <= 0) maxDur = mainAudioBuf ? mainAudioBuf.duration : currentMaxDur;
            if (maxDur > 0) setAudioDuration(maxDur);

            const totalSamples = Math.floor(maxDur * sampleRate);
            if (totalSamples <= 0) return;

            const outputBuf = audioCtx.createBuffer(channels, totalSamples, sampleRate);

            if (mainAudioBuf) {
                for (let c = 0; c < channels; c++) {
                    const outData = outputBuf.getChannelData(c);
                    const srcData = mainAudioBuf.getChannelData(c);

                    for (const clip of activeMain) {
                        if (clip.start >= clip.end) continue;
                        const sourceStartSec = clip.sourceStart !== undefined ? clip.sourceStart : clip.start;
                        const clipDurationSec = clip.end - clip.start;
                        const clipSamplesCount = Math.round(clipDurationSec * sampleRate);
                        
                        const targetStartIdx = Math.round(clip.start * sampleRate);
                        const srcStartSamp = Math.round(sourceStartSec * sampleRate);

                        for (let i = 0; i < clipSamplesCount; i++) {
                            const targetIdx = targetStartIdx + i;
                            const srcIdx = srcStartSamp + i;

                            if (targetIdx < totalSamples && srcIdx < srcData.length) {
                                const targetSec = targetIdx / sampleRate;
                                const isMuted = activeVO.some(vo => targetSec >= vo.start && targetSec < vo.end);
                                if (!isMuted) outData[targetIdx] += srcData[srcIdx];
                            }
                        }
                    }
                }
            }

            for (const vo of activeVO) {
                if (!vo.buffer) continue;
                for (let c = 0; c < Math.min(channels, vo.buffer.numberOfChannels); c++) {
                    const outData = outputBuf.getChannelData(c);
                    const srcData = vo.buffer.getChannelData(c);

                    const clipSamplesCount = Math.round((vo.end - vo.start) * sampleRate);
                    const targetStartIdx = Math.round(vo.start * sampleRate);

                    for (let i = 0; i < clipSamplesCount; i++) {
                        const targetIdx = targetStartIdx + i;
                        if (targetIdx < totalSamples && i < srcData.length) {
                            outData[targetIdx] += srcData[i];
                        }
                    }
                }
            }

            const offlineCtx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(channels, totalSamples, sampleRate);
            const source = offlineCtx.createBufferSource();
            source.buffer = outputBuf;
            source.connect(offlineCtx.destination);
            source.start(0);

            const renderedBuf = await offlineCtx.startRendering();
            const wavBlob = await audioBufferToWavBlob(renderedBuf);

            if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
            const newUrl = URL.createObjectURL(wavBlob);
            setAudioPreviewUrl(newUrl);

        } catch (e) {
            console.error(e);
        }
    };

    const audioBufferToWavBlob = async (buffer: AudioBuffer) => {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1;
        const bitDepth = 16;
        const blockAlign = numChannels * (bitDepth / 8);
        const byteRate = sampleRate * blockAlign;
        const dataSize = buffer.length * blockAlign;
        const bufferSize = 44 + dataSize;
        const arrayBuffer = new ArrayBuffer(bufferSize);
        const view = new DataView(arrayBuffer);

        const writeString = (view: DataView, offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
        };

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);

        const channelData = [];
        for (let i = 0; i < numChannels; i++) channelData.push(buffer.getChannelData(i));

        let offset = 44;
        for (let i = 0; i < buffer.length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                let sample = Math.max(-1, Math.min(1, channelData[channel][i]));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, sample, true);
                offset += 2;
            }
        }

        return new Blob([view], { type: 'audio/wav' });
    };

    const togglePlayPause = () => {
        if (!audioElementRef.current) return;
        if (audioElementRef.current.paused) {
            audioElementRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        } else {
            audioElementRef.current.pause();
            setIsPlaying(false);
        }
    };

    const splitClipAtPlayhead = () => {
        const time = seekTime;
        if (selectedTrack === 'main') {
            const clipIdx = mainClips.findIndex(c => !c.isDeleted && c.start < time && c.end > time);
            if (clipIdx !== -1) {
                const clip = mainClips[clipIdx];
                const c1 = { ...clip, id: `${clip.id}-cut1`, end: time };
                const c2 = { ...clip, id: `${clip.id}-cut2`, start: time, sourceStart: (clip.sourceStart !== undefined ? clip.sourceStart : clip.start) + (time - clip.start) };
                const updated = [...mainClips];
                updated.splice(clipIdx, 1, c1 as AudioTrackClip, c2 as AudioTrackClip);
                setMainClips(updated);
                autoMixPreview(updated, voiceoverClips, audioDuration);
            }
        } else {
            const clipIdx = voiceoverClips.findIndex(c => !c.isDeleted && c.start < time && c.end > time);
            if (clipIdx !== -1) {
                const clip = voiceoverClips[clipIdx];
                const c1 = { ...clip, id: `${clip.id}-cut1`, end: time };
                const c2 = { ...clip, id: `${clip.id}-cut2`, start: time, sourceStart: (clip.sourceStart !== undefined ? clip.sourceStart : clip.start) + (time - clip.start) };
                const updated = [...voiceoverClips];
                updated.splice(clipIdx, 1, c1 as AudioTrackClip, c2 as AudioTrackClip);
                setVoiceoverClips(updated);
                autoMixPreview(mainClips, updated, audioDuration);
            }
        }
    };

    const deleteSelectedClip = () => {
        if (!selectedClipId) return;
        if (selectedTrack === 'main') {
            const updated = mainClips.map(c => c.id === selectedClipId ? { ...c, isDeleted: true } : c);
            setMainClips(updated);
            autoMixPreview(updated, voiceoverClips, audioDuration);
        } else {
            const updated = voiceoverClips.map(c => c.id === selectedClipId ? { ...c, isDeleted: true } : c);
            setVoiceoverClips(updated);
            autoMixPreview(mainClips, updated, audioDuration);
        }
        setSelectedClipId(null);
    };

    const startRecording = async (overwriteSeek?: number) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            const analyser = audioContextRef.current.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
            
            if (overwriteSeek !== undefined) overwriteSeekRef.current = overwriteSeek;
            
            if (audioElementRef.current) {
                audioElementRef.current.pause();
                setIsPlaying(false);
            }

            const dataArr = new Uint8Array(analyser.frequencyBinCount);
            const updateVisualizer = () => {
                if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
                analyser.getByteFrequencyData(dataArr);
                let sum = 0;
                for (let i = 0; i < dataArr.length; i++) sum += dataArr[i];
                const volume = sum / dataArr.length / 255;
                const newData = [];
                for (let i = 0; i < 35; i++) {
                    const baseShape = Math.sin(i * 0.45) * 20 + Math.cos(i * 1.1) * 12 + 45;
                    const jitter = (Math.random() - 0.5) * volume * 40;
                    const h = baseShape + (volume * 35) + jitter;
                    newData.push(Math.max(15, Math.min(95, h)));
                }
                setVisualizerData(newData);
                animationFrameRef.current = requestAnimationFrame(updateVisualizer);
            };
            updateVisualizer();

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                const mimeType = mediaRecorderRef.current ? mediaRecorderRef.current.mimeType : 'audio/webm';
                const recordedNewBlob = new Blob(audioChunksRef.current, { type: mimeType });
                const cutTime = overwriteSeekRef.current;

                try {
                    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const newArrayBuf = await recordedNewBlob.arrayBuffer();
                    const newAudioBuf = await audioCtx.decodeAudioData(newArrayBuf);
                    const recordedDur = newAudioBuf.duration;

                    if (cutTime !== null && cutTime !== undefined) {
                        const voStart = cutTime;
                        const voEnd = voStart + recordedDur;
                        const newVoClip: AudioTrackClip = {
                            id: `vo-${Date.now()}`, track: 'voiceover', start: voStart, end: voEnd, sourceStart: 0, buffer: newAudioBuf
                        };
                        const updatedVOs = [...voiceoverClips, newVoClip];
                        setVoiceoverClips(updatedVOs);
                        setSelectedClipId(newVoClip.id);
                        setSelectedTrack('voiceover');
                        const newMaxDur = Math.max(audioDuration, voEnd);
                        setAudioDuration(newMaxDur);
                        await autoMixPreview(mainClips, updatedVOs, newMaxDur);
                    }
                } catch (err) {}
                overwriteSeekRef.current = null;
                stream.getTracks().forEach(track => track.stop());
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setIsPaused(false);
            setRecordingTime(0);
            timerIntervalRef.current = window.setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {}
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        setIsTimelineRecording(false);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };

    const startTimelineRecording = () => {
        if (isTimelineRecording) {
            stopRecording();
            return;
        }
        setIsTimelineRecording(true);
        startRecording(seekTime);
    };

    const handleTimelineTouch = (e: React.TouchEvent | React.MouseEvent) => {
        if (!timelineTrackRef.current || audioDuration <= 0) return;
        const updatePlayhead = (clientX: number) => {
            if (!timelineTrackRef.current || audioDuration <= 0) return;
            const rect = timelineTrackRef.current.getBoundingClientRect();
            const offsetX = Math.max(0, Math.min(clientX - rect.left, rect.width));
            const newTime = (offsetX / rect.width) * audioDuration;
            if (audioElementRef.current) audioElementRef.current.currentTime = newTime;
            setSeekTime(newTime);
        };
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        updatePlayhead(clientX);

        const onMove = (moveEvent: TouchEvent | MouseEvent) => {
            const moveX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : (moveEvent as MouseEvent).clientX;
            updatePlayhead(moveX);
        };
        const onUp = () => {
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    const handleClipMove = (e: React.TouchEvent | React.MouseEvent, clip: AudioTrackClip) => {
        e.stopPropagation();
        setSelectedClipId(clip.id);
        setSelectedTrack(clip.track);
        
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
            
            if (clip.track === 'main') {
                setMainClips(prev => prev.map(c => c.id === clip.id ? { ...c, start: newStart, end: newEnd } : c));
            } else {
                setVoiceoverClips(prev => prev.map(c => c.id === clip.id ? { ...c, start: newStart, end: newEnd } : c));
            }
            if (newEnd > audioDuration) setAudioDuration(newEnd);
            moved = true;
        };

        const upHandler = () => {
            document.removeEventListener('touchmove', moveHandler);
            document.removeEventListener('touchend', upHandler);
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
            if (moved) {
                setMainClips(latestMain => {
                    setVoiceoverClips(latestVO => {
                        autoMixPreview(latestMain, latestVO, audioDuration);
                        return latestVO;
                    });
                    return latestMain;
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
        setSelectedTrack(clip.track);
        
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
                if (clip.track === 'main') setMainClips(prev => prev.map(c => c.id === clip.id ? { ...c, start: newStart, sourceStart: (clip.sourceStart||0) + (newStart - initialStart) } : c));
                else setVoiceoverClips(prev => prev.map(c => c.id === clip.id ? { ...c, start: newStart, sourceStart: (clip.sourceStart||0) + (newStart - initialStart) } : c));
            } else {
                const newEnd = Math.max(initialStart + 0.1, initialEnd + deltaTime);
                if (clip.track === 'main') setMainClips(prev => prev.map(c => c.id === clip.id ? { ...c, end: newEnd } : c));
                else setVoiceoverClips(prev => prev.map(c => c.id === clip.id ? { ...c, end: newEnd } : c));
            }
        };

        const upHandler = () => {
            document.removeEventListener('touchmove', moveHandler);
            document.removeEventListener('touchend', upHandler);
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
            setMainClips(latestMain => {
                setVoiceoverClips(latestVO => {
                    autoMixPreview(latestMain, latestVO, audioDuration);
                    return latestVO;
                });
                return latestMain;
            });
        };

        document.addEventListener('touchmove', moveHandler, { passive: false });
        document.addEventListener('touchend', upHandler);
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
    };

    const handleSave = async () => {
        if (audioPreviewUrl) {
            try {
                const res = await fetch(audioPreviewUrl);
                const blob = await res.blob();
                onSave(blob);
            } catch (e) {
                onSave(audioBlob!);
            }
        } else {
            onSave(audioBlob!);
        }
    };

    return (
        <div className="flex flex-col h-full w-full absolute inset-0 bg-[#050D10] z-[100] animate-in slide-in-from-bottom-2 duration-300">
            {/* Header */}
            <div className="h-14 bg-[#0B1E26] border-b border-teal-900/50 flex items-center justify-between px-4 shrink-0 shadow-sm relative z-50">
                <button onClick={onCancel} className="p-2 -m-2 text-teal-400 active:text-white">
                    <ChevronLeft size={28} />
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
                        <Edit3 size={16} />
                    </div>
                </div>
                <button onClick={handleSave} className="p-2 -m-2 text-teal-400 font-bold active:scale-90">
                    <Check size={28} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col space-y-6">
                
                {/* Red Pill Player / Record Visualizer */}
                <div className="bg-[#0B1E26] border border-teal-900/40 rounded-2xl p-4 md:p-6 text-center shadow-lg">
                    {isRecording && !isTimelineRecording ? (
                        <div className="flex items-center w-full max-w-[320px] mx-auto relative h-[60px]">
                            <button
                                type="button"
                                onClick={() => {}}
                                className="absolute left-0 z-10 w-[60px] h-[60px] bg-[#FF3B30] hover:bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/40"
                            >
                                <Pause className="text-white fill-current" size={24} />
                            </button>
                            <div className="ml-7 bg-[#FF3B30] h-[48px] w-full rounded-r-full flex items-center pl-10 pr-2 justify-between gap-[3px] shadow-sm overflow-hidden">
                                <div className="flex items-center gap-1 text-white font-mono text-xs">
                                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                    {formatTimer(recordingTime)}
                                </div>
                                <div className="flex items-center justify-between gap-[3px] h-full flex-1 mx-2">
                                    {visualizerData.map((h, i) => (
                                        <div key={i} className="w-[3px] rounded-full transition-all duration-150 bg-white" style={{ height: `${h}%` }} />
                                    ))}
                                </div>
                                <button onClick={stopRecording} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"><Square size={12} className="text-white fill-current" /></button>
                            </div>
                        </div>
                    ) : audioPreviewUrl ? (
                        <div className="flex items-center w-full max-w-[320px] mx-auto relative h-[60px] cursor-pointer">
                            <audio ref={audioElementRef} src={audioPreviewUrl} className="hidden" onTimeUpdate={() => { if(audioElementRef.current) setSeekTime(audioElementRef.current.currentTime); }} />
                            <div onClick={togglePlayPause} className="absolute left-0 z-10 w-[60px] h-[60px] bg-[#FF3B30] rounded-full flex items-center justify-center shadow-lg shadow-red-500/40 active:scale-95 transition-transform">
                                {isPlaying ? <Pause className="text-white fill-current" size={24} /> : <Play className="text-white fill-current ml-1" size={24} />}
                            </div>
                            <div className="ml-7 bg-[#FF3B30] h-[48px] w-full rounded-r-full flex items-center pl-10 pr-6 justify-between gap-[3px] shadow-sm overflow-hidden pointer-events-none">
                                {new Array(35).fill(10).map((_, i) => {
                                    const peakIdx = Math.floor((i / 35) * (waveformPeaks.length || 35));
                                    const heightPercent = waveformPeaks.length > 0 ? waveformPeaks[peakIdx] : (Math.sin(i * 0.8) * 30 + 50);
                                    const progressPercent = audioDuration > 0 ? seekTime / audioDuration : 0;
                                    const isActive = (i / 35) <= progressPercent;
                                    return <div key={i} className={`w-[3px] rounded-full transition-all duration-150 ${isActive ? 'bg-white' : 'bg-white/40'}`} style={{ height: `${heightPercent}%` }} />
                                })}
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Timeline Studio Drawer exactly like VoiceAssetsTab but pure icons for mobile */}
                <div className="bg-[#0B1E26] p-3 rounded-2xl border border-teal-500/40 shadow-2xl space-y-4">
                    {/* Action Bar (Icons Only in One Line) */}
                    <div className="flex items-center justify-between border-b border-teal-900/40 pb-3">
                        <div className="text-[10px] font-mono text-teal-400 font-bold">
                            {formatTimer(seekTime)} / {formatTimer(audioDuration)}
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={togglePlayPause} className="bg-teal-600 active:bg-teal-500 text-white w-9 h-9 rounded-full flex items-center justify-center shadow transition-transform active:scale-95">
                                {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                            </button>
                            <button onClick={startTimelineRecording} className={`${isTimelineRecording ? 'bg-red-500 animate-pulse' : 'bg-red-600'} text-white w-9 h-9 rounded-full flex items-center justify-center shadow active:scale-95`}>
                                {isTimelineRecording ? <Square size={14} className="fill-current" /> : <Mic size={16} />}
                            </button>
                            <button onClick={splitClipAtPlayhead} className="bg-teal-600 text-white w-9 h-9 rounded-full flex items-center justify-center shadow active:scale-95">
                                <Scissors size={16} />
                            </button>
                            <button onClick={deleteSelectedClip} disabled={!selectedClipId} className="bg-teal-900/50 text-red-400 w-9 h-9 rounded-full flex items-center justify-center shadow disabled:opacity-30 active:scale-95">
                                <Trash2 size={16} />
                            </button>
                            
                            <div className="flex flex-col ml-1 bg-teal-950/50 rounded-lg p-0.5 border border-teal-900/40">
                                <button onClick={() => setTimelineZoom(z => Math.min(5, z + 0.5))} className="p-1 text-teal-300"><ZoomIn size={14} /></button>
                                <button onClick={() => setTimelineZoom(z => Math.max(1, z - 0.5))} className="p-1 text-teal-300"><ZoomOut size={14} /></button>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Timeline */}
                    <div ref={timelineScrollRef} className="overflow-x-auto overflow-y-hidden rounded-xl border border-teal-900/60 bg-[#08181F] shadow-inner custom-scrollbar" style={{ maxHeight: '160px' }}>
                        <div ref={timelineTrackRef} onMouseDown={handleTimelineTouch} onTouchStart={handleTimelineTouch} className="relative cursor-pointer select-none group space-y-1 p-1" style={{ minWidth: `${timelineZoom * 100}%` }}>
                            
                            {/* Track 1: Main Audio */}
                            <div className="relative h-14 bg-[#051116] rounded-lg border border-teal-900/40 overflow-hidden flex items-center px-2">
                                {audioDuration > 0 && mainClips.map((clip) => {
                                    if (clip.isDeleted) return null;
                                    const leftPercent = (clip.start / audioDuration) * 100;
                                    const widthPercent = ((clip.end - clip.start) / audioDuration) * 100;
                                    const isSelected = selectedClipId === clip.id;
                                    const totalPeaks = waveformPeaks.length > 0 ? waveformPeaks.length : 72;
                                    const srcStart = clip.sourceStart !== undefined ? clip.sourceStart : clip.start;
                                    const srcEnd = srcStart + (clip.end - clip.start);
                                    const startIdx = Math.max(0, Math.floor((srcStart / audioDuration) * totalPeaks));
                                    const endIdx = Math.min(totalPeaks, Math.max(startIdx + 4, Math.ceil((srcEnd / audioDuration) * totalPeaks)));
                                    const clipPeaks = (waveformPeaks.length > 0 ? waveformPeaks : Array.from({ length: 72 }).map(() => 45)).slice(startIdx, endIdx);

                                    return (
                                        <div key={clip.id} onMouseDown={(e) => handleClipMove(e, clip)} onTouchStart={(e) => handleClipMove(e, clip)} className={`absolute top-1 bottom-1 rounded-lg border-2 flex items-center justify-between px-2 transition-all z-10 overflow-hidden ${isSelected ? 'bg-teal-500/50 border-teal-400 shadow-[0_0_14px_rgba(20,184,166,0.7)] ring-2 ring-teal-300' : 'bg-teal-950/90 border-teal-800/80 text-teal-200'}`} style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}>
                                            <div onMouseDown={(e) => handleClipTrim(e, clip, 'start')} onTouchStart={(e) => handleClipTrim(e, clip, 'start')} className="absolute left-0 top-0 bottom-0 w-4 -ml-2 bg-teal-400 z-30 flex items-center justify-center"><div className="w-0.5 h-3.5 bg-teal-950 rounded-full" /></div>
                                            <div className="absolute inset-0 flex items-center justify-between px-2 opacity-40 pointer-events-none z-0">
                                                {clipPeaks.map((h, i) => <div key={i} className="w-0.5 bg-teal-300 rounded-full" style={{ height: `${h}%` }} />)}
                                            </div>
                                            <div onMouseDown={(e) => handleClipTrim(e, clip, 'end')} onTouchStart={(e) => handleClipTrim(e, clip, 'end')} className="absolute right-0 top-0 bottom-0 w-4 -mr-2 bg-teal-400 z-30 flex items-center justify-center"><div className="w-0.5 h-3.5 bg-teal-950 rounded-full" /></div>
                                        </div>
                                    );
                                })}

                                {audioDuration > 0 && voiceoverClips.map(vo => {
                                    if (vo.isDeleted) return null;
                                    const leftPercent = (vo.start / audioDuration) * 100;
                                    const widthPercent = ((vo.end - vo.start) / audioDuration) * 100;
                                    return (
                                        <div key={`silenced-${vo.id}`} className="absolute top-0 bottom-0 bg-red-950/80 border-x-2 border-red-500/80 flex items-center justify-center pointer-events-none z-15" style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}>
                                            <span className="text-[8px] font-bold text-red-300 uppercase tracking-tight bg-black/80 px-1 py-0.5 rounded truncate">Muted</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Track 2: Voice-Over */}
                            <div className="relative h-14 bg-[#140F08] rounded-lg border border-amber-900/40 overflow-hidden flex items-center px-2">
                                {audioDuration > 0 && voiceoverClips.map((vo) => {
                                    if (vo.isDeleted) return null;
                                    const leftPercent = (vo.start / audioDuration) * 100;
                                    const widthPercent = ((vo.end - vo.start) / audioDuration) * 100;
                                    const isSelected = selectedClipId === vo.id;
                                    const voPeaks = Array.from({ length: 24 }).map((_, i) => Math.sin(i * 0.5) * 35 + 45);

                                    return (
                                        <div key={vo.id} onMouseDown={(e) => handleClipMove(e, vo)} onTouchStart={(e) => handleClipMove(e, vo)} className={`absolute top-1 bottom-1 rounded-lg border-2 flex items-center justify-between px-2 transition-all z-10 overflow-hidden ${isSelected ? 'bg-amber-500/60 border-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.8)] ring-2 ring-amber-300' : 'bg-amber-950/90 border-amber-600/80 text-amber-200'}`} style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}>
                                            <div onMouseDown={(e) => handleClipTrim(e, vo, 'start')} onTouchStart={(e) => handleClipTrim(e, vo, 'start')} className="absolute left-0 top-0 bottom-0 w-4 -ml-2 bg-amber-400 z-30 flex items-center justify-center"><div className="w-0.5 h-3.5 bg-amber-950 rounded-full" /></div>
                                            <div className="absolute inset-0 flex items-center justify-between px-2 opacity-40 pointer-events-none z-0">
                                                {voPeaks.map((h, i) => <div key={i} className="w-0.5 bg-amber-400 rounded-full" style={{ height: `${h}%` }} />)}
                                            </div>
                                            <div onMouseDown={(e) => handleClipTrim(e, vo, 'end')} onTouchStart={(e) => handleClipTrim(e, vo, 'end')} className="absolute right-0 top-0 bottom-0 w-4 -mr-2 bg-amber-400 z-30 flex items-center justify-center"><div className="w-0.5 h-3.5 bg-amber-950 rounded-full" /></div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Playhead */}
                            <div className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-50 pointer-events-none" style={{ left: `${(seekTime / audioDuration) * 100}%` }}>
                                <div className="absolute -top-1 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-[6px] border-l-transparent border-r-transparent border-t-red-500" />
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}