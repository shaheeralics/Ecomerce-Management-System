// @ts-nocheck
import VoiceAssetsTab from './VoiceAssetsTab';
import PreRecordedVoicesTab from './PreRecordedVoicesTab';
import MobileVoiceEditor from './MobileVoiceEditor';
import AnalyticsPage from './AnalyticsPage';
import LiveConversations from './LiveConversations';
import OrdersPage from './OrdersPage';
import AIAgentPanel from './AIAgentPanel';
import CustomAudioPlayer from './CustomAudioPlayer';
import React, { useState, useEffect, useRef } from 'react';
import { Package, ShieldAlert, Mic2, MessageSquare, Settings, Plus, Trash2, Edit3, Camera, Video, Mic, ShoppingCart, BarChart, Square, Play, Pause, Volume2, CheckCircle, X, Upload, Download, StopCircle, SkipBack, SkipForward, Save, LayoutDashboard, Database, RefreshCw, Tag, DollarSign, Box, FileAudio, Loader2, Sparkles, Menu, ChevronLeft, MoreHorizontal, FileText, ChevronRight , ImageIcon, Search, LayoutGrid, List } from 'lucide-react';

const apiGuidanceData = {
    metaToken: {
        title: 'How to get Meta WhatsApp Token',
        content: '1. Go to Meta for Developers portal (developers.facebook.com).\n2. Create or select your Business App.\n3. Add WhatsApp product.\n4. Under WhatsApp > API Setup, copy the "Temporary access token".\n5. For a permanent token, create a System User in Facebook Business Manager with whatsapp_business_messaging permissions.'
    },
    metaPhoneId: {
        title: 'How to get Meta Phone Number ID',
        content: '1. In Meta Developer App, go to WhatsApp > API Setup.\n2. Under "Send and receive messages", copy the "Phone number ID".'
    },
    metaWabaId: {
        title: 'How to get WhatsApp Business Account ID (WABA ID)',
        content: '1. In Meta Developer App, go to WhatsApp > API Setup.\n2. Copy the "WhatsApp Business Account ID" displayed under your phone number.'
    },
    metaVerifyToken: {
        title: 'How to set Meta Verify Token',
        content: 'Enter any custom secure string here (e.g. pawanda_secret_token_123) and enter the exact same string in Meta Webhook verification setting.'
    },
    llmApiKey: {
        title: 'How to get LLM API Key',
        content: 'For Gemini: Go to Google AI Studio (aistudio.google.com) and click "Get API Key".\nFor OpenAI: Go to platform.openai.com/api-keys.'
    }
};

interface Product {
    id: number;
    title: string;
    brand: string | null;
    gender: string;
    color: string | null;
    size_original: string | null;
    starting_price: number;
    minimum_price: number;
    description: string | null;
    status: string;
    main_image_url: string | null;
    extra_image_urls: string | null;
    video_url: string | null;
    voice_note_url: string | null;
    created_at: string;
}

interface ImageItem {
    id: string;
    file?: File;
    url: string;
    isExisting?: boolean;
}

interface AudioTrackClip {
    id: string;
    track: 'main' | 'voiceover';
    name: string;
    start: number;
    end: number;
    sourceStart?: number;
    buffer?: AudioBuffer;
    isDeleted?: boolean;
}

interface TimelineHistoryStep {
    mainClips: AudioTrackClip[];
    voiceoverClips: AudioTrackClip[];
    audioDuration: number;
}

// Encode an AudioBuffer directly to OGG/Opus using MediaRecorder (real browser-native encoding)
async function audioBufferToOggBlob(buffer: AudioBuffer): Promise<Blob> {
    return new Promise((resolve) => {
        const preferredMime = MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')
            ? 'audio/ogg; codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
            ? 'audio/webm; codecs=opus'
            : 'audio/webm';

        const ctx = new AudioContext();
        const dest = ctx.createMediaStreamDestination();
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(dest);

        const recorder = new MediaRecorder(dest.stream, { mimeType: preferredMime });
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
            ctx.close();
            resolve(new Blob(chunks, { type: preferredMime }));
        };

        recorder.start();
        source.start();
        source.onended = () => recorder.stop();
    });
}


const WhatsAppDashboard = () => {
    const [subTab, setSubTab] = useState<'products' | 'conversations' | 'policy' | 'prerecorded' | 'orders' | 'analytics' | 'ai-agent'>('products');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid'|'list'>('list');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [activeMobilePage, setActiveMobilePage] = useState<"main" | "add-product" | "more-menu" | "analytics" | "policy" | "prerecorded" | "ai-agent">("main");
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    // Multi-phase stepper state (Phase 1: Details, Phase 2: Media Images & Video, Phase 3: Voice Note Pitch)
    const [activePhase, setActivePhase] = useState<1 | 2 | 3>(1);

    // Warn on beforeunload if uploading
    useEffect(() => {
        const hasUploading = products.some((p: any) => p.status === 'uploading');
        if (hasUploading) {
            const handleBeforeUnload = (e: BeforeUnloadEvent) => {
                e.preventDefault();
                e.returnValue = ''; // Standard way to trigger prompt in modern browsers
            };
            window.addEventListener('beforeunload', handleBeforeUnload);
            return () => window.removeEventListener('beforeunload', handleBeforeUnload);
        }
    }, [products]);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        brand: '',
        gender: 'men',
        color: '',
        size_original: '',
        starting_price: '',
        minimum_price: '',
        description: ''
    });

    // Image items list for alignment, reordering & thumbnail selection
    const [productImages, setProductImages] = useState<ImageItem[]>([]);

    // Video state
    const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
    const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

    // Audio / Voice note states
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [transcriptionText, setTranscriptionText] = useState("");
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);

    // Refs to avoid React async state closure bugs for Web Audio API Punch-In Overwrite
    const prevAudioBlobRef = useRef<Blob | null>(null);
    const overwriteSeekRef = useRef<number | null>(null);
    const originalMainBlobRef = useRef<Blob | null>(null);

    // Punch-In Overwrite Timeline State
    const [audioDuration, setAudioDuration] = useState(0);
    const [seekTime, setSeekTime] = useState(0);

    // CapCut Multi-Track Studio States (Track 1: Main | Track 2: Voice-Over)
    const [showTimelineEditor, setShowTimelineEditor] = useState(false);
    const [mainClips, setMainClips] = useState<AudioTrackClip[]>([]);
    const [voiceoverClips, setVoiceoverClips] = useState<AudioTrackClip[]>([]);
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const [selectedTrack, setSelectedTrack] = useState<'main' | 'voiceover'>('main');
    const [timelineHistory, setTimelineHistory] = useState<TimelineHistoryStep[]>([]);
    const [historyIndex, setHistoryIndex] = useState<number>(-1);
    const [trimStart, setTrimStart] = useState(0);
    const [trimEnd, setTrimEnd] = useState(0);
    const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [timelineZoom, setTimelineZoom] = useState(1);
    const [isTimelineRecording, setIsTimelineRecording] = useState(false);
    const timelineScrollRef = useRef<HTMLDivElement | null>(null);
    const timelineTrackRef = useRef<HTMLDivElement | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerIntervalRef = useRef<number | null>(null);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);

    // Card Gallery Active Image State
    const [cardActiveImageIndex, setCardActiveImageIndex] = useState<{ [productId: number]: number }>({});

    // Agent settings state
    const [systemPrompt, setSystemPrompt] = useState('');
    const [promptSaving, setPromptSaving] = useState(false);

    // API & Credentials Settings State
    const [apiSettings, setApiSettings] = useState({
        metaToken: '',
        metaPhoneId: '',
        metaWabaId: '',
        metaAppId: '',
        metaAppSecret: '',
        metaVerifyToken: '',
        llmApiKey: '',
        shopifyUrl: '',
        shopifyToken: '',
        shopifyWebhookSecret: '',
        webhookUrl: ''
    });
    const [activeGuidance, setActiveGuidance] = useState<keyof typeof apiGuidanceData | null>(null);

    // Preview Modal for viewing product media
    const [activeMediaPreview, setActiveMediaPreview] = useState<{ type: 'video' | 'audio', url: string, title: string } | null>(null);

    // Live Audio Visualizer State
    const [visualizerData, setVisualizerData] = useState<number[]>(new Array(35).fill(30));
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Fetch products
    const fetchProducts = async (silentMerge = false) => {
        if (!silentMerge) setLoading(true);
        try {
            const res = await fetch(`/api/products?_t=${Date.now()}`);
            const data = await res.json();
            if (data.success) {
                if (silentMerge) {
                    setProducts(prev => {
                        // 1. Map over DB products to merge with existing local ones
                        const mergedDbProducts = data.data.map((dbProduct: any) => {
                            // Try to find the product in local state by ID.
                            // Note: if a temp product just got its real ID updated via xhr.onload, it will match.
                            const localProduct = prev.find(p => p.id === dbProduct.id);

                            if (localProduct && (dbProduct.status as any) === 'uploading') {
                                // Preserve local blob URLs to prevent images from flashing/disappearing
                                return {
                                    ...dbProduct,
                                    main_image_url: dbProduct.main_image_url || localProduct.main_image_url,
                                    video_url: dbProduct.video_url || localProduct.video_url,
                                    voice_note_url: dbProduct.voice_note_url || localProduct.voice_note_url
                                };
                            }
                            return dbProduct;
                        });

                        // 2. Retain optimistic products (negative IDs) that are still uploading 
                        // and haven't been assigned a DB ID yet.
                        const optimisticProducts = prev.filter(p => p.id < 0);

                        return [...optimisticProducts, ...mergedDbProducts];
                    });
                } else {
                    setProducts(data.data);
                }
            }
        } catch (err) {
            console.error('Failed to fetch products:', err);
        }
        if (!silentMerge) setLoading(false);
    };

    // Poll for status updates if any product is uploading
    useEffect(() => {
        const hasUploading = products.some((p: any) => p.status === 'uploading');
        if (!hasUploading) return;

        const interval = setInterval(() => {
            fetchProducts(true);
        }, 3000);

        return () => clearInterval(interval);
    }, [products]);

    // Fetch agent config
    const fetchAgentConfig = async () => {
        try {
            const res = await fetch('/api/agent-config');
            const data = await res.json();
            if (data.success) setSystemPrompt(data.data.system_prompt || '');
        } catch (err) { console.error(err); }
    };

    // Fetch API Settings
    const fetchApiSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data && data.metaToken !== undefined) {
                setApiSettings(prev => ({ ...prev, ...data }));
            }
        } catch (err) {
            console.error('Failed to fetch API settings:', err);
        }
    };

    // Save All Configuration
    const saveAllConfig = async () => {
        setPromptSaving(true);
        try {
            const [resSettings, resPrompt] = await Promise.all([
                fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(apiSettings)
                }),
                fetch('/api/agent-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ system_prompt: systemPrompt })
                })
            ]);

            if (resSettings.ok && resPrompt.ok) {
                alert('WhatsApp API & Agent Settings saved successfully to MySQL!');
            } else {
                alert('Settings saved with potential warning, please check backend.');
            }
        } catch (err) {
            alert('Failed to save settings.');
        }
        setPromptSaving(false);
    };

    useEffect(() => {
        fetchProducts();
        fetchAgentConfig();
        fetchApiSettings();
    }, []);

    // Cleanup blob URLs on unmount
    useEffect(() => {
        return () => {
            productImages.forEach(img => { if (img.url.startsWith('blob:')) URL.revokeObjectURL(img.url); });
            if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(videoPreviewUrl);
            if (audioPreviewUrl && audioPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(audioPreviewUrl);
        };
    }, []);

    // Image handling & reordering/alignment
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const newItems: ImageItem[] = files.map((f, i) => ({
                id: `new_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
                file: f,
                url: URL.createObjectURL(f),
                isExisting: false
            }));
            setProductImages(prev => [...prev, ...newItems]);
        }
    };

    const makeMainImage = (index: number) => {
        if (index === 0) return;
        setProductImages(prev => {
            const copy = [...prev];
            const [selected] = copy.splice(index, 1);
            copy.unshift(selected);
            return copy;
        });
    };

    const moveImageLeft = (index: number) => {
        if (index <= 0) return;
        setProductImages(prev => {
            const copy = [...prev];
            const temp = copy[index - 1];
            copy[index - 1] = copy[index];
            copy[index] = temp;
            return copy;
        });
    };

    const moveImageRight = (index: number) => {
        setProductImages(prev => {
            if (index >= prev.length - 1) return prev;
            const copy = [...prev];
            const temp = copy[index + 1];
            copy[index + 1] = copy[index];
            copy[index] = temp;
            return copy;
        });
    };

    const removeImageItem = (index: number) => {
        setProductImages(prev => {
            const target = prev[index];
            if (target.url.startsWith('blob:')) URL.revokeObjectURL(target.url);
            return prev.filter((_, i) => i !== index);
        });
    };

    // Video handling
    const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedVideo(file);
            if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(videoPreviewUrl);
            setVideoPreviewUrl(URL.createObjectURL(file));
        }
    };

    const removeVideo = () => {
        if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(videoPreviewUrl);
        setSelectedVideo(null);
        setVideoPreviewUrl(null);
    };

    // Voice Note handling (Record, Pause, Resume, Stop & Web Audio Timeline Punch-In Overwrite)
    
    const handleTranscribe = async () => {
        setActiveMobilePage('add-product-voice-transcribe');
        setIsTranscribing(true);
        try {
            if (!audioBlob) throw new Error('No audio recorded.');
            const formData = new FormData();
            formData.append('audio', audioBlob, 'voice-note.webm');
            
            // Call the backend transcribe API
            const res = await fetch('/api/transcribe', { 
                method: 'POST', 
                body: formData 
            });
            const data = await res.json();
            
            if (data.success) {
                setTranscriptionText(data.text);
            } else {
                throw new Error(data.error || 'Failed to transcribe');
            }
        } catch (err: any) {
            console.error('Transcription error:', err);
            setTranscriptionText(`Error: ${err.message || 'Failed to transcribe audio'}`);
        } finally {
            setIsTranscribing(false);
        }
    };

    const startRecording = async (overwriteSeek?: number) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            // Let the browser choose its best default codec/bitrate to avoid distortion
            const mimeType = MediaRecorder.isTypeSupported('audio/ogg; codecs=opus') ? 'audio/ogg; codecs=opus' : 
                             MediaRecorder.isTypeSupported('audio/webm; codecs=opus') ? 'audio/webm; codecs=opus' : 
                             '';
            mediaRecorderRef.current = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            audioChunksRef.current = [];

            // Save prior audio blob and seek timestamp into REFS to avoid stale state closures
            let targetPriorBlob = audioBlob;
            if (!targetPriorBlob && audioPreviewUrl && overwriteSeek !== undefined && overwriteSeek > 0) {
                try {
                    const resp = await fetch(audioPreviewUrl);
                    targetPriorBlob = await resp.blob();
                } catch (e) {
                    console.error('Failed to fetch prior audio blob:', e);
                }
            }

            if (overwriteSeek !== undefined && overwriteSeek > 0 && targetPriorBlob) {
                prevAudioBlobRef.current = targetPriorBlob;
                overwriteSeekRef.current = overwriteSeek;
            } else {
                prevAudioBlobRef.current = null;
                overwriteSeekRef.current = null;
            }

            // Setup Real-time Audio Visualizer
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = audioCtx;
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.5;
            
            // Clone the stream for the visualizer so WebAudio doesn't corrupt the MediaRecorder stream (known Safari/Mobile bug)
            const visualizerStream = stream.clone();
            const source = audioCtx.createMediaStreamSource(visualizerStream);
            source.connect(analyser);
            analyserRef.current = analyser;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            dataArrayRef.current = dataArray;

            const updateVisualizer = () => {
                if (!analyserRef.current || !dataArrayRef.current) return;
                analyserRef.current.getByteTimeDomainData(dataArrayRef.current as any);

                // Compute overall mic volume via RMS
                let sum = 0;
                for (let j = 0; j < dataArrayRef.current.length; j++) {
                    const v = (dataArrayRef.current[j] - 128) / 128;
                    sum += v * v;
                }
                const rms = Math.sqrt(sum / dataArrayRef.current.length);
                const volume = Math.min(1, rms * 4); // boost sensitivity

                // Generate bars: natural waveform shape modulated by live volume
                const newData: number[] = [];
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
                        // Track 2 Voice-Over Recording at playhead timestamp
                        const voStart = cutTime;
                        const voEnd = voStart + recordedDur;

                        const newVoClip: AudioTrackClip = {
                            id: `vo-${Date.now()}`,
                            track: 'voiceover',
                            name: `Voice-Over (${formatTimer(voStart)})`,
                            start: voStart,
                            end: voEnd,
                            sourceStart: 0,
                            buffer: newAudioBuf
                        };

                        const updatedVOs = [...voiceoverClips, newVoClip];
                        setVoiceoverClips(updatedVOs);
                        setSelectedClipId(newVoClip.id);
                        setSelectedTrack('voiceover');

                        const newMaxDur = Math.max(audioDuration, voEnd);
                        setAudioDuration(newMaxDur);
                        setTrimEnd(newMaxDur);

                        await autoMixPreview(mainClips, updatedVOs, newMaxDur);
                        pushTimelineHistory(mainClips, updatedVOs, newMaxDur);
                    } else {
                        // Track 1 Primary Main Audio Note Recording
                        originalMainBlobRef.current = recordedNewBlob;
                        setAudioBlob(recordedNewBlob);

                        if (audioPreviewUrl && audioPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(audioPreviewUrl);
                        const newUrl = URL.createObjectURL(recordedNewBlob);
                        setAudioPreviewUrl(newUrl);

                        setAudioDuration(recordedDur);
                        setTrimStart(0);
                        setTrimEnd(recordedDur);

                        const newMainClip: AudioTrackClip = {
                            id: `main-${Date.now()}`,
                            track: 'main',
                            name: 'Main Track',
                            start: 0,
                            end: recordedDur,
                            sourceStart: 0
                        };

                        setMainClips([newMainClip]);
                        setVoiceoverClips([]);
                        setSelectedClipId(newMainClip.id);
                        setSelectedTrack('main');

                        await autoMixPreview([newMainClip], [], recordedDur);
                        setTimelineHistory([{ mainClips: [newMainClip], voiceoverClips: [], audioDuration: recordedDur }]);
                        setHistoryIndex(0);
                    }
                } catch (err) {
                    console.error('Failed to process recorded audio clip:', err);
                }

                prevAudioBlobRef.current = null;
                overwriteSeekRef.current = null;
                stream.getTracks().forEach(track => track.stop());

                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
                if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close();
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setIsPaused(false);
            setRecordingTime(0);

            timerIntervalRef.current = window.setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            alert('Microphone access denied or not supported by browser.');
            console.error('Mic access error:', err);
        }
    };

    // Generate Real Waveform Amplitude Peaks from PCM Channel Data
    const generateRealWaveformPeaks = async (blob: Blob | null, url: string | null) => {
        let sourceBlob = blob;
        if (!sourceBlob && url) {
            try {
                const res = await fetch(url);
                sourceBlob = await res.blob();
            } catch (e) {
                console.error('Failed to fetch audio for peaks:', e);
            }
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
        } catch (err) {
            console.error('Failed to calculate real waveform peaks:', err);
        }
    };

    useEffect(() => {
        if (showTimelineEditor || audioPreviewUrl) {
            generateRealWaveformPeaks(audioBlob, audioPreviewUrl);
        }
    }, [audioBlob, audioPreviewUrl, showTimelineEditor]);

    // Play / Pause Toggle for Timeline Audio
    const togglePlayPause = () => {
        if (!audioElementRef.current) return;
        if (audioElementRef.current.paused) {
            audioElementRef.current.play().then(() => setIsPlaying(true)).catch(() => { });
        } else {
            audioElementRef.current.pause();
            setIsPlaying(false);
        }
    };

    // Inline Timeline Voice-Over Recording (records into Track 2 without leaving editor)
    const timelineRecordStartRef = useRef<number>(0);
    const timelineRecordTimerRef = useRef<number | null>(null);

    const startTimelineRecording = () => {
        if (isTimelineRecording) {
            stopTimelineRecording();
            return;
        }
        const recordStart = seekTime;
        timelineRecordStartRef.current = recordStart;
        setIsTimelineRecording(true);

        // Start actual mic recording using the existing startRecording with seekTime
        startRecording(recordStart);

        // Move the playhead forward as recording progresses
        let elapsed = 0;
        timelineRecordTimerRef.current = window.setInterval(() => {
            elapsed += 0.1;
            const newTime = recordStart + elapsed;
            setSeekTime(newTime);
            // Extend timeline if recording goes beyond current duration
            if (newTime > audioDuration) {
                setAudioDuration(newTime);
            }
            // Auto-scroll timeline to keep playhead visible
            if (timelineScrollRef.current && timelineTrackRef.current) {
                const scrollContainer = timelineScrollRef.current;
                const trackWidth = timelineTrackRef.current.scrollWidth;
                const playheadX = (newTime / Math.max(audioDuration, newTime)) * trackWidth;
                const containerWidth = scrollContainer.clientWidth;
                if (playheadX > scrollContainer.scrollLeft + containerWidth - 50) {
                    scrollContainer.scrollLeft = playheadX - containerWidth + 80;
                }
            }
        }, 100);
    };

    const stopTimelineRecording = () => {
        setIsTimelineRecording(false);
        if (timelineRecordTimerRef.current) {
            clearInterval(timelineRecordTimerRef.current);
            timelineRecordTimerRef.current = null;
        }
        stopRecording();
    };

    // Push a new snapshot state into history stack
    const pushTimelineHistory = (mClips: AudioTrackClip[], voClips: AudioTrackClip[], dur: number) => {
        setTimelineHistory(prevHistory => {
            const activeHistory = prevHistory.slice(0, historyIndex + 1);
            const newStep: TimelineHistoryStep = {
                mainClips: JSON.parse(JSON.stringify(mClips)),
                voiceoverClips: JSON.parse(JSON.stringify(voClips)),
                audioDuration: dur
            };
            const updated = [...activeHistory, newStep];
            setHistoryIndex(updated.length - 1);
            return updated;
        });
    };

    // Undo (Ctrl + Z)
    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIdx = historyIndex - 1;
            const targetStep = timelineHistory[newIdx];
            const restoredMain = JSON.parse(JSON.stringify(targetStep.mainClips));
            const restoredVO = JSON.parse(JSON.stringify(targetStep.voiceoverClips));
            setMainClips(restoredMain);
            setVoiceoverClips(restoredVO);
            setAudioDuration(targetStep.audioDuration);
            setHistoryIndex(newIdx);
            autoMixPreview(restoredMain, restoredVO, targetStep.audioDuration);
        }
    };

    // Redo (Ctrl + Y or Ctrl + Shift + Z)
    const handleRedo = () => {
        if (historyIndex < timelineHistory.length - 1) {
            const newIdx = historyIndex + 1;
            const targetStep = timelineHistory[newIdx];
            const restoredMain = JSON.parse(JSON.stringify(targetStep.mainClips));
            const restoredVO = JSON.parse(JSON.stringify(targetStep.voiceoverClips));
            setMainClips(restoredMain);
            setVoiceoverClips(restoredVO);
            setAudioDuration(targetStep.audioDuration);
            setHistoryIndex(newIdx);
            autoMixPreview(restoredMain, restoredVO, targetStep.audioDuration);
        }
    };

    // Keyboard Shortcuts listener (Space: Play/Pause, Delete/Backspace: Delete selected clip, Ctrl+Z: Undo, Ctrl+Y/Ctrl+Shift+Z: Redo, Ctrl+/Ctrl-: Zoom)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!showTimelineEditor) return;
            const activeElem = document.activeElement;
            const tagName = activeElem?.tagName.toUpperCase();
            if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return;

            if (e.code === 'Space') {
                e.preventDefault();
                togglePlayPause();
            } else if (e.code === 'Delete' || e.code === 'Backspace') {
                if (selectedClipId) {
                    e.preventDefault();
                    deleteSelectedClip();
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    handleRedo();
                } else {
                    handleUndo();
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                handleRedo();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
                e.preventDefault();
                setTimelineZoom(prev => Math.min(5, prev + 0.5));
            } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
                e.preventDefault();
                setTimelineZoom(prev => Math.max(1, prev - 0.5));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showTimelineEditor, isPlaying, selectedClipId, mainClips, voiceoverClips, audioDuration, historyIndex, timelineHistory]);

    // Auto-sync initial timeline clip segment when audio metadata loads
    useEffect(() => {
        if (audioDuration > 0) {
            if (mainClips.length === 0 || (mainClips.length === 1 && mainClips[0].end === 0)) {
                const initialMain: AudioTrackClip[] = [{ id: `main-${Date.now()}`, track: 'main', name: 'Main Track', start: 0, end: audioDuration, sourceStart: 0 }];
                setMainClips(initialMain);
                setTrimStart(0);
                setTrimEnd(audioDuration);
                autoMixPreview(initialMain, [], audioDuration);
                setTimelineHistory([{ mainClips: initialMain, voiceoverClips: [], audioDuration }]);
                setHistoryIndex(0);
            }
        } else {
            setMainClips([]);
            setVoiceoverClips([]);
            setTrimStart(0);
            setTrimEnd(0);
            setTimelineHistory([]);
            setHistoryIndex(-1);
        }
    }, [audioDuration]);

    // Move / Drag clip along timeline
    const handleClipMouseDown = (e: React.MouseEvent, clip: AudioTrackClip) => {
        e.preventDefault();
        e.stopPropagation();

        setSelectedClipId(clip.id);
        setSelectedTrack(clip.track);

        const startX = e.clientX;
        const initialStart = clip.start;
        const clipDur = clip.end - clip.start;
        let hasMoved = false;

        const onMouseMove = (moveEvt: MouseEvent) => {
            if (Math.abs(moveEvt.clientX - startX) > 2) {
                hasMoved = true;
            }
            if (!hasMoved || !timelineTrackRef.current || audioDuration <= 0) return;

            const rect = timelineTrackRef.current.getBoundingClientRect();
            const deltaX = moveEvt.clientX - startX;
            const deltaTime = (deltaX / rect.width) * audioDuration;

            const newStart = Math.max(0, initialStart + deltaTime);
            const newEnd = newStart + clipDur;

            if (clip.track === 'main') {
                setMainClips(prev => prev.map(c => c.id === clip.id ? { ...c, start: newStart, end: newEnd } : c));
            } else {
                setVoiceoverClips(prev => prev.map(c => c.id === clip.id ? { ...c, start: newStart, end: newEnd } : c));
            }

            if (newEnd > audioDuration) {
                setAudioDuration(newEnd);
            }
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);

            // Re-mix audio immediately & save history step
            setMainClips(latestMain => {
                setVoiceoverClips(latestVO => {
                    autoMixPreview(latestMain, latestVO, audioDuration);
                    if (hasMoved) {
                        pushTimelineHistory(latestMain, latestVO, audioDuration);
                    }
                    return latestVO;
                });
                return latestMain;
            });
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    // Mouse Crop / Trim Left or Right edge of an individual clip box
    const handleClipTrimMouseDown = (e: React.MouseEvent, clip: AudioTrackClip, side: 'start' | 'end') => {
        e.preventDefault();
        e.stopPropagation();

        setSelectedClipId(clip.id);
        setSelectedTrack(clip.track);

        const startX = e.clientX;
        const initialStart = clip.start;
        const initialEnd = clip.end;
        const initialSrcStart = clip.sourceStart !== undefined ? clip.sourceStart : clip.start;

        const onMouseMove = (moveEvt: MouseEvent) => {
            if (!timelineTrackRef.current || audioDuration <= 0) return;

            const rect = timelineTrackRef.current.getBoundingClientRect();
            const deltaX = moveEvt.clientX - startX;
            const deltaTime = (deltaX / rect.width) * audioDuration;

            if (side === 'start') {
                const newStart = Math.min(initialEnd - 0.1, Math.max(0, initialStart + deltaTime));
                const deltaStart = newStart - initialStart;
                const newSrcStart = Math.max(0, initialSrcStart + deltaStart);

                if (clip.track === 'main') {
                    setMainClips(prev => prev.map(c => c.id === clip.id ? { ...c, start: newStart, sourceStart: newSrcStart } : c));
                } else {
                    setVoiceoverClips(prev => prev.map(c => c.id === clip.id ? { ...c, start: newStart, sourceStart: newSrcStart } : c));
                }
            } else {
                const newEnd = Math.max(initialStart + 0.1, initialEnd + deltaTime);
                if (newEnd > audioDuration) {
                    setAudioDuration(newEnd);
                }
                if (clip.track === 'main') {
                    setMainClips(prev => prev.map(c => c.id === clip.id ? { ...c, end: newEnd } : c));
                } else {
                    setVoiceoverClips(prev => prev.map(c => c.id === clip.id ? { ...c, end: newEnd } : c));
                }
            }
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);

            // Trigger real-time auto-mix & save history step
            setMainClips(latestMain => {
                setVoiceoverClips(latestVO => {
                    autoMixPreview(latestMain, latestVO, audioDuration);
                    pushTimelineHistory(latestMain, latestVO, audioDuration);
                    return latestVO;
                });
                return latestMain;
            });
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    /*
    // Nudge selected clip left or right by N seconds
    const nudgeSelectedClip = (seconds: number) => {
        if (!selectedClipId) return;

        if (selectedTrack === 'main') {
            setMainClips(prev => {
                const next = prev.map(c => {
                    if (c.id !== selectedClipId) return c;
                    const dur = c.end - c.start;
                    const newStart = Math.max(0, c.start + seconds);
                    const newEnd = newStart + dur;
                    if (newEnd > audioDuration) setAudioDuration(newEnd);
                    return { ...c, start: newStart, end: newEnd };
                });
                autoMixPreview(next, voiceoverClips, audioDuration);
                pushTimelineHistory(next, voiceoverClips, audioDuration);
                return next;
            });
        } else {
            setVoiceoverClips(prev => {
                const next = prev.map(c => {
                    if (c.id !== selectedClipId) return c;
                    const dur = c.end - c.start;
                    const newStart = Math.max(0, c.start + seconds);
                    const newEnd = newStart + dur;
                    if (newEnd > audioDuration) setAudioDuration(newEnd);
                    return { ...c, start: newStart, end: newEnd };
                });
                autoMixPreview(mainClips, next, audioDuration);
                pushTimelineHistory(mainClips, next, audioDuration);
                return next;
            });
        }
    };
    */

    // Split clip at exact playhead position (Multi-cut)
    const splitClipAtPlayhead = () => {
        if (audioDuration <= 0) return;
        const splitTime = seekTime;

        if (selectedTrack === 'voiceover') {
            setVoiceoverClips(prev => {
                const idx = prev.findIndex(c => !c.isDeleted && splitTime > c.start + 0.05 && splitTime < c.end - 0.05);
                if (idx === -1) {
                    alert(`Cannot cut Voice-Over track at ${formatTimer(splitTime)}. Move playhead inside a Voice-Over clip.`);
                    return prev;
                }
                const target = prev[idx];
                const offsetFromClipStart = splitTime - target.start;
                const targetSourceStart = target.sourceStart ?? 0;

                const c1: AudioTrackClip = {
                    ...target,
                    id: `vo-${Date.now()}-A`,
                    end: splitTime,
                    sourceStart: targetSourceStart
                };
                const c2: AudioTrackClip = {
                    ...target,
                    id: `vo-${Date.now()}-B`,
                    start: splitTime,
                    sourceStart: targetSourceStart + offsetFromClipStart
                };
                const copy = [...prev];
                copy.splice(idx, 1, c1, c2);
                setSelectedClipId(c2.id);
                autoMixPreview(mainClips, copy, audioDuration);
                pushTimelineHistory(mainClips, copy, audioDuration);
                return copy;
            });
        } else {
            setMainClips(prev => {
                const idx = prev.findIndex(c => !c.isDeleted && splitTime > c.start + 0.05 && splitTime < c.end - 0.05);
                if (idx === -1) {
                    alert(`Cannot cut Track 1 at ${formatTimer(splitTime)}. Move playhead inside an active Track 1 clip.`);
                    return prev;
                }
                const target = prev[idx];
                const offsetFromClipStart = splitTime - target.start;
                const targetSourceStart = target.sourceStart ?? target.start;

                const c1: AudioTrackClip = {
                    ...target,
                    id: `main-${Date.now()}-A`,
                    end: splitTime,
                    sourceStart: targetSourceStart
                };
                const c2: AudioTrackClip = {
                    ...target,
                    id: `main-${Date.now()}-B`,
                    start: splitTime,
                    sourceStart: targetSourceStart + offsetFromClipStart
                };
                const copy = [...prev];
                copy.splice(idx, 1, c1, c2);
                setSelectedClipId(c2.id);
                autoMixPreview(copy, voiceoverClips, audioDuration);
                pushTimelineHistory(copy, voiceoverClips, audioDuration);
                return copy;
            });
        }
    };

    // Delete selected clip segment
    const deleteSelectedClip = () => {
        if (!selectedClipId) {
            alert('Click on any clip on Track 1 or Track 2 to select it first.');
            return;
        }
        const nextMain = mainClips.map(c => c.id === selectedClipId ? { ...c, isDeleted: true } : c);
        const nextVO = voiceoverClips.map(c => c.id === selectedClipId ? { ...c, isDeleted: true } : c);
        setMainClips(nextMain);
        setVoiceoverClips(nextVO);
        setSelectedClipId(null);
        autoMixPreview(nextMain, nextVO, audioDuration);
        pushTimelineHistory(nextMain, nextVO, audioDuration);
    };

    // Reset all cuts
    // const resetAllCuts = () => {
    //     const freshMain: AudioTrackClip[] = [{ id: `main-${Date.now()}`, track: 'main', name: 'Main Track', start: 0, end: audioDuration, sourceStart: 0 }];
    //     setMainClips(freshMain);
    //     setVoiceoverClips([]);
    //     setTrimStart(0);
    //     setTrimEnd(audioDuration);
    //     setSelectedClipId(null);
    //     autoMixPreview(freshMain, [], audioDuration);
    //     pushTimelineHistory(freshMain, [], audioDuration);
    // };

    // Helper function to calculate exact end timestamp of the last active clip
    const calculateMaxClipEnd = (mClips: AudioTrackClip[], voClips: AudioTrackClip[]): number => {
        const activeM = mClips.filter(c => !c.isDeleted);
        const activeV = voClips.filter(c => !c.isDeleted);
        let maxEnd = 0;
        for (const m of activeM) {
            if (m.end > maxEnd) maxEnd = m.end;
        }
        for (const v of activeV) {
            if (v.end > maxEnd) maxEnd = v.end;
        }
        return maxEnd;
    };

    // Auto-mix Multi-Track Preview whenever clips change so playback immediately mutes Track 1 during Voice-Over
    const autoMixPreview = async (mClips: AudioTrackClip[], voClips: AudioTrackClip[], currentMaxDur: number) => {
        let mainSourceBlob = originalMainBlobRef.current || audioBlob;
        if (!mainSourceBlob && audioPreviewUrl) {
            try {
                const resp = await fetch(audioPreviewUrl);
                mainSourceBlob = await resp.blob();
            } catch (err) { }
        }

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

            // Timeline duration automatically matches the end of the last active clip!
            let maxDur = calculateMaxClipEnd(mClips, voClips);
            if (maxDur <= 0) {
                maxDur = mainAudioBuf ? mainAudioBuf.duration : currentMaxDur;
            }

            if (maxDur > 0) {
                setAudioDuration(maxDur);
            }

            const totalSamples = Math.floor(maxDur * sampleRate);
            if (totalSamples <= 0) return;

            const outputBuf = audioCtx.createBuffer(channels, totalSamples, sampleRate);

            // 1. Copy Track 1 (Main Track) - EXPLICITLY MUTE DURING VOICE-OVER REGIONS
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

                            // Check if this specific sample is muted by any Voice Over
                            const isMutedByVO = activeVO.some(vo => {
                                const voStartSamp = Math.round(vo.start * sampleRate);
                                const voEndSamp = Math.round(vo.end * sampleRate);
                                return targetIdx >= voStartSamp && targetIdx <= voEndSamp;
                            });

                            if (targetIdx >= 0 && targetIdx < totalSamples) {
                                if (isMutedByVO) {
                                    outData[targetIdx] = 0;
                                } else if (srcIdx >= 0 && srcIdx < srcData.length) {
                                    outData[targetIdx] = srcData[srcIdx];
                                }
                            }
                        }
                    }
                }
            }

            // 2. Mix Track 2 (Voice-Over Clips)
            for (const vo of activeVO) {
                if (!vo.buffer) continue;
                const voBuf = vo.buffer;
                const voSourceStartSec = vo.sourceStart !== undefined ? vo.sourceStart : 0;
                const voDurationSec = vo.end - vo.start;
                const voSamplesCount = Math.round(voDurationSec * sampleRate);
                
                const targetStartIdx = Math.round(vo.start * sampleRate);
                const voSrcStartSamp = Math.round(voSourceStartSec * sampleRate);

                for (let c = 0; c < channels; c++) {
                    const outData = outputBuf.getChannelData(c);
                    const voData = voBuf.numberOfChannels > c ? voBuf.getChannelData(c) : voBuf.getChannelData(0);

                    for (let j = 0; j < voSamplesCount; j++) {
                        const targetIdx = targetStartIdx + j;
                        const srcIdx = voSrcStartSamp + j;

                        if (targetIdx >= 0 && targetIdx < totalSamples && srcIdx >= 0 && srcIdx < voData.length) {
                            outData[targetIdx] = voData[srcIdx];
                        }
                    }
                }
            }

            const mixedOggBlob = await audioBufferToOggBlob(outputBuf);
            if (audioPreviewUrl && audioPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(audioPreviewUrl);
            const newUrl = URL.createObjectURL(mixedOggBlob);
            setAudioPreviewUrl(newUrl);

            if (audioElementRef.current) {
                const currentPos = audioElementRef.current.currentTime;
                audioElementRef.current.src = newUrl;
                audioElementRef.current.load();
                audioElementRef.current.currentTime = currentPos;
            }
        } catch (err) {
            console.error('Auto-mix preview failed:', err);
        }
    };

    // Apply & Stitch remaining active clips and save
    const applyStitchingAndSave = async () => {
        let mainSourceBlob = audioBlob;
        if (!mainSourceBlob && audioPreviewUrl) {
            try {
                const resp = await fetch(audioPreviewUrl);
                mainSourceBlob = await resp.blob();
            } catch (err) {
                console.error('Failed to fetch audio preview:', err);
            }
        }

        const activeMain = mainClips.filter(c => !c.isDeleted);
        const activeVO = voiceoverClips.filter(c => !c.isDeleted);

        if (!mainSourceBlob && activeVO.length === 0) {
            alert('No audio tracks found to export.');
            return;
        }

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

            let maxDur = calculateMaxClipEnd(activeMain, activeVO);
            if (maxDur <= 0) {
                maxDur = mainAudioBuf ? mainAudioBuf.duration : 0;
            }

            const effEnd = trimEnd > 0 ? Math.min(trimEnd, maxDur) : maxDur;
            const totalDuration = effEnd - trimStart;
            if (totalDuration <= 0) {
                alert('No valid audio range remaining.');
                return;
            }

            const totalSamples = Math.floor(totalDuration * sampleRate);
            const outputBuf = audioCtx.createBuffer(channels, totalSamples, sampleRate);

            // 1. Copy Track 1 (Main Track) for non-deleted clips bounded by trimStart & trimEnd
            if (mainAudioBuf) {
                for (let c = 0; c < channels; c++) {
                    const outData = outputBuf.getChannelData(c);
                    const srcData = mainAudioBuf.getChannelData(c);

                    for (const clip of activeMain) {
                        const clipStartSec = Math.max(clip.start, trimStart);
                        const clipEndSec = Math.min(clip.end, trimEnd > 0 ? trimEnd : maxDur);
                        if (clipStartSec >= clipEndSec) continue;

                        const sourceStartSec = clip.sourceStart !== undefined ? clip.sourceStart : clip.start;
                        const offsetFromClipStart = clipStartSec - clip.start;
                        const actualSrcStartSec = sourceStartSec + offsetFromClipStart;

                        const clipDurationSec = clipEndSec - clipStartSec;
                        const clipSamplesCount = Math.floor(clipDurationSec * sampleRate);
                        const srcStartSamp = Math.floor(actualSrcStartSec * sampleRate);

                        for (let i = 0; i < clipSamplesCount; i++) {
                            const timelineSec = clipStartSec + (i / sampleRate);
                            const targetIdx = Math.floor((timelineSec - trimStart) * sampleRate);
                            const srcIdx = srcStartSamp + i;

                            // Explicitly check if timelineSec falls in any active Voice-Over clip region
                            const isMutedByVO = activeVO.some(vo => timelineSec >= vo.start && timelineSec <= vo.end);

                            if (targetIdx >= 0 && targetIdx < totalSamples) {
                                if (isMutedByVO) {
                                    outData[targetIdx] = 0; // Mute Track 1 Audio completely during Voice-Over
                                } else if (srcIdx >= 0 && srcIdx < srcData.length) {
                                    outData[targetIdx] = srcData[srcIdx];
                                }
                            }
                        }
                    }
                }
            }

            // 2. Auto-Mute Track 1 & Mix Track 2 (Voice-Over Clips)
            for (const vo of activeVO) {
                if (!vo.buffer) continue;
                const voBuf = vo.buffer;
                const voStartSec = Math.max(vo.start, trimStart);
                const voEndSec = Math.min(vo.end, trimEnd > 0 ? trimEnd : maxDur);
                if (voStartSec >= voEndSec) continue;

                const voSourceStartSec = vo.sourceStart !== undefined ? vo.sourceStart : 0;
                const offsetFromClipStart = voStartSec - vo.start;
                const actualVoSrcStartSec = voSourceStartSec + offsetFromClipStart;

                const voDurationSec = voEndSec - voStartSec;
                const voSamplesCount = Math.floor(voDurationSec * sampleRate);
                const voSrcStartSamp = Math.floor(actualVoSrcStartSec * sampleRate);

                for (let c = 0; c < channels; c++) {
                    const outData = outputBuf.getChannelData(c);
                    const voData = voBuf.numberOfChannels > c ? voBuf.getChannelData(c) : voBuf.getChannelData(0);

                    for (let j = 0; j < voSamplesCount; j++) {
                        const timelineSec = voStartSec + (j / sampleRate);
                        const targetIdx = Math.floor((timelineSec - trimStart) * sampleRate);
                        const srcIdx = voSrcStartSamp + j;

                        if (targetIdx >= 0 && targetIdx < totalSamples && srcIdx >= 0 && srcIdx < voData.length) {
                            outData[targetIdx] = voData[srcIdx];
                        }
                    }
                }
            }

            const finalOggBlob = await audioBufferToOggBlob(outputBuf);
            setAudioBlob(finalOggBlob);
            if (audioPreviewUrl && audioPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(audioPreviewUrl);
            const newUrl = URL.createObjectURL(finalOggBlob);
            setAudioPreviewUrl(newUrl);

            if (audioElementRef.current) {
                audioElementRef.current.src = newUrl;
                audioElementRef.current.load();
                audioElementRef.current.currentTime = 0;
            }

            setAudioDuration(outputBuf.duration);
            setMainClips([{ id: `main-${Date.now()}`, track: 'main', name: 'Main Track', start: 0, end: outputBuf.duration }]);
            setVoiceoverClips([]);
            setTrimStart(0);
            setTrimEnd(outputBuf.duration);
            setSelectedClipId(null);
            alert('Multi-track audio successfully mixed & saved! Track 1 auto-muted during Voice-Over regions. Click "Save Product" below.');
        } catch (err) {
            console.error('Failed to mix audio tracks:', err);
            alert('Failed to mix & save audio.');
        }
    };



    // Smooth Mouse Down & Drag Playhead Scrubber for Timeline Track
    const handleTimelineMouseDown = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.trim-handle')) return;

        const updatePlayhead = (clientX: number) => {
            if (!timelineTrackRef.current || audioDuration <= 0) return;
            const rect = timelineTrackRef.current.getBoundingClientRect();
            const offsetX = Math.max(0, Math.min(clientX - rect.left, rect.width));
            const newTime = (offsetX / rect.width) * audioDuration;

            if (audioElementRef.current) {
                audioElementRef.current.currentTime = newTime;
            }
            setSeekTime(newTime);
        };

        updatePlayhead(e.clientX);

        const onMouseMove = (moveEvent: MouseEvent) => {
            updatePlayhead(moveEvent.clientX);
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const pauseRecording = () => {
        if (mediaRecorderRef.current && isRecording && !isPaused) {
            mediaRecorderRef.current.pause();
            setIsPaused(true);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
    };

    const resumeRecording = () => {
        if (mediaRecorderRef.current && isRecording && isPaused) {
            mediaRecorderRef.current.resume();
            setIsPaused(false);
            timerIntervalRef.current = window.setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        setIsPaused(false);
            setIsPaused(false);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            setVisualizerData(new Array(35).fill(30));
        }
    };

    const clearAudio = () => {
        if (audioPreviewUrl && audioPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(audioPreviewUrl);
        setAudioBlob(null);
        setAudioPreviewUrl(null);
        setRecordingTime(0);
        setSeekTime(0);
        setAudioDuration(0);
        prevAudioBlobRef.current = null;
        overwriteSeekRef.current = null;
        originalMainBlobRef.current = null;
    };

    const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            originalMainBlobRef.current = file;
            setAudioBlob(file);
            if (audioPreviewUrl && audioPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(audioPreviewUrl);
            setAudioPreviewUrl(URL.createObjectURL(file));
        }
    };

    // Reset Form
    const resetForm = () => {
        setFormData({
            title: '', brand: '', gender: 'men', color: '', size_original: '',
            starting_price: '', minimum_price: '', description: ''
        });
        productImages.forEach(img => { if (img.url.startsWith('blob:')) URL.revokeObjectURL(img.url); });
        if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(videoPreviewUrl);
        if (audioPreviewUrl && audioPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(audioPreviewUrl);

        setProductImages([]);
        setSelectedVideo(null);
        setVideoPreviewUrl(null);
        setAudioBlob(null);
        setAudioPreviewUrl(null);
        setEditingProduct(null);
        setActivePhase(1);
        setShowAddModal(false);
        setSeekTime(0);
        setAudioDuration(0);
        prevAudioBlobRef.current = null;
        overwriteSeekRef.current = null;
        setVisualizerData(new Array(35).fill(30));
    };

    // Open Edit Form (Parse main_image_url and extra_image_urls into productImages!)
    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            title: product.title,
            brand: product.brand || '',
            gender: product.gender,
            color: product.color || '',
            size_original: product.size_original || '',
            starting_price: product.starting_price?.toString() || '',
            minimum_price: product.minimum_price?.toString() || '',
            description: product.description || ''
        });

        // Parse existing main & extra images into productImages array
        const existingImages: ImageItem[] = [];
        if (product.main_image_url) {
            existingImages.push({
                id: `existing_main_${product.id}`,
                url: product.main_image_url,
                isExisting: true
            });
        }
        if (product.extra_image_urls) {
            try {
                const extras: string[] = JSON.parse(product.extra_image_urls);
                extras.forEach((url, i) => {
                    if (url && url !== product.main_image_url) {
                        existingImages.push({
                            id: `existing_extra_${product.id}_${i}`,
                            url,
                            isExisting: true
                        });
                    }
                });
            } catch (e) { /* ignore parse error */ }
        }
        setProductImages(existingImages);

        if (product.video_url) setVideoPreviewUrl(product.video_url);
        else setVideoPreviewUrl(null);

        if (product.voice_note_url as string) setAudioPreviewUrl(product.voice_note_url as string);
        else setAudioPreviewUrl(null);

        setActivePhase(1);
        setShowAddModal(true);
    };

    // Submit Product (preserving exact image sequence & uploads)
    const handleSubmit = async () => {
        if (!formData.title || !formData.starting_price || !formData.minimum_price) {
            alert('Please fill in title, starting price, and minimum price.');
            setActivePhase(1);
            return;
        }

        const fd = new FormData();
        fd.append('title', formData.title);
        fd.append('brand', formData.brand);
        fd.append('gender', formData.gender);
        fd.append('color', formData.color);
        fd.append('size_original', formData.size_original);
        fd.append('starting_price', formData.starting_price);
        fd.append('minimum_price', formData.minimum_price);
        fd.append('description', formData.description);

        // Build image_order structure for backend & append new files
        const imageOrder: { type: 'existing' | 'new', url?: string, index?: number }[] = [];
        let newFileCount = 0;

        productImages.forEach(img => {
            if (img.isExisting && img.url) {
                imageOrder.push({ type: 'existing', url: img.url });
            } else if (!img.isExisting && img.file) {
                fd.append('images', img.file);
                imageOrder.push({ type: 'new', index: newFileCount++ });
            }
        });

        fd.append('image_order', JSON.stringify(imageOrder));

        if (selectedVideo) {
            fd.append('video', selectedVideo);
        } else if (editingProduct && !videoPreviewUrl) {
            fd.append('clear_video', 'true');
        }
        
        if (audioBlob) {
            const fileName = audioBlob instanceof File ? audioBlob.name : `voice_${Date.now()}.ogg`;
            fd.append('voice_note', audioBlob, fileName);
        } else if (editingProduct && !audioPreviewUrl) {
            fd.append('clear_voice', 'true');
        }

        // Optimistic Product Insertion for immediate UI feedback
        const tempProduct: Product = {
            id: editingProduct ? editingProduct.id : -Math.floor(Math.random() * 1000000), // temp negative ID if new
            title: formData.title,
            brand: formData.brand,
            gender: formData.gender,
            color: formData.color,
            size_original: formData.size_original,
            starting_price: parseFloat(formData.starting_price) || 0,
            minimum_price: parseFloat(formData.minimum_price) || 0,
            description: formData.description,
            main_image_url: productImages[0]?.file ? URL.createObjectURL(productImages[0].file) : (productImages[0]?.url || null),
            extra_image_urls: "[]",
            video_url: selectedVideo ? URL.createObjectURL(selectedVideo) : null,
            voice_note_url: audioBlob ? URL.createObjectURL(audioBlob as Blob) : null,
            status: 'uploading' as any, // Custom status just for UI visualization
            created_at: new Date().toISOString()
        };

        if (editingProduct) {
            setProducts(prev => prev.map(p => p.id === tempProduct.id ? { ...p, ...tempProduct } : p));
        } else {
            setProducts(prev => [tempProduct, ...prev]);
        }

        // Immediately close the UI modal
        resetForm();

        const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
        const method = editingProduct ? 'PUT' : 'POST';

        // Background XHR
        const xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const resData = JSON.parse(xhr.responseText);
                    if (resData.success && resData.id && !editingProduct) {
                        // Replace temp negative ID with the real DB ID to enable immediate interactions
                        setProducts(prev => prev.map(p => p.id === tempProduct.id ? { ...p, id: resData.id } : p));
                    }
                } catch (e) { }
                fetchProducts(true); // Silent merge to preserve local blobs
            } else {
                alert(`Error saving product: ${formData.title}`);
                fetchProducts(); // Revert temp changes
            }
        };
        xhr.onerror = () => {
            alert(`Network error saving product: ${formData.title}`);
            fetchProducts();
        };
        xhr.send(fd);
    };

    // Delete Product
    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) fetchProducts();
        } catch (err) { alert('Failed to delete product.'); }
    };

    // Toggle Product Status (Available / Sold)
    const toggleStatus = async (product: Product) => {
        const newStatus = product.status === 'available' ? 'sold' : 'available';
        try {
            const fd = new FormData();
            fd.append('title', product.title);
            fd.append('starting_price', product.starting_price.toString());
            fd.append('minimum_price', product.minimum_price.toString());
            fd.append('status', newStatus);
            await fetch(`/api/products/${product.id}`, { method: 'PUT', body: fd });
            fetchProducts();
        } catch (err) { alert('Failed to update status.'); }
    };

    const formatTimer = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Get all image URLs for a product
    const getProductAllImages = (product: Product): string[] => {
        const list: string[] = [];
        if (product.main_image_url) list.push(product.main_image_url);
        if (product.extra_image_urls) {
            try {
                const extras = JSON.parse(product.extra_image_urls);
                if (Array.isArray(extras)) {
                    extras.forEach(url => {
                        if (url && !list.includes(url)) list.push(url);
                    });
                }
            } catch (e) { /* ignore */ }
        }
        return list;
    };

    return (
        <div className="fixed inset-0 h-[100dvh] w-full bg-[#030712] text-zinc-100 flex flex-col overflow-hidden font-sans selection:bg-indigo-500/30 overscroll-none">
            {/* ======================================= */}
            {/* ========== DESKTOP TOP NAV ============ */}
            {/* ======================================= */}
            <div className="hidden md:flex flex-col items-center justify-center pt-6 pb-2 bg-[#09090b] border-b border-white/5 shrink-0">
                <img src="/devsil-logo.png" alt="Devsil Logo" className="h-10 object-contain mb-2" />
                <h1 className="text-lg font-bold text-indigo-400 tracking-wide uppercase mb-6">Ecomerce Management System</h1>
                
                <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar w-full max-w-6xl px-4 justify-center">
                    {[
                        { id: 'products', label: 'Products', icon: Package },
                        { id: 'conversations', label: 'Live Chat', icon: MessageSquare },
                        { id: 'orders', label: 'Orders', icon: ShoppingCart },
                        { id: 'analytics', label: 'Analytics', icon: BarChart },
                        { id: 'policy', label: 'Policy Voices', icon: ShieldAlert },
                        { id: 'prerecorded', label: 'Pre-recorded', icon: Mic2 },
                        { id: 'ai-agent', label: 'AI Agent', icon: Sparkles }
                    ].map(tab => {
                        const isActive = subTab === tab.id || activeMobilePage === tab.id;
                        return (
                            <button 
                                key={tab.id}
                                onClick={() => { 
                                    setSubTab(tab.id as any); 
                                    setActiveMobilePage(tab.id as any === 'products' || tab.id as any === 'conversations' || tab.id as any === 'orders' ? 'main' : tab.id as any); 
                                }}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all ${
                                    isActive 
                                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' 
                                    : 'text-zinc-400 hover:bg-white/5 border border-transparent'
                                }`}
                            >
                                <tab.icon size={18} />
                                <span className="text-sm">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ======================================= */}
            {/* ========== MAIN CONTENT =============== */}
            {/* ======================================= */}
            <div className="flex-1 flex flex-col w-full relative bg-[#030712] overflow-hidden">
                
                {/* 1) MAIN TABS SCREEN */}
                {activeMobilePage === 'main' && (
                    <div className="flex flex-col h-full w-full absolute inset-0 animate-in fade-in duration-200">
                        {/* Mobile Header (Hidden on Desktop) */}
                        <div className="md:hidden pt-2 bg-[#09090b]/95 backdrop-blur-xl border-b border-white/5 shrink-0 z-50">
                            {subTab === 'products' && (
                                <div className="px-4 py-3 flex items-center justify-between gap-3">
                                    <h1 className="text-xl font-bold tracking-tight text-white">Catalog</h1>
                                    <div className="flex-1 flex justify-end">
                                        <div className="relative w-full max-w-[200px]">
                                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                            <input type="text" placeholder="Search products..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-[#18181b] text-sm text-white rounded-full pl-9 pr-4 py-2 w-full outline-none border border-white/5 focus:border-indigo-500/50 transition-all" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Feed */}
                        <div className="flex-1 overflow-y-auto pb-[85px] md:pb-6 pt-4 px-4 w-full max-w-6xl mx-auto custom-scrollbar">
                            {subTab === 'products' && (
                                <div className="flex flex-col w-full h-full">
                                    {/* Desktop Toolbar (Hidden on Mobile) */}
                                    <div className="hidden md:flex justify-center items-center mb-8 w-full relative">
                                        <div className="relative w-full max-w-xl">
                                            <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" />
                                            <input 
                                                type="text" 
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                placeholder="Search products..." 
                                                className="pl-14 pr-4 py-3.5 rounded-2xl bg-[#18181b] border border-white/5 text-base text-white focus:outline-none focus:border-indigo-500/50 w-full transition-all shadow-xl"
                                            />
                                        </div>
                                        {/* View Toggle */}
                                        <div className="absolute right-0 flex bg-[#18181b] border border-white/5 rounded-xl p-1 shadow-lg">
                                            <button onClick={() => setViewMode('grid')} className={`p-2.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                                <LayoutGrid size={20} />
                                            </button>
                                            <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                                <List size={20} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "flex flex-col gap-4"}>
                                    {loading ? (
                                        <div className="flex items-center justify-center h-32 col-span-full"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div></div>
                                    ) : products.length === 0 ? (
                                        <div className="text-center text-zinc-500 py-10 text-sm col-span-full">No products listed. Tap + to add.</div>
                                    ) : (
                                        (() => {
                                            const filteredProducts = products.filter(p => p.title?.toLowerCase().includes(searchQuery.toLowerCase()) || p.brand?.toLowerCase().includes(searchQuery.toLowerCase()));
                                            if (filteredProducts.length === 0) {
                                                return <div className="text-center text-zinc-500 py-10 text-sm col-span-full">No products match your search.</div>;
                                            }
                                            return filteredProducts.map(product => {
                                                const allImages = getProductAllImages(product);
                                                const currentImgUrl = allImages[0] || product.main_image_url;
                                                const isGrid = viewMode === 'grid';
                                                return (
                                                    <div key={product.id} className={`group bg-[#09090b] border border-white/5 hover:border-white/10 rounded-3xl overflow-hidden shadow-xl transition-all hover:-translate-y-1 hover:shadow-indigo-500/10 ${isGrid ? 'flex flex-col' : 'flex flex-row p-4 gap-6 items-center'}`}>
                                                        
                                                        {/* Media Section */}
                                                        <div className={`relative bg-[#18181b] overflow-hidden ${isGrid ? 'aspect-square w-full' : 'w-32 h-32 md:w-40 md:h-40 rounded-2xl shrink-0'}`}>
                                                            {currentImgUrl ? (
                                                                <img src={currentImgUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <Camera size={32} className="text-zinc-700" />
                                                                </div>
                                                            )}
                                                            {/* Overlay Badges on Image */}
                                                            <div className="absolute top-3 left-3 flex gap-2">
                                                                {product.brand && <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-bold text-white shadow-sm border border-white/10 uppercase tracking-wider">{product.brand}</span>}
                                                            </div>
                                                        </div>

                                                        {/* Info Section */}
                                                        <div className={`flex flex-col flex-1 h-full justify-between ${isGrid ? 'p-5' : 'py-2'}`}>
                                                            <div>
                                                                <div className="flex justify-between items-start gap-4 mb-2">
                                                                    <h4 className="font-bold text-zinc-100 text-base md:text-lg leading-tight line-clamp-2 group-hover:text-indigo-400 transition-colors">{product.title}</h4>
                                                                    <span className="text-lg md:text-2xl font-black text-white shrink-0 tracking-tight">Rs {product.starting_price}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm text-zinc-500 font-medium flex-wrap">
                                                                    {product.gender && <span>{product.gender}</span>}
                                                                    {product.gender && product.size_original && <span className="w-1 h-1 rounded-full bg-zinc-600"></span>}
                                                                    {product.size_original && <span>Size {product.size_original}</span>}
                                                                    {(product.gender || product.size_original) && product.color && <span className="w-1 h-1 rounded-full bg-zinc-600"></span>}
                                                                    {product.color && <span>{product.color}</span>}
                                                                </div>
                                                                {product.description && !isGrid && (
                                                                    <p className="mt-3 text-zinc-400 text-sm line-clamp-2 leading-relaxed hidden md:block">{product.description}</p>
                                                                )}
                                                            </div>

                                                            {/* Actions Section */}
                                                            <div className={`flex items-center gap-2 mt-4 pt-4 border-t border-white/5 ${isGrid ? 'w-full' : ''}`}>
                                                                {product.voice_note_url && (
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setActiveMediaPreview({ type: 'audio', url: product.voice_note_url as string, title: product.title });
                                                                        }}
                                                                        className={`flex-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-colors border border-indigo-500/10 ${!isGrid && 'px-4 flex-none'}`}
                                                                    >
                                                                        <Volume2 size={16} /> <span className={!isGrid ? 'hidden lg:inline' : ''}>Play Voice</span>
                                                                    </button>
                                                                )}
                                                                {product.video_url && (
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setActiveMediaPreview({ type: 'video', url: product.video_url as string, title: product.title });
                                                                        }}
                                                                        className={`flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-colors border border-emerald-500/10 ${!isGrid && 'px-4 flex-none'}`}
                                                                    >
                                                                        <Video size={16} /> <span className={!isGrid ? 'hidden lg:inline' : ''}>View Video</span>
                                                                    </button>
                                                                )}
                                                                <div className="flex gap-2 ml-auto">
                                                                    <button 
                                                                        onClick={() => { handleEdit(product); setActiveMobilePage('add-product'); }}
                                                                        className="w-10 h-10 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl flex items-center justify-center transition-colors border border-white/5"
                                                                    >
                                                                        <Edit3 size={16} />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleDelete(product.id)}
                                                                        className="w-10 h-10 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl flex items-center justify-center transition-colors border border-red-500/10"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()
                                    )}
                                </div>
                                </div>
                            )}

                            {subTab === 'conversations' && <LiveConversations />}
                            {subTab === 'orders' && <OrdersPage />}
                        </div>

                        {/* Mobile & Desktop FAB Container */}
                        {subTab === 'products' && (
                            <div className="fixed bottom-[85px] md:bottom-8 left-0 right-0 pointer-events-none z-40 flex justify-center px-4">
                                <div className="w-full max-w-6xl flex justify-end relative">
                                    <button 
                                        onClick={() => { resetForm(); setActiveMobilePage('add-product'); }}
                                        className="pointer-events-auto w-14 h-14 bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-[0_8px_30px_rgb(99,102,241,0.4)] hover:scale-105 active:scale-95 transition-transform"
                                    >
                                        <Plus size={28} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* iOS Bottom Navigation (Hidden on Desktop) */}
                        <div className="md:hidden fixed bottom-0 left-0 right-0 h-[70px] bg-[#09090b]/95 backdrop-blur-xl border-t border-white/5 flex items-center justify-around z-50 px-2 pb-safe shadow-2xl">
                            {[
                                { id: 'products', icon: Package, label: 'Products' },
                                { id: 'conversations', icon: MessageSquare, label: 'Chat' },
                                { id: 'orders', icon: ShoppingCart, label: 'Orders' },
                                { id: 'more', icon: MoreHorizontal, label: 'More' }
                            ].map(tab => (
                                <button key={tab.id} onClick={() => { if(tab.id==='more') { setActiveMobilePage('more-menu'); } else { setSubTab(tab.id as any); } }} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 ${subTab === tab.id || (tab.id === 'more' && (activeMobilePage as any) === 'more-menu') ? 'text-white' : 'text-zinc-500'}`}>
                                    <tab.icon size={22} strokeWidth={subTab === tab.id ? 2.5 : 2} />
                                    <span className="text-[10px] font-semibold">{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Desktop Global Content Pages (Like Analytics, Policy, etc) rendered when they are selected via Top Nav */}
                {['analytics', 'policy', 'prerecorded', 'ai-agent'].includes(activeMobilePage as string) && (
                    <div className="hidden md:block absolute inset-0 bg-[#030712] z-40">
                        <div className="flex-1 overflow-y-auto p-6 w-full max-w-6xl mx-auto h-full custom-scrollbar">
                            {(activeMobilePage as any) === 'analytics' && <AnalyticsPage />}
                            {(activeMobilePage as any) === 'policy' && <VoiceAssetsTab category="policy" title="Policy Voices" description="" />}
                            {(activeMobilePage as any) === 'prerecorded' && <PreRecordedVoicesTab title="Pre recorded voices" description="" />}
                            {(activeMobilePage as any) === 'ai-agent' && <AIAgentPanel />}
                        </div>
                    </div>
                )}

                {/* 2) MORE MENU SCREEN (Full Screen Independent View - Hidden on Desktop) */}
                {activeMobilePage === 'more-menu' && (
                    <div className="md:hidden flex flex-col h-full w-full absolute inset-0 bg-[#030712] z-50 animate-in slide-in-from-right duration-200">
                        <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center px-4 shrink-0 shadow-sm relative">
                            <button onClick={() => setActiveMobilePage('main')} className="absolute left-4 p-2 -m-2 text-indigo-400 active:opacity-50 flex items-center gap-1">
                                <ChevronLeft size={24} /> <span className="text-base font-semibold">Back</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <div className="bg-[#09090b] rounded-2xl border border-white/5 overflow-hidden">
                                {[
                                    { id: 'analytics', label: 'Analytics', icon: BarChart, color: 'text-blue-400' },
                                    { id: 'ai-agent', label: 'AI Agent Settings', icon: Sparkles, color: 'text-indigo-400' },
                                    { id: 'policy', label: 'Store Policies', icon: ShieldAlert, color: 'text-amber-400' },
                                    { id: 'prerecorded', label: 'Voice Assets', icon: Mic2, color: 'text-emerald-400' }
                                ].map((item, idx) => (
                                    <button 
                                        key={item.id} 
                                        onClick={() => { setSubTab(item.id as any); setActiveMobilePage(item.id as any); }}
                                        className={`w-full flex items-center justify-between p-4 bg-[#09090b] active:bg-[#18181b] transition-colors ${idx !== 3 ? 'border-b border-white/5' : ''}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-xl bg-white/5 ${item.color}`}><item.icon size={20} /></div>
                                            <span className="font-semibold text-zinc-100 text-base">{item.label}</span>
                                        </div>
                                        <ChevronRight size={20} className="text-zinc-600" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 3) SUB-SCREENS (Like Policy, AI Agent) from More Menu */}
                {['analytics', 'ai-agent', 'policy', 'prerecorded'].includes(activeMobilePage as string) && (
                    <div className="md:hidden flex flex-col h-full w-full absolute inset-0 bg-[#030712] z-[60] animate-in slide-in-from-right duration-200">
                        <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center px-4 shrink-0 shadow-sm relative">
                            <button onClick={() => setActiveMobilePage('more-menu')} className="absolute left-4 p-2 -m-2 text-indigo-400 active:opacity-50 flex items-center gap-1 z-10">
                                <ChevronLeft size={24} />
                            </button>
                            <h1 className="text-lg font-bold tracking-tight text-white capitalize w-full text-center">
                                {activeMobilePage === 'policy' ? 'Policy Voices' : 
                                 activeMobilePage === 'prerecorded' ? 'Pre-Recorded Voices' :
                                 (activeMobilePage as string).replace('-', ' ')}
                            </h1>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {(activeMobilePage as any) === 'analytics' && <AnalyticsPage />}
                            {(activeMobilePage as any) === 'policy' && <VoiceAssetsTab category="policy" title="Policy Voices" description="" />}
                            {(activeMobilePage as any) === 'prerecorded' && <PreRecordedVoicesTab title="Pre recorded voices" description="" />}
                            {(activeMobilePage as any) === 'ai-agent' && <AIAgentPanel />}
                        </div>
                    </div>
                )}

                {/* 4) ADD PRODUCT MOBILE NATIVE SCREEN (Stack Navigation) */}
                {activeMobilePage === 'add-product' && (
                    <div className="md:hidden flex flex-col h-full w-full absolute inset-0 bg-[#030712] md:bg-black/80 z-[70] animate-in slide-in-from-right duration-200 md:items-center md:pt-10">
                        <div className="w-full h-full md:h-[80vh] md:max-w-xl flex flex-col bg-[#030712] md:border md:border-white/10 md:rounded-3xl md:shadow-2xl md:overflow-hidden relative">
                            <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center px-4 shrink-0 shadow-sm relative">
                                <button onClick={() => setActiveMobilePage('main')} className="absolute left-4 p-2 -m-2 text-indigo-400 active:opacity-50 flex items-center gap-1 z-10">
                                    <ChevronLeft size={24} /> <span className="text-base font-semibold">Cancel</span>
                                </button>
                                <h1 className="text-lg font-bold text-white w-full text-center">Add Product</h1>
                            </div>
                            <div className="flex-1 p-4 flex flex-col gap-4 bg-[#030712]">
                            <button onClick={() => setActiveMobilePage('add-product-text')} className="flex items-center justify-between bg-[#18181b] p-4 rounded-2xl border border-white/5 active:scale-95 transition-transform shadow-lg">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl"><FileText size={24} /></div>
                                    <div className="text-left">
                                        <h3 className="font-bold text-white text-base">Text Details</h3>
                                        <p className="text-xs text-zinc-500">Title, price, size, brand</p>
                                    </div>
                                </div>
                                <ChevronRight size={20} className="text-zinc-600" />
                            </button>
                            <button onClick={() => setActiveMobilePage('add-product-media')} className="flex items-center justify-between bg-[#18181b] p-4 rounded-2xl border border-white/5 active:scale-95 transition-transform shadow-lg">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl"><ImageIcon size={24} /></div>
                                    <div className="text-left">
                                        <h3 className="font-bold text-white text-base">Media Upload</h3>
                                        <p className="text-xs text-zinc-500">Photos and videos</p>
                                    </div>
                                </div>
                                <ChevronRight size={20} className="text-zinc-600" />
                            </button>
                            <button onClick={() => setActiveMobilePage('add-product-voice')} className="flex items-center justify-between bg-[#18181b] p-4 rounded-2xl border border-white/5 active:scale-95 transition-transform shadow-lg">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl"><Mic size={24} /></div>
                                    <div className="text-left">
                                        <h3 className="font-bold text-white text-base">Voice Record</h3>
                                        <p className="text-xs text-zinc-500">Advanced voice note editing</p>
                                    </div>
                                </div>
                                <ChevronRight size={20} className="text-zinc-600" />
                            </button>
                        </div>
                        </div>
                    </div>
                )}

                {activeMobilePage === 'add-product-text' && (
                    <div className="md:hidden flex flex-col h-full w-full absolute inset-0 bg-[#030712] md:bg-black/80 z-[80] animate-in slide-in-from-right duration-200 md:items-center md:pt-10">
                        <div className="w-full h-full md:h-[80vh] md:max-w-xl flex flex-col bg-[#030712] md:border md:border-white/10 md:rounded-3xl md:shadow-2xl md:overflow-hidden relative">
                            <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center px-4 shrink-0 shadow-sm relative z-10">
                                <button onClick={() => setActiveMobilePage('add-product')} className="absolute left-4 p-2 -m-2 text-indigo-400 active:opacity-50 flex items-center gap-1 z-10">
                                    <ChevronLeft size={24} /> <span className="text-base font-semibold">Back</span>
                                </button>
                                <h1 className="text-lg font-bold text-white w-full text-center">Details</h1>
                                <button onClick={handleSubmit} disabled={loading} className="absolute right-4 p-2 -m-2 text-emerald-400 active:opacity-50 font-bold text-base z-10">
                                    {loading ? 'Saving' : 'Save'}
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 pb-12 space-y-6 custom-scrollbar">
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest pl-2">Basic Info</label>
                                <div className="bg-[#18181b] rounded-2xl overflow-hidden border border-white/5">
                                    <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-transparent border-b border-white/5 px-4 py-4 text-base text-white outline-none" placeholder="Product Title" />
                                    <input type="number" value={formData.starting_price} onChange={e => setFormData({ ...formData, starting_price: e.target.value })} className="w-full bg-transparent border-b border-white/5 px-4 py-4 text-base text-white outline-none" placeholder="Starting Price (Rs)" />
                                    <input type="number" value={formData.minimum_price} onChange={e => setFormData({ ...formData, minimum_price: e.target.value })} className="w-full bg-transparent border-b border-white/5 px-4 py-4 text-base text-white outline-none" placeholder="Minimum Price (Rs)" />
                                    <input type="text" value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} className="w-full bg-transparent px-4 py-4 text-base text-white outline-none" placeholder="Brand Name" />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest pl-2">Details</label>
                                <div className="bg-[#18181b] rounded-2xl overflow-hidden border border-white/5">
                                    <select value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })} className="w-full bg-transparent border-b border-white/5 px-4 py-4 text-base text-white outline-none appearance-none">
                                        <option value="men">Men</option>
                                        <option value="women">Women</option>
                                        <option value="unisex">Unisex</option>
                                        <option value="kids">Kids</option>
                                    </select>
                                    <input type="text" value={formData.size_original} onChange={e => setFormData({ ...formData, size_original: e.target.value })} className="w-full bg-transparent border-b border-white/5 px-4 py-4 text-base text-white outline-none" placeholder="Size" />
                                    <input type="text" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} className="w-full bg-transparent border-b border-white/5 px-4 py-4 text-base text-white outline-none" placeholder="Color" />
                                    <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} className="w-full bg-transparent px-4 py-4 text-base text-white outline-none resize-none" placeholder="Description / Condition" />
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>
                )}

                {activeMobilePage === 'add-product-media' && (
                    <div className="md:hidden flex flex-col h-full w-full absolute inset-0 bg-[#030712] md:bg-black/80 z-[80] animate-in slide-in-from-right duration-200 md:items-center md:pt-10">
                        <div className="w-full h-full md:h-[80vh] md:max-w-xl flex flex-col bg-[#030712] md:border md:border-white/10 md:rounded-3xl md:shadow-2xl md:overflow-hidden relative">
                            <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center px-4 shrink-0 shadow-sm relative z-10">
                                <button onClick={() => setActiveMobilePage('add-product')} className="absolute left-4 p-2 -m-2 text-indigo-400 active:opacity-50 flex items-center gap-1 z-10">
                                    <ChevronLeft size={24} /> <span className="text-base font-semibold">Back</span>
                                </button>
                                <h1 className="text-lg font-bold text-white w-full text-center">Media</h1>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar pb-12">
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest pl-2">Photos</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <input type="file" multiple accept="image/*" onChange={handleImageSelect} className="hidden" id="file-images-mob" />
                                        <label htmlFor="file-images-mob" className="flex items-center justify-center gap-3 h-16 bg-[#18181b] border border-white/5 rounded-2xl active:bg-white/5 transition-all cursor-pointer">
                                            <Camera size={20} className="text-zinc-400" />
                                            <span className="text-base font-semibold text-zinc-200">Add Photos</span>
                                        </label>
                                    </div>
                                    {productImages && productImages.length > 0 && productImages.map((img, i) => (
                                        <div key={i} className="aspect-square rounded-2xl bg-[#18181b] border border-white/10 overflow-hidden relative shadow-sm">
                                            <img src={img.url} className="w-full h-full object-cover" />
                                            <button onClick={() => setProductImages((prev) => prev.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur text-red-400 flex items-center justify-center">
                                                <Trash2 size={14} />
                                            </button>
                                            <div className="absolute bottom-2 left-2 right-2 flex justify-between">
                                                <button disabled={i === 0} onClick={() => {
                                                    const newArr = [...productImages];
                                                    const temp = newArr[i-1];
                                                    newArr[i-1] = newArr[i];
                                                    newArr[i] = temp;
                                                    setProductImages(newArr);
                                                }} className="w-8 h-8 rounded-full bg-black/60 backdrop-blur text-white flex items-center justify-center disabled:opacity-30">
                                                    <ChevronLeft size={14} />
                                                </button>
                                                <button disabled={i === productImages.length - 1} onClick={() => {
                                                    const newArr = [...productImages];
                                                    const temp = newArr[i+1];
                                                    newArr[i+1] = newArr[i];
                                                    newArr[i] = temp;
                                                    setProductImages(newArr);
                                                }} className="w-8 h-8 rounded-full bg-black/60 backdrop-blur text-white flex items-center justify-center disabled:opacity-30">
                                                    <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest pl-2">Video</label>
                                <input type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" id="file-video-mob" />
                                <label htmlFor="file-video-mob" className="flex items-center justify-center gap-3 h-16 bg-[#18181b] border border-white/5 rounded-2xl active:bg-white/5 transition-all cursor-pointer">
                                    <Video size={20} className="text-zinc-400" />
                                    <span className="text-base font-semibold text-zinc-200">{selectedVideo ? 'Video Selected' : 'Add Video'}</span>
                                </label>
                                {selectedVideo && (
                                    <div className="relative mt-2 rounded-2xl overflow-hidden border border-white/10">
                                        <video src={URL.createObjectURL(selectedVideo)} className="w-full h-auto" controls />
                                        <button onClick={() => setSelectedVideo(null)} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur text-red-400 flex items-center justify-center z-10">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        </div>
                    </div>
                )}

                {activeMobilePage === 'add-product-voice' && (
                    <div className="md:hidden flex flex-col h-full w-full absolute inset-0 bg-[#030712] md:bg-black/80 z-[80] animate-in slide-in-from-right duration-200 md:items-center md:pt-10">
                        <div className="w-full h-full md:h-[80vh] md:max-w-xl flex flex-col bg-[#030712] md:border md:border-white/10 md:rounded-3xl md:shadow-2xl md:overflow-hidden relative">
                            <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center px-4 shrink-0 shadow-sm relative z-10">
                                <button onClick={() => setActiveMobilePage('add-product')} className="absolute left-4 p-2 -m-2 text-indigo-400 active:opacity-50 flex items-center gap-1 z-10">
                                    <ChevronLeft size={24} /> <span className="text-base font-semibold">Back</span>
                                </button>
                                <h1 className="text-lg font-bold text-white w-full text-center">Voice Record</h1>
                            </div>
                            <div className="flex-1 p-6 flex flex-col items-center justify-center custom-scrollbar">
                            {audioPreviewUrl ? (
                                <div className="w-full flex flex-col items-center">
                                    <audio controls src={audioPreviewUrl} className="w-full mb-8 h-12" />
                                    <button 
                                        onClick={() => setActiveMobilePage('add-product-voice-edit')}
                                        className="bg-indigo-600 text-white w-full py-4 rounded-full font-bold shadow-lg shadow-indigo-900/30 active:scale-95 transition-all text-lg flex items-center justify-center gap-2 mb-3"
                                    >
                                        <Edit3 size={20} /> Advanced Edit
                                    </button>
                                    <button 
                                        onClick={handleTranscribe}
                                        className="bg-[#18181b] border border-white/10 text-white w-full py-4 rounded-full font-bold shadow-lg active:scale-95 transition-all text-lg flex items-center justify-center gap-2 mb-4"
                                    >
                                        <FileText size={20} className="text-emerald-400" /> Transcribe Voice
                                    </button>
                                    <button onClick={() => {setAudioBlob(null); setAudioPreviewUrl(null);}} className="text-red-400 font-bold p-4 active:opacity-50">
                                        Retake Audio
                                    </button>
                                </div>
                            ) : (
                                <div className="w-full flex flex-col items-center">
                                    <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-8 shadow-xl transition-all ${isRecording ? 'bg-red-500/20 shadow-red-500/20 scale-105' : 'bg-[#18181b]'}`}>
                                        <div className={`w-24 h-24 rounded-full flex items-center justify-center ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-[#27272a]'}`}>
                                            <Mic size={40} className="text-white" />
                                        </div>
                                    </div>
                                    {isRecording ? (
                                        <>
                                            <p className="text-3xl font-mono font-bold text-white mb-8">Recording...</p>
                                                                                        <div className="flex gap-4 w-full">
                                                {!isPaused ? (
                                                    <button onClick={pauseRecording} className="flex-1 bg-amber-500 text-white py-4 rounded-full font-bold text-lg active:scale-95 shadow-lg flex items-center justify-center gap-2">
                                                        <Pause size={20} /> Pause
                                                    </button>
                                                ) : (
                                                    <button onClick={resumeRecording} className="flex-1 bg-emerald-500 text-white py-4 rounded-full font-bold text-lg active:scale-95 shadow-lg flex items-center justify-center gap-2">
                                                        <Play size={20} /> Resume
                                                    </button>
                                                )}
                                                <button onClick={stopRecording} className="flex-1 bg-white text-black py-4 rounded-full font-bold text-lg active:scale-95 shadow-lg flex items-center justify-center gap-2">
                                                    <Square size={20} /> Stop
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-zinc-500 mb-8 font-medium">Tap to start speaking</p>
                                            <button onClick={startRecording} className="bg-indigo-600 text-white w-full py-4 rounded-full font-bold text-lg active:scale-95 shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2">
                                                <Play size={20} /> Start Recording
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        </div>
                    </div>
                )}

                {activeMobilePage === 'add-product-voice-edit' && (
                    <div className="md:hidden flex flex-col h-full w-full absolute inset-0 bg-[#030712] md:bg-black/80 z-[90] md:items-center md:pt-10">
                        <div className="w-full h-full md:h-[80vh] md:max-w-xl bg-[#030712] md:border md:border-white/10 md:rounded-3xl md:shadow-2xl relative overflow-hidden">
                            <MobileVoiceEditor 
                                audioBlob={audioBlob} 
                                onCancel={() => setActiveMobilePage('add-product-voice')} 
                                onSave={(blob) => { setAudioBlob(blob); setAudioPreviewUrl(URL.createObjectURL(blob)); setActiveMobilePage('add-product-voice'); }} 
                            />
                        </div>
                    </div>
                )}

                {activeMobilePage === 'add-product-voice-transcribe' && (
                    <div className="md:hidden flex flex-col h-full w-full absolute inset-0 bg-[#030712] md:bg-black/80 z-[100] animate-in slide-in-from-bottom-2 duration-200 md:items-center md:pt-10">
                        <div className="w-full h-full md:h-[80vh] md:max-w-xl flex flex-col bg-[#030712] md:border md:border-white/10 md:rounded-3xl md:shadow-2xl md:overflow-hidden relative">
                            <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center px-4 shrink-0 shadow-sm relative z-10">
                                <button onClick={() => setActiveMobilePage('add-product-voice')} className="absolute left-4 p-2 -m-2 text-emerald-400 active:opacity-50 flex items-center gap-1 z-10">
                                    <ChevronLeft size={24} /> <span className="text-base font-semibold">Back</span>
                                </button>
                                <h1 className="text-lg font-bold text-white w-full text-center">Transcription</h1>
                                <button onClick={() => setActiveMobilePage('add-product-voice')} className="absolute right-4 p-2 -m-2 text-indigo-400 font-bold active:opacity-50 z-10">
                                Save
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
                            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-emerald-900/20">
                                {isTranscribing ? <Loader2 size={40} className="text-emerald-400 animate-spin" /> : <FileText size={40} className="text-emerald-400" />}
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">{isTranscribing ? "Transcribing audio..." : "Voice to Text"}</h2>
                            
                            <div className="w-full bg-[#18181b] rounded-3xl p-1 border border-white/10 shadow-inner relative group mt-8">
                                <textarea 
                                    value={transcriptionText} 
                                    onChange={e => setTranscriptionText(e.target.value)}
                                    disabled={isTranscribing}
                                    className="w-full h-64 bg-transparent text-white text-lg p-5 outline-none resize-none leading-relaxed font-medium disabled:opacity-50"
                                    placeholder={isTranscribing ? "Processing audio..." : "Transcription will appear here..."}
                                />
                                {!isTranscribing && (
                                    <div className="absolute top-4 right-4 opacity-30 group-focus-within:opacity-100 transition-opacity">
                                        <Edit3 size={20} className="text-indigo-400" />
                                    </div>
                                )}
                            </div>
                            {!isTranscribing && (
                                <p className="text-xs text-zinc-600 mt-4 font-semibold uppercase tracking-widest flex items-center gap-1">
                                    <CheckCircle size={12} className="text-emerald-500" /> Auto-saving enabled
                                </p>
                            )}
                        </div>
                        </div>
                    </div>
                )}

                {/* 5) DESKTOP ADD PRODUCT SCREEN */}
                {activeMobilePage.startsWith('add-product') && (
                    <div className="hidden md:flex w-full h-full absolute inset-0 bg-[#030712] z-50 justify-center">
                        <div className="flex flex-row w-full max-w-6xl h-full border-x border-white/5">
                            {/* Left Side Panel */}
                        <div className="w-64 border-r border-white/5 bg-[#09090b] flex flex-col p-6 shrink-0 shadow-xl z-10">
                            <div className="mb-8">
                                <button onClick={() => { setActiveMobilePage('main'); resetForm(); }} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors font-semibold mb-6">
                                    <ChevronLeft size={18} /> Back
                                </button>
                                <h2 className="text-xl font-bold text-white tracking-tight">Add Product</h2>
                            </div>
                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={() => setActiveMobilePage('add-product-text')} 
                                    className={`flex items-center px-4 py-3 rounded-xl transition-all font-semibold ${activeMobilePage === 'add-product' || activeMobilePage === 'add-product-text' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}
                                >
                                    Text Details
                                </button>
                                <button 
                                    onClick={() => setActiveMobilePage('add-product-media')} 
                                    className={`flex items-center px-4 py-3 rounded-xl transition-all font-semibold ${activeMobilePage === 'add-product-media' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}
                                >
                                    Media Upload
                                </button>
                                <button 
                                    onClick={() => setActiveMobilePage('add-product-voice')} 
                                    className={`flex items-center px-4 py-3 rounded-xl transition-all font-semibold ${activeMobilePage.startsWith('add-product-voice') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}
                                >
                                    Voice Record
                                </button>
                            </div>
                        </div>

                        {/* Main Content Area */}
                        <div className="flex-1 flex flex-col relative overflow-hidden bg-[#030712]">
                            <div className="h-20 border-b border-white/5 flex items-center justify-between px-10 bg-[#09090b]/40 shrink-0">
                                <h3 className="text-xl font-bold text-white">
                                    {activeMobilePage === 'add-product' || activeMobilePage === 'add-product-text' ? 'Product Details' :
                                     activeMobilePage === 'add-product-media' ? 'Media Upload' : 'Voice Note'}
                                </h3>
                                <button onClick={handleSubmit} disabled={loading} className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2">
                                    {loading ? <Loader2 size={18} className="animate-spin"/> : null}
                                    {loading ? 'Saving...' : 'Save Product'}
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                                <div className="max-w-5xl mx-auto space-y-8 pb-20">
                                    {/* Text Details Tab */}
                                    {(activeMobilePage === 'add-product' || activeMobilePage === 'add-product-text') && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                            <div className="space-y-4">
                                                <label className="block text-sm font-bold text-zinc-500 uppercase tracking-widest pl-2">Basic Info</label>
                                                <div className="bg-[#18181b] rounded-2xl overflow-hidden border border-white/5 shadow-xl h-full flex flex-col">
                                                    <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-transparent border-b border-white/5 px-6 py-5 text-lg text-white outline-none focus:bg-white/5 transition-colors" placeholder="Product Title" />
                                                    <input type="text" value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} className="w-full bg-transparent border-b border-white/5 px-6 py-5 text-lg text-white outline-none focus:bg-white/5 transition-colors" placeholder="Brand Name" />
                                                    <div className="flex border-b border-white/5">
                                                        <input type="number" value={formData.starting_price} onChange={e => setFormData({ ...formData, starting_price: e.target.value })} className="w-1/2 bg-transparent border-r border-white/5 px-6 py-5 text-lg text-white outline-none focus:bg-white/5 transition-colors" placeholder="Starting Price (Rs)" />
                                                        <input type="number" value={formData.minimum_price} onChange={e => setFormData({ ...formData, minimum_price: e.target.value })} className="w-1/2 bg-transparent px-6 py-5 text-lg text-white outline-none focus:bg-white/5 transition-colors" placeholder="Minimum Price (Rs)" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <label className="block text-sm font-bold text-zinc-500 uppercase tracking-widest pl-2">Details</label>
                                                <div className="bg-[#18181b] rounded-2xl overflow-hidden border border-white/5 shadow-xl h-full flex flex-col">
                                                    <div className="flex border-b border-white/5">
                                                        <select value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })} className="w-1/3 bg-transparent border-r border-white/5 px-6 py-5 text-lg text-white outline-none appearance-none focus:bg-white/5 transition-colors cursor-pointer">
                                                            <option value="men" className="bg-[#18181b]">Men</option>
                                                            <option value="women" className="bg-[#18181b]">Women</option>
                                                            <option value="unisex" className="bg-[#18181b]">Unisex</option>
                                                            <option value="kids" className="bg-[#18181b]">Kids</option>
                                                        </select>
                                                        <input type="text" value={formData.size_original} onChange={e => setFormData({ ...formData, size_original: e.target.value })} className="w-1/3 bg-transparent border-r border-white/5 px-6 py-5 text-lg text-white outline-none focus:bg-white/5 transition-colors" placeholder="Size" />
                                                        <input type="text" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} className="w-1/3 bg-transparent px-6 py-5 text-lg text-white outline-none focus:bg-white/5 transition-colors" placeholder="Color" />
                                                    </div>
                                                    <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full flex-1 min-h-[140px] bg-transparent px-6 py-5 text-lg text-white outline-none resize-none focus:bg-white/5 transition-colors" placeholder="Description / Condition" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Media Upload Tab */}
                                    {activeMobilePage === 'add-product-media' && (
                                        <>
                                            <div className="space-y-4">
                                                <label className="block text-sm font-bold text-zinc-500 uppercase tracking-widest pl-2">Photos</label>
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div className="col-span-3">
                                                        <input type="file" multiple accept="image/*" onChange={handleImageSelect} className="hidden" id="file-images-desk" />
                                                        <label htmlFor="file-images-desk" className="flex flex-col items-center justify-center gap-3 h-32 bg-[#18181b] border border-white/10 border-dashed rounded-2xl hover:bg-white/5 hover:border-indigo-500/50 transition-all cursor-pointer">
                                                            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-full"><Camera size={24} /></div>
                                                            <span className="text-lg font-bold text-zinc-300">Click to add photos</span>
                                                        </label>
                                                    </div>
                                                    {productImages && productImages.length > 0 && productImages.map((img, i) => (
                                                        <div key={i} className="aspect-square rounded-2xl bg-[#18181b] border border-white/10 overflow-hidden relative shadow-lg group">
                                                            <img src={img.url} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                                            <button onClick={() => setProductImages((prev) => prev.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Trash2 size={14} />
                                                            </button>
                                                            <div className="absolute bottom-2 left-2 right-2 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button disabled={i === 0} onClick={() => {
                                                                    const newArr = [...productImages];
                                                                    const temp = newArr[i-1];
                                                                    newArr[i-1] = newArr[i];
                                                                    newArr[i] = temp;
                                                                    setProductImages(newArr);
                                                                }} className="w-8 h-8 rounded-full bg-black/60 backdrop-blur text-white flex items-center justify-center disabled:opacity-30">
                                                                    <ChevronLeft size={14} />
                                                                </button>
                                                                <button disabled={i === productImages.length - 1} onClick={() => {
                                                                    const newArr = [...productImages];
                                                                    const temp = newArr[i+1];
                                                                    newArr[i+1] = newArr[i];
                                                                    newArr[i] = temp;
                                                                    setProductImages(newArr);
                                                                }} className="w-8 h-8 rounded-full bg-black/60 backdrop-blur text-white flex items-center justify-center disabled:opacity-30">
                                                                    <ChevronRight size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <label className="block text-sm font-bold text-zinc-500 uppercase tracking-widest pl-2">Video</label>
                                                <input type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" id="file-video-desk" />
                                                <label htmlFor="file-video-desk" className="flex flex-col items-center justify-center gap-3 h-32 bg-[#18181b] border border-white/10 border-dashed rounded-2xl hover:bg-white/5 hover:border-indigo-500/50 transition-all cursor-pointer">
                                                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-full"><Video size={24} /></div>
                                                    <span className="text-lg font-bold text-zinc-300">{selectedVideo ? 'Change Video' : 'Add Video'}</span>
                                                </label>
                                                {selectedVideo && (
                                                    <div className="relative mt-4 rounded-2xl overflow-hidden border border-white/10 shadow-xl group">
                                                        <video src={URL.createObjectURL(selectedVideo)} className="w-full h-auto max-h-[400px] object-cover" controls />
                                                        <button onClick={() => setSelectedVideo(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 backdrop-blur text-red-400 flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {/* Voice Record Tab */}
                                    {activeMobilePage === 'add-product-voice' && (
                                        <div className="flex flex-col items-center justify-center py-10">
                                            {audioPreviewUrl ? (
                                                <div className="w-full flex flex-col items-center max-w-md">
                                                    <CustomAudioPlayer src={audioPreviewUrl} className="w-full mb-10 h-14" />
                                                    <button 
                                                        onClick={() => setActiveMobilePage('add-product-voice-edit')}
                                                        className="bg-indigo-600 hover:bg-indigo-500 text-white w-full py-4 rounded-xl font-bold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all text-lg flex items-center justify-center gap-3 mb-4"
                                                    >
                                                        <Edit3 size={20} /> Advanced Edit
                                                    </button>
                                                    <button 
                                                        onClick={handleTranscribe}
                                                        className="bg-[#18181b] hover:bg-white/5 border border-white/10 text-white w-full py-4 rounded-xl font-bold shadow-lg active:scale-95 transition-all text-lg flex items-center justify-center gap-3 mb-6"
                                                    >
                                                        <FileText size={20} className="text-emerald-400" /> Transcribe Voice
                                                    </button>
                                                    <button onClick={() => {setAudioBlob(null); setAudioPreviewUrl(null);}} className="text-red-400 hover:text-red-300 font-bold p-4 transition-colors">
                                                        Discard & Retake
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-full flex flex-col items-center max-w-md">
                                                    <div className={`w-40 h-40 rounded-full flex items-center justify-center mb-10 shadow-2xl transition-all ${isRecording ? 'bg-red-500/20 shadow-red-500/20 scale-105' : 'bg-[#18181b]'}`}>
                                                        <div className={`w-32 h-32 rounded-full flex items-center justify-center ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-[#27272a]'}`}>
                                                            <Mic size={50} className="text-white" />
                                                        </div>
                                                    </div>
                                                    {isRecording ? (
                                                        <>
                                                            <p className="text-4xl font-mono font-bold text-white mb-10">Recording...</p>
                                                            <div className="flex gap-4 w-full">
                                                                {!isPaused ? (
                                                                    <button onClick={pauseRecording} className="flex-1 bg-amber-500 hover:bg-amber-400 text-white py-4 rounded-xl font-bold text-lg active:scale-95 shadow-lg flex items-center justify-center gap-2 transition-colors">
                                                                        <Pause size={20} /> Pause
                                                                    </button>
                                                                ) : (
                                                                    <button onClick={resumeRecording} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white py-4 rounded-xl font-bold text-lg active:scale-95 shadow-lg flex items-center justify-center gap-2 transition-colors">
                                                                        <Play size={20} /> Resume
                                                                    </button>
                                                                )}
                                                                <button onClick={stopRecording} className="flex-1 bg-white hover:bg-zinc-200 text-black py-4 rounded-xl font-bold text-lg active:scale-95 shadow-lg flex items-center justify-center gap-2 transition-colors">
                                                                    <Square size={20} /> Stop
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="text-zinc-400 text-lg mb-10 font-medium">Click to start speaking</p>
                                                            <button onClick={startRecording} className="bg-indigo-600 hover:bg-indigo-500 text-white w-full py-5 rounded-xl font-bold text-xl active:scale-95 shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-3 transition-all">
                                                                <Play size={24} /> Start Recording
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Voice Advanced Edit Tab */}
                                    {activeMobilePage === 'add-product-voice-edit' && (
                                        <div className="w-full bg-[#18181b] border border-white/10 rounded-3xl shadow-2xl relative overflow-hidden h-[600px]">
                                            <MobileVoiceEditor 
                                                audioBlob={audioBlob} 
                                                onCancel={() => setActiveMobilePage('add-product-voice')} 
                                                onSave={(blob) => { setAudioBlob(blob); setAudioPreviewUrl(URL.createObjectURL(blob)); setActiveMobilePage('add-product-voice'); }} 
                                            />
                                        </div>
                                    )}

                                    {/* Voice Transcribe Tab */}
                                    {activeMobilePage === 'add-product-voice-transcribe' && (
                                        <div className="flex flex-col items-center max-w-2xl mx-auto py-10">
                                            <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-8 shadow-xl shadow-emerald-900/20">
                                                {isTranscribing ? <Loader2 size={48} className="text-emerald-400 animate-spin" /> : <FileText size={48} className="text-emerald-400" />}
                                            </div>
                                            <h2 className="text-2xl font-bold text-white mb-10">{isTranscribing ? "Transcribing audio..." : "Voice to Text"}</h2>
                                            
                                            <div className="w-full bg-[#18181b] rounded-3xl p-1 border border-white/10 shadow-inner relative group">
                                                <textarea 
                                                    value={transcriptionText} 
                                                    onChange={e => setTranscriptionText(e.target.value)}
                                                    disabled={isTranscribing}
                                                    className="w-full h-80 bg-transparent text-white text-xl p-8 outline-none resize-none leading-relaxed font-medium disabled:opacity-50"
                                                    placeholder={isTranscribing ? "Processing audio..." : "Transcription will appear here..."}
                                                />
                                                {!isTranscribing && (
                                                    <div className="absolute top-6 right-6 opacity-30 group-focus-within:opacity-100 transition-opacity">
                                                        <Edit3 size={24} className="text-indigo-400" />
                                                    </div>
                                                )}
                                            </div>
                                            {!isTranscribing && (
                                                <p className="text-sm text-zinc-500 mt-6 font-semibold uppercase tracking-widest flex items-center gap-2">
                                                    <CheckCircle size={16} className="text-emerald-500" /> Auto-saving enabled
                                                </p>
                                            )}
                                            <div className="w-full flex justify-between mt-10 border-t border-white/5 pt-10">
                                                <button onClick={() => setActiveMobilePage('add-product-voice')} className="text-zinc-400 hover:text-white font-bold transition-colors">
                                                    Back to Voice
                                                </button>
                                                <button onClick={() => setActiveMobilePage('add-product-voice')} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all">
                                                    Save Transcription
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>
                    </div>
                    </div>
                )}

            </div>

            {/* Global Media Preview */}
            {activeMediaPreview && (
                <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4" onClick={() => setActiveMediaPreview(null)}>
                    <div className="bg-[#09090b] border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#18181b]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-300 shadow-inner border border-white/10">
                                    {activeMediaPreview.type === 'video' ? <Video size={20} /> : <Volume2 size={20} />}
                                </div>
                                <h3 className="text-xl font-bold text-white truncate max-w-md">{activeMediaPreview.title || 'Media Preview'}</h3>
                            </div>
                            <button onClick={() => setActiveMediaPreview(null)} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-all shrink-0 active:scale-95 shadow-sm">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 bg-black/40 flex items-center justify-center p-6 md:p-10 relative">
                            {activeMediaPreview.type === 'video' ? (
                                <video src={activeMediaPreview.url} controls autoPlay className="w-full max-h-[60vh] rounded-2xl object-contain shadow-2xl ring-1 ring-white/10" />
                            ) : (
                                <div className="text-center space-y-6 w-full flex flex-col items-center justify-center py-12">
                                    <div className="w-32 h-32 rounded-full bg-indigo-500/10 flex items-center justify-center shadow-[0_0_60px_rgba(99,102,241,0.15)] mb-4 animate-pulse">
                                        <Volume2 size={48} className="text-indigo-400" />
                                    </div>
                                    <CustomAudioPlayer src={activeMediaPreview.url} autoPlay className="w-full max-w-sm mx-auto h-12 shadow-xl ring-1 ring-white/5" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WhatsAppDashboard;
