import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

interface CustomAudioPlayerProps {
    src: string;
    className?: string;
    autoPlay?: boolean;
}

export default function CustomAudioPlayer({ src, className = '', autoPlay = false }: CustomAudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const setAudioData = () => {
            setDuration(audio.duration);
        };
        
        const setAudioTime = () => {
            setCurrentTime(audio.currentTime);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };
        
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);

        audio.addEventListener('loadedmetadata', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        
        // Sometimes metadata is already loaded
        if (audio.readyState >= 1) {
            setDuration(audio.duration);
        }

        return () => {
            audio.removeEventListener('loadedmetadata', setAudioData);
            audio.removeEventListener('timeupdate', setAudioTime);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
        };
    }, [src]);

    const togglePlayPause = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (isPlaying) {
            audioRef.current?.pause();
        } else {
            audioRef.current?.play().catch(err => console.error("Playback error", err));
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        const time = Number(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
        }
        setCurrentTime(time);
    };

    const formatTime = (time: number) => {
        if (isNaN(time) || !isFinite(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`flex items-center gap-3 bg-[#18181b] rounded-full px-3 py-2 border border-white/5 w-full min-w-[200px] shadow-sm ${className}`} onClick={(e) => e.stopPropagation()}>
            <audio ref={audioRef} src={src} preload="metadata" autoPlay={autoPlay} className="hidden" />
            
            <button 
                onClick={togglePlayPause} 
                className="w-8 h-8 flex items-center justify-center bg-indigo-500 hover:bg-indigo-400 text-white rounded-full shrink-0 transition-colors"
                type="button"
            >
                {isPlaying ? <Pause size={14} className="fill-current" /> : <Play size={14} className="fill-current ml-0.5" />}
            </button>
            
            <div className="flex-1 flex flex-col justify-center relative">
                <input 
                    type="range" 
                    min="0" 
                    max={duration || 100} 
                    value={currentTime} 
                    onChange={handleSeek} 
                    onClick={(e) => e.stopPropagation()}
                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-400 [&::-webkit-slider-thumb]:rounded-full focus:outline-none"
                    style={{
                        background: `linear-gradient(to right, #818cf8 ${(currentTime / (duration || 1)) * 100}%, rgba(255, 255, 255, 0.1) ${(currentTime / (duration || 1)) * 100}%)`
                    }}
                />
            </div>
            
            <span className="text-[10px] font-mono text-zinc-400 shrink-0 w-[36px] text-right">
                {formatTime(currentTime || duration)}
            </span>
        </div>
    );
}
