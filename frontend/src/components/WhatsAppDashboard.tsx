import VoiceAssetsTab from './VoiceAssetsTab';
import AnalyticsPage from './AnalyticsPage';
import LiveConversations from './LiveConversations';
import OrdersPage from './OrdersPage';
import React, { useState, useEffect, useRef } from 'react';
import {
    Package,
    ShieldAlert,
    Mic2,
    MessageSquare,
    Settings,
    Plus,
    Trash2,
    Edit3,
    Camera,
    Video,
    Mic,
    ShoppingCart,
    BarChart,
    Square,
    Play,
    Pause,
    Volume2,
    CheckCircle,
    X,
    ChevronRight,
    ChevronLeft,
    FileText,
    Upload,
    Check,
    RotateCcw,
    Layers,
    Tag,
    Info,
    ArrowLeft,
    ArrowRight,
    Star,
    Scissors,
    Move,
    Shield,
    Sparkles,
    Copy,
    ZoomIn,
    ZoomOut,
    Minimize2,
    Menu
} from 'lucide-react';

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

// Convert Web Audio API AudioBuffer to WAV Blob
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    let channels: Float32Array[] = [];
    let sampleRate = buffer.sampleRate;
    let offset = 0;
    let pos = 0;

    function writeString(str: string) {
        for (let i = 0; i < str.length; i++) {
            out.setUint8(pos++, str.charCodeAt(i));
        }
    }

    function writeUint32(data: number) {
        out.setUint32(pos, data, true);
        pos += 4;
    }

    function writeUint16(data: number) {
        out.setUint16(pos, data, true);
        pos += 2;
    }

    writeString('RIFF');
    writeUint32(length - 8);
    writeString('WAVE');
    writeString('fmt ');
    writeUint32(16);
    writeUint16(1); // PCM
    writeUint16(numOfChan);
    writeUint32(sampleRate);
    writeUint32(sampleRate * 2 * numOfChan);
    writeUint16(numOfChan * 2);
    writeUint16(16); // 16-bit PCM
    writeString('data');
    writeUint32(length - pos - 4);

    for (let i = 0; i < buffer.numberOfChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    while (offset < buffer.length) {
        for (let i = 0; i < numOfChan; i++) {
            let sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (sample < 0 ? sample * 32768 : sample * 32767) | 0;
            out.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return new Blob([out], { type: 'audio/wav' });
}

const WhatsAppDashboard = () => {
    const [subTab, setSubTab] = useState<'products' | 'conversations' | 'policy' | 'prerecorded' | 'orders' | 'analytics'>('products');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
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
            mediaRecorderRef.current = new MediaRecorder(stream);
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

            const mixedWavBlob = audioBufferToWavBlob(outputBuf);
            if (audioPreviewUrl && audioPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(audioPreviewUrl);
            const newUrl = URL.createObjectURL(mixedWavBlob);
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

            const finalWavBlob = audioBufferToWavBlob(outputBuf);
            setAudioBlob(finalWavBlob);
            if (audioPreviewUrl && audioPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(audioPreviewUrl);
            const newUrl = URL.createObjectURL(finalWavBlob);
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

        if (product.voice_note_url) setAudioPreviewUrl(product.voice_note_url);
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

        if (selectedVideo) fd.append('video', selectedVideo);
        if (audioBlob) {
            const fileName = audioBlob instanceof File ? audioBlob.name : `voice_${Date.now()}.wav`;
            fd.append('voice_note', audioBlob, fileName);
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
        <div className="h-full w-full bg-[#071317] flex overflow-hidden">
            {/* Devsil Teal Sidebar */}
            <div className={`w-64 bg-[#0A181D] border-r border-teal-900/30 flex flex-col p-4 flex-shrink-0 transition-all duration-300 ${isSidebarOpen ? '' : '-ml-64'}`}>
                <nav className="flex flex-col space-y-1.5 mt-2">
                    <button
                        onClick={() => setSubTab('products')}
                        className={`text-left px-4 py-3 rounded-xl font-medium text-xs transition-all flex items-center gap-3 ${subTab === 'products' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30 font-semibold' : 'text-slate-400 hover:bg-teal-950/40 hover:text-slate-200'
                            }`}
                    >
                        <Package size={17} />
                        Products Catalog
                    </button>
                    <button
                        onClick={() => setSubTab('conversations')}
                        className={`text-left px-4 py-3 rounded-xl font-medium text-xs transition-all flex items-center gap-3 ${subTab === 'conversations' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30 font-semibold' : 'text-slate-400 hover:bg-teal-950/40 hover:text-slate-200'
                            }`}
                    >
                        <MessageSquare size={17} />
                        Live Conversations
                    </button>
                    <button
                        onClick={() => setSubTab('orders')}
                        className={`text-left px-4 py-3 rounded-xl font-medium text-xs transition-all flex items-center gap-3 ${subTab === 'orders' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30 font-semibold' : 'text-slate-400 hover:bg-teal-950/40 hover:text-slate-200'
                            }`}
                    >
                        <ShoppingCart size={17} />
                        Orders Manager
                    </button>
                    <button
                        onClick={() => setSubTab('analytics')}
                        className={`text-left px-4 py-3 rounded-xl font-medium text-xs transition-all flex items-center gap-3 ${subTab === 'analytics' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30 font-semibold' : 'text-slate-400 hover:bg-teal-950/40 hover:text-slate-200'
                            }`}
                    >
                        <BarChart size={17} />
                        Analytics
                    </button>
                    <button
                        onClick={() => setSubTab('policy')}
                        className={`text-left px-4 py-3 rounded-xl font-medium text-xs transition-all flex items-center gap-3 ${subTab === 'policy' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30 font-semibold' : 'text-slate-400 hover:bg-teal-950/40 hover:text-slate-200'}`}
                    >
                        <ShieldAlert size={17} />
                        Policy Voices
                    </button>
                    <button
                        onClick={() => setSubTab('prerecorded')}
                        className={`text-left px-4 py-3 rounded-xl font-medium text-xs transition-all flex items-center gap-3 ${subTab === 'prerecorded' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30 font-semibold' : 'text-slate-400 hover:bg-teal-950/40 hover:text-slate-200'}`}
                    >
                        <Mic2 size={17} />
                        Voice Assets
                    </button>
                </nav>

                {/* Dashboard Stats */}
                <div className="mt-auto pt-6 border-t border-teal-900/30 space-y-2.5">
                    <div className="bg-[#0D2128] rounded-xl p-3 border border-teal-900/30 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-semibold text-teal-400/80 uppercase tracking-wider">Total Products</p>
                            <p className="text-lg font-bold text-slate-100">{products.length}</p>
                        </div>
                        <Layers className="text-teal-500/60" size={18} />
                    </div>
                    <div className="bg-[#0D2128] rounded-xl p-3 border border-teal-900/30 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-semibold text-emerald-400/80 uppercase tracking-wider">Available</p>
                            <p className="text-lg font-bold text-emerald-400">{products.filter(p => p.status === 'available').length}</p>
                        </div>
                        <CheckCircle className="text-emerald-500/60" size={18} />
                    </div>
                    <div className="bg-[#0D2128] rounded-xl p-3 border border-teal-900/30 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider">Sold</p>
                            <p className="text-lg font-bold text-amber-400">{products.filter(p => p.status === 'sold').length}</p>
                        </div>
                        <Tag className="text-amber-500/60" size={18} />
                    </div>
                </div>
            </div>

            {/* Main Content Workspace */}
            <div className="flex-1 flex flex-col bg-[#071317] overflow-hidden">
                <div className="h-14 border-b border-teal-900/30 flex items-center px-4 shrink-0">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-teal-400 hover:text-white p-2 rounded-lg bg-teal-950/40 hover:bg-teal-900/60 transition-all cursor-pointer">
                        <Menu size={20} />
                    </button>
                </div>
                <div className="flex-1 p-8 overflow-auto">
                    {/* ===== PRODUCTS TAB ===== */}
                    {subTab === 'products' && (
                        <div>
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-teal-900/30">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-100 tracking-tight">Products Catalog</h3>
                                    <p className="text-slate-400 text-xs mt-1">Manage multi-image alignments, product videos, and punch-in audio notes for AI bot responses.</p>
                                </div>
                                <button
                                    onClick={() => { resetForm(); setShowAddModal(true); }}
                                    className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-lg shadow-teal-600/30 flex items-center gap-2"
                                >
                                    <Plus size={16} />
                                    Add New Product
                                </button>
                            </div>

                            {/* ===== MULTI-PHASE PRODUCT CREATION MODAL ===== */}
                            {showAddModal && (
                                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto pt-10 pb-10">
                                    <div className="bg-[#09181E] border border-teal-800/40 rounded-2xl w-full max-w-3xl flex flex-col max-h-[90vh] shadow-2xl relative">
                                        {/* Modal Header */}
                                        <div className="px-6 py-4 bg-[#0B1D25] border-b border-teal-900/40 flex items-center justify-between flex-shrink-0 rounded-t-2xl z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 p-1 flex items-center justify-center text-teal-400">
                                                    <Package size={18} />
                                                </div>
                                                <h4 className="text-base font-bold text-slate-100">
                                                    {editingProduct ? `Edit: ${editingProduct.title}` : 'Create Product Listing'}
                                                </h4>
                                            </div>
                                            <button onClick={resetForm} className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-teal-950/50 transition-colors">
                                                <X size={18} />
                                            </button>
                                        </div>

                                        {/* Stepper Header (3 Phases) */}
                                        <div className="px-6 py-3 bg-[#071317] border-b border-teal-900/40 flex items-center justify-between gap-2">
                                            {/* Phase 1 */}
                                            <button
                                                onClick={() => setActivePhase(1)}
                                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${activePhase === 1
                                                    ? 'bg-teal-600 text-white shadow'
                                                    : activePhase > 1 ? 'bg-teal-950/60 text-teal-300 border border-teal-800/40' : 'bg-[#0E232B] text-slate-400'
                                                    }`}
                                            >
                                                <span className="w-5 h-5 rounded-full bg-black/30 flex items-center justify-center text-[10px] font-bold">1</span>
                                                Phase 1: Basic Details
                                            </button>

                                            <ChevronRight size={16} className="text-teal-900 flex-shrink-0" />

                                            {/* Phase 2 */}
                                            <button
                                                onClick={() => setActivePhase(2)}
                                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${activePhase === 2
                                                    ? 'bg-teal-600 text-white shadow'
                                                    : activePhase > 2 ? 'bg-teal-950/60 text-teal-300 border border-teal-800/40' : 'bg-[#0E232B] text-slate-400'
                                                    }`}
                                            >
                                                <span className="w-5 h-5 rounded-full bg-black/30 flex items-center justify-center text-[10px] font-bold">2</span>
                                                Phase 2: Images & Video
                                            </button>

                                            <ChevronRight size={16} className="text-teal-900 flex-shrink-0" />

                                            {/* Phase 3 */}
                                            <button
                                                onClick={() => setActivePhase(3)}
                                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${activePhase === 3
                                                    ? 'bg-teal-600 text-white shadow'
                                                    : 'bg-[#0E232B] text-slate-400'
                                                    }`}
                                            >
                                                <span className="w-5 h-5 rounded-full bg-black/30 flex items-center justify-center text-[10px] font-bold">3</span>
                                                Phase 3: Voice Note Pitch
                                            </button>
                                        </div>

                                        {/* Modal Body - Phase Content */}
                                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                                            {/* PHASE 1: BASIC DETAILS */}
                                            {activePhase === 1 && (
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2 text-teal-400 font-semibold text-xs uppercase tracking-wider mb-2">
                                                        <FileText size={16} />
                                                        Step 1 — Product Specifications
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-300 mb-1.5">Product Title *</label>
                                                            <input
                                                                type="text"
                                                                value={formData.title}
                                                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                                className="w-full bg-[#050D10] border border-teal-900/50 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                                                                placeholder="e.g. Air Jordan 1 Retro High"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-300 mb-1.5">Brand Name</label>
                                                            <input
                                                                type="text"
                                                                value={formData.brand}
                                                                onChange={e => setFormData({ ...formData, brand: e.target.value })}
                                                                className="w-full bg-[#050D10] border border-teal-900/50 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                                                                placeholder="e.g. Nike"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-300 mb-1.5">Gender Category</label>
                                                            <select
                                                                value={formData.gender}
                                                                onChange={e => setFormData({ ...formData, gender: e.target.value })}
                                                                className="w-full bg-[#050D10] border border-teal-900/50 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                                                            >
                                                                <option value="men">Men</option>
                                                                <option value="women">Women</option>
                                                                <option value="unisex">Unisex</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-300 mb-1.5">Color</label>
                                                            <input
                                                                type="text"
                                                                value={formData.color}
                                                                onChange={e => setFormData({ ...formData, color: e.target.value })}
                                                                className="w-full bg-[#050D10] border border-teal-900/50 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                                                                placeholder="e.g. Red / Black"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-300 mb-1.5">Original Size</label>
                                                            <input
                                                                type="text"
                                                                value={formData.size_original}
                                                                onChange={e => setFormData({ ...formData, size_original: e.target.value })}
                                                                className="w-full bg-[#050D10] border border-teal-900/50 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                                                                placeholder="e.g. US 10 / EU 44"
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="block text-xs font-medium text-slate-300 mb-1.5">Starting Price *</label>
                                                                <input
                                                                    type="number"
                                                                    value={formData.starting_price}
                                                                    onChange={e => setFormData({ ...formData, starting_price: e.target.value })}
                                                                    className="w-full bg-[#050D10] border border-teal-900/50 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                                                                    placeholder="150"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-slate-300 mb-1.5">Minimum Price *</label>
                                                                <input
                                                                    type="number"
                                                                    value={formData.minimum_price}
                                                                    onChange={e => setFormData({ ...formData, minimum_price: e.target.value })}
                                                                    className="w-full bg-[#050D10] border border-teal-900/50 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                                                                    placeholder="100"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-300 mb-1.5">Product Description & Notes</label>
                                                        <textarea
                                                            value={formData.description}
                                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                            rows={3}
                                                            className="w-full bg-[#050D10] border border-teal-900/50 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none resize-none"
                                                            placeholder="Provide description or selling instructions for the AI bot..."
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* PHASE 2: IMAGES & VIDEO ALIGNMENT */}
                                            {activePhase === 2 && (
                                                <div className="space-y-6">
                                                    <div className="flex items-center gap-2 text-teal-400 font-semibold text-xs uppercase tracking-wider mb-2">
                                                        <Camera size={16} />
                                                        Step 2 — Multi-Image Gallery & Alignment Controls
                                                    </div>

                                                    {/* Images Upload */}
                                                    <div>
                                                        <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                                                            <span>Product Gallery Images</span>
                                                            <span className="text-teal-400 font-semibold text-[11px]">Position 1 (Leftmost) = MAIN THUMBNAIL</span>
                                                        </label>
                                                        <div className="border-2 border-dashed border-teal-900/40 hover:border-teal-500 rounded-xl p-5 bg-[#050D10] hover:bg-[#08151A] transition-all text-center group cursor-pointer">
                                                            <input
                                                                type="file"
                                                                multiple
                                                                accept="image/*"
                                                                onChange={handleImageSelect}
                                                                className="hidden"
                                                                id="product-images-input"
                                                            />
                                                            <label htmlFor="product-images-input" className="cursor-pointer block">
                                                                <div className="w-10 h-10 rounded-full bg-teal-950/60 group-hover:bg-teal-600/20 text-teal-400 flex items-center justify-center mx-auto mb-2 transition-colors">
                                                                    <Upload size={20} />
                                                                </div>
                                                                <span className="text-xs font-semibold text-teal-400 group-hover:underline">Click to add product photos</span>
                                                                <p className="text-[11px] text-slate-500 mt-1">PNG, JPG, WEBP formats allowed (Max 10MB each)</p>
                                                            </label>
                                                        </div>

                                                        {/* Selected Images List with Alignment & Reordering controls */}
                                                        {productImages.length > 0 && (
                                                            <div className="mt-4 space-y-2">
                                                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                                                    Reorder & Align Images ({productImages.length} items)
                                                                </p>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                                    {productImages.map((img, i) => (
                                                                        <div key={img.id} className="bg-[#050D10] border border-teal-900/50 rounded-xl p-2.5 flex flex-col justify-between space-y-2 group relative">
                                                                            <div className="h-28 rounded-lg overflow-hidden bg-black relative">
                                                                                <img src={img.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                                                                                {i === 0 ? (
                                                                                    <span className="absolute top-1 left-1 bg-teal-600 text-white text-[9px] px-2 py-0.5 rounded font-bold shadow flex items-center gap-1">
                                                                                        <Star size={10} fill="currentColor" /> MAIN THUMBNAIL
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="absolute top-1 left-1 bg-black/60 text-slate-300 text-[9px] px-1.5 py-0.5 rounded font-medium">
                                                                                        #{i + 1}
                                                                                    </span>
                                                                                )}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => removeImageItem(i)}
                                                                                    className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity"
                                                                                    title="Remove Image"
                                                                                >
                                                                                    <X size={12} />
                                                                                </button>
                                                                            </div>

                                                                            {/* Alignment & Reorder Action Bar */}
                                                                            <div className="flex items-center justify-between gap-1 pt-1 border-t border-teal-900/30">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => makeMainImage(i)}
                                                                                    disabled={i === 0}
                                                                                    className="text-[10px] font-semibold px-2 py-1 rounded bg-teal-950/60 hover:bg-teal-600 text-teal-300 hover:text-white border border-teal-800/40 disabled:opacity-30 disabled:hover:bg-teal-950/60 disabled:hover:text-teal-300 transition-colors flex items-center gap-1"
                                                                                    title="Set as Main Thumbnail"
                                                                                >
                                                                                    <Star size={10} /> Set Main
                                                                                </button>

                                                                                <div className="flex items-center gap-1">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => moveImageLeft(i)}
                                                                                        disabled={i === 0}
                                                                                        className="p-1 rounded bg-[#0A1A20] text-slate-300 hover:bg-teal-950 border border-teal-900/40 disabled:opacity-30"
                                                                                        title="Move Left"
                                                                                    >
                                                                                        <ArrowLeft size={12} />
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => moveImageRight(i)}
                                                                                        disabled={i === productImages.length - 1}
                                                                                        className="p-1 rounded bg-[#0A1A20] text-slate-300 hover:bg-teal-950 border border-teal-900/40 disabled:opacity-30"
                                                                                        title="Move Right"
                                                                                    >
                                                                                        <ArrowRight size={12} />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Video Upload */}
                                                    <div className="pt-4 border-t border-teal-900/30">
                                                        <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                                                            <span className="flex items-center gap-2">
                                                                <Video size={16} className="text-teal-400" />
                                                                Product Video Showcase (Optional)
                                                            </span>
                                                            <span className="text-slate-500 font-normal text-[11px]">MP4, WEBM format (Max 50MB)</span>
                                                        </label>

                                                        {videoPreviewUrl ? (
                                                            <div className="relative rounded-xl border border-teal-900/50 overflow-hidden bg-black p-2">
                                                                <video src={videoPreviewUrl} controls className="w-full max-h-48 rounded-lg object-contain mx-auto" />
                                                                <button
                                                                    type="button"
                                                                    onClick={removeVideo}
                                                                    className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-lg"
                                                                >
                                                                    <Trash2 size={14} /> Remove Video
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="border-2 border-dashed border-teal-900/40 hover:border-teal-500 rounded-xl p-5 bg-[#050D10] hover:bg-[#08151A] transition-all text-center group cursor-pointer">
                                                                <input
                                                                    type="file"
                                                                    accept="video/*"
                                                                    onChange={handleVideoSelect}
                                                                    className="hidden"
                                                                    id="product-video-input"
                                                                />
                                                                <label htmlFor="product-video-input" className="cursor-pointer block">
                                                                    <div className="w-10 h-10 rounded-full bg-teal-950/60 group-hover:bg-teal-600/20 text-teal-400 flex items-center justify-center mx-auto mb-2 transition-colors">
                                                                        <Video size={20} />
                                                                    </div>
                                                                    <span className="text-xs font-semibold text-teal-400 group-hover:underline">Upload Product Video Showcase</span>
                                                                </label>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* PHASE 3: VOICE NOTE RECORDING & TIMELINE PUNCH-IN OVERWRITE */}
                                            {activePhase === 3 && (
                                                <div className="space-y-6">
                                                    <div className="flex items-center gap-2 text-teal-400 font-semibold text-xs uppercase tracking-wider mb-2">
                                                        <Mic size={16} />
                                                        Step 3 — Product Voice Note Pitch & Timeline Studio
                                                    </div>

                                                    <div className="bg-[#050D10] border border-teal-900/40 rounded-xl p-6 text-center">

                                                        {/* Recording Controls */}
                                                        <div className="flex flex-col items-center justify-center gap-4">
                                                            {!isRecording && !audioPreviewUrl && !isTimelineRecording && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => startRecording()}
                                                                    className="w-[60px] h-[60px] rounded-full bg-[#FF3B30] hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/40 transition-all transform hover:scale-105"
                                                                >
                                                                    <Mic size={28} />
                                                                </button>
                                                            )}

                                                            {isRecording && !isTimelineRecording && (
                                                                <div className="flex items-center w-full max-w-[320px] mx-auto relative h-[60px]">
                                                                    <button
                                                                        type="button"
                                                                        onClick={isPaused ? resumeRecording : pauseRecording}
                                                                        className="absolute left-0 z-10 w-[60px] h-[60px] bg-[#FF3B30] hover:bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/40 transition-colors cursor-pointer"
                                                                        title={isPaused ? "Resume Recording" : "Pause Recording"}
                                                                    >
                                                                        {isPaused ? <Play className="text-white fill-current ml-1" size={24} /> : <Pause className="text-white fill-current" size={24} />}
                                                                    </button>

                                                                    <div className="ml-7 bg-[#FF3B30] h-[48px] w-full rounded-r-full flex items-center pl-10 pr-2 justify-between gap-[3px] shadow-sm overflow-hidden animate-fade-in-right">
                                                                        <div className="flex items-center gap-1.5 text-white font-mono text-sm ml-1">
                                                                            <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-white animate-pulse'}`} />
                                                                            {formatTimer(recordingTime)}
                                                                        </div>

                                                                        <div className="flex items-center justify-between gap-[3px] h-full flex-1 mx-2 overflow-hidden">
                                                                            {visualizerData.map((h, i) => (
                                                                                <div
                                                                                    key={i}
                                                                                    className={`w-[3px] rounded-full transition-all duration-150 ${isPaused ? 'bg-white/40' : 'bg-white'}`}
                                                                                    style={{ height: `${isPaused ? 15 : h}%` }}
                                                                                />
                                                                            ))}
                                                                        </div>

                                                                        <button
                                                                            type="button"
                                                                            onClick={stopRecording}
                                                                            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors flex-shrink-0 mr-1"
                                                                            title="Finish Recording"
                                                                        >
                                                                            <Square className="text-white fill-current" size={12} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Recorded Audio Studio Player & Timeline Punch-In Overwrite */}
                                                            {audioPreviewUrl && (!isRecording || isTimelineRecording) && (
                                                                <div className="w-full max-w-lg mx-auto space-y-4">
                                                                    {/* Custom Red Pill Audio Player UI */}
                                                                    <div
                                                                        onClick={togglePlayPause}
                                                                        className="flex items-center w-full max-w-[320px] mx-auto relative h-[60px] cursor-pointer hover:scale-[1.02] transition-transform"
                                                                        title="Click to Play/Pause"
                                                                    >
                                                                        <audio
                                                                            ref={audioElementRef}
                                                                            src={audioPreviewUrl}
                                                                            className="hidden"
                                                                            onLoadedMetadata={() => {
                                                                                if (audioElementRef.current) setAudioDuration(audioElementRef.current.duration || 0);
                                                                            }}
                                                                            onTimeUpdate={() => {
                                                                                if (audioElementRef.current) setSeekTime(audioElementRef.current.currentTime || 0);
                                                                            }}
                                                                        />
                                                                        <div className="absolute left-0 z-10 w-[60px] h-[60px] bg-[#FF3B30] rounded-full flex items-center justify-center shadow-lg shadow-red-500/40">
                                                                            {isPlaying ? <Pause className="text-white fill-current" size={24} /> : <Play className="text-white fill-current ml-1" size={24} />}
                                                                        </div>
                                                                        <div className="ml-7 bg-[#FF3B30] h-[48px] w-full rounded-r-full flex items-center pl-10 pr-6 justify-between gap-[3px] shadow-sm overflow-hidden">
                                                                            {new Array(35).fill(10).map((_, i) => {
                                                                                const peakIdx = Math.floor((i / 35) * (waveformPeaks.length || 35));
                                                                                const heightPercent = waveformPeaks.length > 0 ? waveformPeaks[peakIdx] : (Math.sin(i * 0.8) * 30 + 50);
                                                                                const progressPercent = audioDuration > 0 ? seekTime / audioDuration : 0;
                                                                                const isActive = (i / 35) <= progressPercent;
                                                                                return (
                                                                                    <div
                                                                                        key={i}
                                                                                        className={`w-[3px] rounded-full transition-all duration-150 ${isActive ? 'bg-white' : 'bg-white/40'}`}
                                                                                        style={{ height: `${heightPercent}%` }}
                                                                                    />
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>

                                                                    {/* Toggle Button for CapCut Visual Editor */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setShowTimelineEditor(!showTimelineEditor)}
                                                                        className="w-full bg-[#0B1E26] hover:bg-teal-950 text-teal-300 border border-teal-800/40 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow transition-all cursor-pointer"
                                                                    >
                                                                        {showTimelineEditor ? 'Hide Editor' : 'Edit or Voice over'}
                                                                    </button>

                                                                    {/* CapCut Visual Multi-Track Timeline Studio Drawer */}
                                                                    {showTimelineEditor && (
                                                                        <div className="bg-[#050D10] p-4.5 rounded-2xl border border-teal-500/40 shadow-2xl space-y-4 transition-all">
                                                                            {/* Top Control Toolbar with Edit Icon */}
                                                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-900/40 pb-3">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
                                                                                        <Edit3 size={15} />
                                                                                    </div>
                                                                                </div>

                                                                                {/* Action Bar (Icons Only in One Line) */}
                                                                                <div className="flex items-center gap-2">
                                                                                    {/* PLAY / PAUSE BUTTON */}
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={togglePlayPause}
                                                                                        className="bg-teal-600 hover:bg-teal-500 text-white w-8 h-8 rounded-lg flex items-center justify-center shadow transition-all cursor-pointer"
                                                                                        title="Play or Pause audio (Shortcut: Spacebar)"
                                                                                    >
                                                                                        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                                                                                    </button>

                                                                                    {/* RECORD VOICE-OVER */}
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={startTimelineRecording}
                                                                                        className={`${isTimelineRecording ? 'bg-red-500 animate-pulse' : 'bg-red-600 hover:bg-red-500'} text-white w-8 h-8 rounded-lg flex items-center justify-center shadow transition-all cursor-pointer`}
                                                                                        title={isTimelineRecording ? "Stop Recording" : "Record Voice-Over at playhead"}
                                                                                    >
                                                                                        {isTimelineRecording ? <Square size={12} className="fill-current" /> : <Mic size={14} />}
                                                                                    </button>

                                                                                    {/* CUT / SPLIT AT PLAYHEAD */}
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={splitClipAtPlayhead}
                                                                                        className="bg-teal-600 hover:bg-teal-500 text-white w-8 h-8 rounded-lg flex items-center justify-center shadow transition-all cursor-pointer"
                                                                                        title="Cut clip at playhead"
                                                                                    >
                                                                                        <Scissors size={14} />
                                                                                    </button>

                                                                                    {/* ZOOM CONTROLS */}
                                                                                    <div className="flex items-center gap-1 ml-2 border-l border-teal-900/40 pl-2">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => setTimelineZoom(prev => Math.max(1, prev - 0.5))}
                                                                                            className="bg-[#0B1E26] hover:bg-teal-900/50 text-teal-300 w-7 h-7 rounded-md flex items-center justify-center transition-all cursor-pointer border border-teal-900/40"
                                                                                            title="Zoom Out (Ctrl -)"
                                                                                        >
                                                                                            <ZoomOut size={13} />
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => setTimelineZoom(prev => Math.min(5, prev + 0.5))}
                                                                                            className="bg-[#0B1E26] hover:bg-teal-900/50 text-teal-300 w-7 h-7 rounded-md flex items-center justify-center transition-all cursor-pointer border border-teal-900/40"
                                                                                            title="Zoom In (Ctrl +)"
                                                                                        >
                                                                                            <ZoomIn size={13} />
                                                                                        </button>
                                                                                        {timelineZoom !== 1 && (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => setTimelineZoom(1)}
                                                                                                className="bg-[#0B1E26] hover:bg-teal-900/50 text-teal-300 w-7 h-7 rounded-md flex items-center justify-center transition-all cursor-pointer border border-teal-900/40"
                                                                                                title="Reset Zoom"
                                                                                            >
                                                                                                <Minimize2 size={13} />
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* Playhead Info Row */}
                                                                            <div className="flex items-center justify-between px-1 mb-2">
                                                                                <div className="text-[10px] font-mono text-teal-400">
                                                                                    Playhead: {formatTimer(seekTime)} / {formatTimer(audioDuration)}
                                                                                </div>
                                                                            </div>

                                                                            {/* Multi-Track Timeline Box */}

                                                                            <div className="space-y-2 text-left">
                                                                                {/* Scrollable Timeline Wrapper */}
                                                                                <div
                                                                                    ref={timelineScrollRef}
                                                                                    className="overflow-x-auto overflow-y-hidden rounded-xl border border-teal-900/60 bg-[#08181F] shadow-inner custom-scrollbar"
                                                                                    style={{ maxHeight: '160px' }}
                                                                                >
                                                                                    {/* Interactive Timeline Canvas spanning both tracks */}
                                                                                    <div
                                                                                        ref={timelineTrackRef}
                                                                                        onMouseDown={handleTimelineMouseDown}
                                                                                        className="relative cursor-pointer select-none group space-y-1 p-1"
                                                                                        style={{ minWidth: `${timelineZoom * 100}%` }}
                                                                                    >
                                                                                        {/* TRACK 1: MAIN AUDIO TRACK */}
                                                                                        <div className="relative h-14 bg-[#051116] rounded-lg border border-teal-900/40 overflow-hidden flex items-center px-2">
                                                                                            {/* Render Main Audio Clips (Movable with internal waveform peaks & per-clip crop handles) */}
                                                                                            {audioDuration > 0 && mainClips.map((clip, idx) => {
                                                                                                if (clip.isDeleted) return null;
                                                                                                const leftPercent = (clip.start / audioDuration) * 100;
                                                                                                const widthPercent = ((clip.end - clip.start) / audioDuration) * 100;
                                                                                                const isSelected = selectedClipId === clip.id;

                                                                                                // Slice peak waveform for this clip's source PCM region so waveform moves WITH the clip box!
                                                                                                const totalPeaks = waveformPeaks.length > 0 ? waveformPeaks.length : 72;
                                                                                                const srcStart = clip.sourceStart !== undefined ? clip.sourceStart : clip.start;
                                                                                                const srcEnd = srcStart + (clip.end - clip.start);
                                                                                                const startIdx = Math.max(0, Math.floor((srcStart / audioDuration) * totalPeaks));
                                                                                                const endIdx = Math.min(totalPeaks, Math.max(startIdx + 4, Math.ceil((srcEnd / audioDuration) * totalPeaks)));
                                                                                                const clipPeaks = (waveformPeaks.length > 0 ? waveformPeaks : Array.from({ length: 72 }).map(() => 45)).slice(startIdx, endIdx);

                                                                                                return (
                                                                                                    <div
                                                                                                        key={clip.id}
                                                                                                        onMouseDown={(e) => handleClipMouseDown(e, clip)}
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            setSelectedClipId(clip.id);
                                                                                                            setSelectedTrack('main');
                                                                                                        }}
                                                                                                        className={`absolute top-1 bottom-1 rounded-lg border-2 flex items-center justify-between px-2 transition-all cursor-grab active:cursor-grabbing z-10 overflow-hidden ${isSelected
                                                                                                            ? 'bg-teal-500/50 border-teal-400 shadow-[0_0_14px_rgba(20,184,166,0.7)] text-white ring-2 ring-teal-300'
                                                                                                            : 'bg-teal-950/90 border-teal-800/80 hover:border-teal-400 text-teal-200'
                                                                                                            }`}
                                                                                                        style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                                                                                                        title="Drag clip to move. Drag left/right handle edges to crop/trim clip."
                                                                                                    >
                                                                                                        {/* Left Edge Crop Handle */}
                                                                                                        <div
                                                                                                            onMouseDown={(e) => handleClipTrimMouseDown(e, clip, 'start')}
                                                                                                            onClick={(e) => e.stopPropagation()}
                                                                                                            className="absolute left-0 top-0 bottom-0 w-2 bg-teal-400 hover:bg-white cursor-ew-resize z-30 flex items-center justify-center transition-colors group/leftTrim"
                                                                                                            title="Drag left edge to crop/trim start"
                                                                                                        >
                                                                                                            <div className="w-0.5 h-3.5 bg-teal-950 rounded-full" />
                                                                                                        </div>

                                                                                                        {/* Waveform Peaks INSIDE the clip box so voice moves WITH the clip! */}
                                                                                                        <div className="absolute inset-0 flex items-center justify-between px-2 opacity-40 pointer-events-none z-0">
                                                                                                            {clipPeaks.map((height, i) => (
                                                                                                                <div
                                                                                                                    key={i}
                                                                                                                    className="w-0.5 bg-teal-300 rounded-full"
                                                                                                                    style={{ height: `${height}%` }}
                                                                                                                />
                                                                                                            ))}
                                                                                                        </div>

                                                                                                        <div className="flex items-center gap-1 text-[10px] font-bold truncate pointer-events-none z-10 pl-1.5">
                                                                                                            <Move size={11} className="text-teal-400/90 flex-shrink-0" />
                                                                                                            <span className="truncate">{clip.name || `Main Clip #${idx + 1}`} ({formatTimer(clip.start)} - {formatTimer(clip.end)})</span>
                                                                                                        </div>
                                                                                                        {isSelected && (
                                                                                                            <div className="flex items-center gap-1 z-20 mr-1.5">
                                                                                                                <button
                                                                                                                    type="button"
                                                                                                                    onClick={(e) => {
                                                                                                                        e.stopPropagation();
                                                                                                                        deleteSelectedClip();
                                                                                                                    }}
                                                                                                                    className="p-1 bg-red-600 hover:bg-red-500 text-white rounded cursor-pointer transition-colors shadow flex items-center justify-center"
                                                                                                                    title="Delete this selected clip piece (Or press Delete / Backspace key)"
                                                                                                                >
                                                                                                                    <Trash2 size={10} />
                                                                                                                </button>
                                                                                                                <span className="text-[8px] bg-teal-600 px-1 py-0.5 rounded font-bold uppercase tracking-wider text-white pointer-events-none">
                                                                                                                    Selected
                                                                                                                </span>
                                                                                                            </div>
                                                                                                        )}

                                                                                                        {/* Right Edge Crop Handle */}
                                                                                                        <div
                                                                                                            onMouseDown={(e) => handleClipTrimMouseDown(e, clip, 'end')}
                                                                                                            onClick={(e) => e.stopPropagation()}
                                                                                                            className="absolute right-0 top-0 bottom-0 w-2 bg-teal-400 hover:bg-white cursor-ew-resize z-30 flex items-center justify-center transition-colors group/rightTrim"
                                                                                                            title="Drag right edge to crop/trim end"
                                                                                                        >
                                                                                                            <div className="w-0.5 h-3.5 bg-teal-950 rounded-full" />
                                                                                                        </div>
                                                                                                    </div>
                                                                                                );
                                                                                            })}

                                                                                            {/* Auto-Mute Red Indicator overlay on Track 1 where Voice-Over exists on Track 2 */}
                                                                                            {audioDuration > 0 && voiceoverClips.map(vo => {
                                                                                                if (vo.isDeleted) return null;
                                                                                                const leftPercent = (vo.start / audioDuration) * 100;
                                                                                                const widthPercent = ((vo.end - vo.start) / audioDuration) * 100;
                                                                                                return (
                                                                                                    <div
                                                                                                        key={`silenced-${vo.id}`}
                                                                                                        className="absolute top-0 bottom-0 bg-red-950/80 border-x-2 border-red-500/80 flex items-center justify-center pointer-events-none z-15 shadow-inner"
                                                                                                        style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                                                                                                    >
                                                                                                        <span className="text-[9px] font-bold text-red-300 uppercase tracking-tight bg-black/80 px-1.5 py-0.5 rounded border border-red-800 truncate shadow">
                                                                                                            Muted by Voice-Over
                                                                                                        </span>
                                                                                                    </div>
                                                                                                );
                                                                                            })}
                                                                                        </div>

                                                                                        {/* TRACK 2: VOICE-OVER TRACK */}
                                                                                        <div className="relative h-14 bg-[#140F08] rounded-lg border border-amber-900/40 overflow-hidden flex items-center px-2">
                                                                                            {/* Render Voice-Over Clips (Movable with internal waveform & per-clip crop handles) */}
                                                                                            {audioDuration > 0 && voiceoverClips.map((vo, idx) => {
                                                                                                if (vo.isDeleted) return null;
                                                                                                const leftPercent = (vo.start / audioDuration) * 100;
                                                                                                const widthPercent = ((vo.end - vo.start) / audioDuration) * 100;
                                                                                                const isSelected = selectedClipId === vo.id;
                                                                                                const voPeaks = Array.from({ length: 24 }).map((_, i) => Math.sin(i * 0.5) * 35 + 45);

                                                                                                return (
                                                                                                    <div
                                                                                                        key={vo.id}
                                                                                                        onMouseDown={(e) => handleClipMouseDown(e, vo)}
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            setSelectedClipId(vo.id);
                                                                                                            setSelectedTrack('voiceover');
                                                                                                        }}
                                                                                                        className={`absolute top-1 bottom-1 rounded-lg border-2 flex items-center justify-between px-2 transition-all cursor-grab active:cursor-grabbing z-10 overflow-hidden ${isSelected
                                                                                                            ? 'bg-amber-500/60 border-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.8)] text-white ring-2 ring-amber-300'
                                                                                                            : 'bg-amber-950/90 border-amber-600/80 hover:border-amber-400 text-amber-200'
                                                                                                            }`}
                                                                                                        style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                                                                                                        title="Drag clip to move. Drag left/right handle edges to crop/trim clip."
                                                                                                    >
                                                                                                        {/* Left Edge Crop Handle */}
                                                                                                        <div
                                                                                                            onMouseDown={(e) => handleClipTrimMouseDown(e, vo, 'start')}
                                                                                                            onClick={(e) => e.stopPropagation()}
                                                                                                            className="absolute left-0 top-0 bottom-0 w-2 bg-amber-400 hover:bg-white cursor-ew-resize z-30 flex items-center justify-center transition-colors group/leftTrim"
                                                                                                            title="Drag left edge to crop/trim start"
                                                                                                        >
                                                                                                            <div className="w-0.5 h-3.5 bg-amber-950 rounded-full" />
                                                                                                        </div>

                                                                                                        {/* Waveform Peaks INSIDE Voice-Over Clip Box */}
                                                                                                        <div className="absolute inset-0 flex items-center justify-between px-2 opacity-40 pointer-events-none z-0">
                                                                                                            {voPeaks.map((height, i) => (
                                                                                                                <div
                                                                                                                    key={i}
                                                                                                                    className="w-0.5 bg-amber-400 rounded-full"
                                                                                                                    style={{ height: `${height}%` }}
                                                                                                                />
                                                                                                            ))}
                                                                                                        </div>

                                                                                                        <div className="flex items-center gap-1 text-[10px] font-bold truncate pointer-events-none z-10 pl-1.5">
                                                                                                            <Move size={11} className="text-amber-400/90 flex-shrink-0" />
                                                                                                            <Mic size={11} className="text-amber-400 flex-shrink-0" />
                                                                                                            <span className="truncate">{vo.name || `Voice-Over #${idx + 1}`} ({formatTimer(vo.start)} - {formatTimer(vo.end)})</span>
                                                                                                        </div>
                                                                                                        {isSelected && (
                                                                                                            <div className="flex items-center gap-1 z-20 mr-1.5">
                                                                                                                <button
                                                                                                                    type="button"
                                                                                                                    onClick={(e) => {
                                                                                                                        e.stopPropagation();
                                                                                                                        deleteSelectedClip();
                                                                                                                    }}
                                                                                                                    className="p-1 bg-red-600 hover:bg-red-500 text-white rounded cursor-pointer transition-colors shadow flex items-center justify-center"
                                                                                                                    title="Delete this selected clip piece (Or press Delete / Backspace key)"
                                                                                                                >
                                                                                                                    <Trash2 size={10} />
                                                                                                                </button>
                                                                                                                <span className="text-[8px] bg-amber-600 px-1 py-0.5 rounded font-bold uppercase tracking-wider text-white pointer-events-none">
                                                                                                                    Selected
                                                                                                                </span>
                                                                                                            </div>
                                                                                                        )}

                                                                                                        {/* Right Edge Crop Handle */}
                                                                                                        <div
                                                                                                            onMouseDown={(e) => handleClipTrimMouseDown(e, vo, 'end')}
                                                                                                            onClick={(e) => e.stopPropagation()}
                                                                                                            className="absolute right-0 top-0 bottom-0 w-2 bg-amber-400 hover:bg-white cursor-ew-resize z-30 flex items-center justify-center transition-colors group/rightTrim"
                                                                                                            title="Drag right edge to crop/trim end"
                                                                                                        >
                                                                                                            <div className="w-0.5 h-3.5 bg-amber-950 rounded-full" />
                                                                                                        </div>
                                                                                                    </div>
                                                                                                );
                                                                                            })}
                                                                                        </div>

                                                                                        {/* Red Playhead Vertical Indicator Across Both Tracks */}
                                                                                        {audioDuration > 0 && (
                                                                                            <div
                                                                                                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,1)]"
                                                                                                style={{ left: `${(seekTime / audioDuration) * 100}%` }}
                                                                                            >
                                                                                                <div className="w-2.5 h-2.5 bg-red-500 rounded-full -translate-x-[4px] -translate-y-1 border border-white" />
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div> {/* end scrollable wrapper */}
                                                                            </div>

                                                                            {/* Footer Save & Stitch Bar */}
                                                                            <div className="pt-2 border-t border-teal-900/40 flex items-center justify-end">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={applyStitchingAndSave}
                                                                                    className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-teal-600/30 transition-all cursor-pointer"
                                                                                >
                                                                                    <Check size={15} /> Save
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    <button
                                                                        type="button"
                                                                        onClick={clearAudio}
                                                                        className="text-xs text-red-400 hover:text-red-300 font-semibold flex items-center justify-center gap-1.5 mx-auto pt-1"
                                                                    >
                                                                        <RotateCcw size={14} /> Delete & Record New Audio
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Alternative Audio Upload */}
                                                    <div className="pt-4 border-t border-teal-900/30 flex items-center justify-between">
                                                        <span className="text-xs text-slate-400">Or select an existing audio file:</span>
                                                        <label className="bg-[#0B1E26] hover:bg-teal-950/60 text-teal-300 border border-teal-800/40 text-xs px-3.5 py-2 rounded-lg font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
                                                            <Upload size={14} /> Choose Audio File
                                                            <input type="file" accept="audio/*" onChange={handleAudioFileUpload} className="hidden" />
                                                        </label>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Modal Footer Controls */}
                                        <div className="px-6 py-4 bg-[#0B1D25] border-t border-teal-900/40 flex items-center justify-between">
                                            <button
                                                type="button"
                                                onClick={() => setActivePhase(prev => (prev > 1 ? (prev - 1) as 1 | 2 | 3 : 1))}
                                                disabled={activePhase === 1}
                                                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400 flex items-center gap-1.5"
                                            >
                                                <ChevronLeft size={16} /> Back
                                            </button>

                                            <div className="flex items-center gap-3">
                                                {activePhase < 3 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setActivePhase(prev => (prev < 3 ? (prev + 1) as 1 | 2 | 3 : 3))}
                                                        className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow"
                                                    >
                                                        Next Phase <ChevronRight size={16} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={handleSubmit}
                                                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/30"
                                                    >
                                                        <Check size={16} /> {editingProduct ? 'Update Product' : 'Save & Publish Product'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ===== PRODUCTS GRID ===== */}
                            {loading ? (
                                <div className="flex items-center justify-center h-64">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                                </div>
                            ) : products.length === 0 ? (
                                <div className="border border-dashed border-teal-900/30 rounded-2xl h-64 flex flex-col items-center justify-center text-slate-500">
                                    <Package size={48} className="mb-3 text-teal-800" />
                                    <p className="font-semibold text-slate-300">No products listed yet</p>
                                    <p className="text-xs text-slate-500 mt-1">Click "Add New Product" to start building your catalog</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {products.map(product => {
                                        const allImages = getProductAllImages(product);
                                        const activeImgIdx = cardActiveImageIndex[product.id] || 0;
                                        const currentImgUrl = allImages[activeImgIdx] || product.main_image_url;

                                        return (
                                            <div key={product.id} className="bg-[#0B1B20] border border-teal-900/40 rounded-2xl overflow-hidden hover:border-teal-700/60 transition-all duration-200 flex flex-col group shadow-xl">
                                                {/* Product Thumbnail & Badges */}
                                                <div className="h-48 bg-[#050D10] relative overflow-hidden flex items-center justify-center">
                                                    {currentImgUrl ? (
                                                        <img src={currentImgUrl} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                                    ) : (
                                                        <Camera size={40} className="text-teal-900/60" />
                                                    )}

                                                    {/* Status Badge & Uploading UI */}
                                                    {(product.status as any) === 'uploading' ? (
                                                        <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                                                            <div className="bg-[#050D10]/90 backdrop-blur-md border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)] rounded-full px-3 py-1.5 flex items-center gap-2">
                                                                <div className="w-3 h-3 rounded-full border-[1.5px] border-amber-500/30 border-t-amber-500 animate-spin"></div>
                                                                <span className="text-[10px] font-black text-amber-500 tracking-wider">UPLOADING</span>
                                                            </div>
                                                            {/* Fake continuous progress bar inside the badge area */}
                                                            <div className="w-full bg-[#050D10]/80 rounded-full h-1 overflow-hidden backdrop-blur-sm">
                                                                <div className="bg-gradient-to-r from-amber-600 to-amber-400 h-full w-[40%] rounded-full animate-[shimmer_1.5s_infinite]"></div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className={`absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-full border shadow-lg ${product.status === 'available'
                                                            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                                                            : 'bg-rose-950/80 text-rose-400 border-rose-800'
                                                            }`}>
                                                            {product.status.toUpperCase()}
                                                        </span>
                                                    )}

                                                    {/* Multi-Image Dots / Selector */}
                                                    {allImages.length > 1 && (
                                                        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-full border border-teal-800/40 flex items-center gap-1">
                                                            {allImages.map((_, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    onClick={() => setCardActiveImageIndex(prev => ({ ...prev, [product.id]: idx }))}
                                                                    className={`w-2 h-2 rounded-full transition-all ${activeImgIdx === idx ? 'bg-teal-400 w-4' : 'bg-slate-500 hover:bg-slate-300'
                                                                        }`}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Media Indicators Bar */}
                                                    <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5">
                                                        {product.video_url && (
                                                            <button
                                                                onClick={() => setActiveMediaPreview({ type: 'video', url: product.video_url!, title: product.title })}
                                                                className="bg-[#071317]/90 hover:bg-teal-600 text-teal-300 hover:text-white text-[10px] font-semibold px-2 py-1 rounded-md border border-teal-800/40 flex items-center gap-1 transition-colors"
                                                            >
                                                                <Video size={12} /> Video Attached
                                                            </button>
                                                        )}
                                                        {product.voice_note_url && (
                                                            <button
                                                                onClick={() => setActiveMediaPreview({ type: 'audio', url: product.voice_note_url!, title: product.title })}
                                                                className="bg-[#071317]/90 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[10px] font-semibold px-2 py-1 rounded-md border border-teal-800/40 flex items-center gap-1 transition-colors"
                                                            >
                                                                <Volume2 size={12} /> Voice Pitch Note
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Product Details Info */}
                                                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                                                    <div>
                                                        <h4 className="font-bold text-slate-100 text-base leading-snug line-clamp-1 mb-1">{product.title}</h4>
                                                        <p className="text-xs text-slate-400 font-medium">
                                                            {product.brand && `${product.brand} · `}{product.gender} · Size: {product.size_original || 'N/A'}
                                                            {product.color && ` · ${product.color}`}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-baseline justify-between pt-2 border-t border-teal-900/30">
                                                        <div>
                                                            <p className="text-[10px] text-teal-400/70 font-semibold uppercase">Asking Price</p>
                                                            <p className="text-lg font-bold text-slate-100">Rs {product.starting_price}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] text-slate-500 font-semibold uppercase">Min Negotiable</p>
                                                            <p className="text-xs font-semibold text-slate-400">Rs {product.minimum_price}</p>
                                                        </div>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="flex items-center gap-2 pt-1">
                                                        <button
                                                            onClick={() => toggleStatus(product)}
                                                            disabled={(product.status as any) === 'uploading'}
                                                            className={`flex-1 text-xs py-2 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${product.status === 'available'
                                                                ? 'bg-amber-950/40 text-amber-400 hover:bg-amber-900/50 border border-amber-900/40'
                                                                : 'bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/50 border border-emerald-900/40'
                                                                }`}
                                                        >
                                                            {product.status === 'available' ? 'Mark Sold' : 'Mark Available'}
                                                        </button>

                                                        <button
                                                            onClick={() => handleEdit(product)}
                                                            disabled={(product.status as any) === 'uploading'}
                                                            className="p-2.5 rounded-xl bg-[#071317] text-slate-300 hover:bg-teal-950/60 border border-teal-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title="Edit Product"
                                                        >
                                                            <Edit3 size={15} />
                                                        </button>

                                                        <button
                                                            onClick={() => handleDelete(product.id)}
                                                            disabled={(product.status as any) === 'uploading'}
                                                            className="p-2.5 rounded-xl bg-red-950/30 text-red-400 hover:bg-red-900/40 border border-red-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title="Delete Product"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ===== MEDIA PREVIEW MODAL ===== */}
                    {activeMediaPreview && (
                        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="bg-[#09181E] border border-teal-800/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                                <div className="px-5 py-4 bg-[#0B1D25] border-b border-teal-900/40 flex items-center justify-between">
                                    <h5 className="text-xs font-bold text-slate-200">
                                        {activeMediaPreview.type === 'video' ? 'Product Video Showcase' : 'Product Voice Pitch Note'} — {activeMediaPreview.title}
                                    </h5>
                                    <button onClick={() => setActiveMediaPreview(null)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                                        <X size={18} />
                                    </button>
                                </div>
                                <div className="p-6 text-center">
                                    {activeMediaPreview.type === 'video' ? (
                                        <video src={activeMediaPreview.url} controls autoPlay className="w-full rounded-xl bg-black max-h-80" />
                                    ) : (
                                        <div className="space-y-4">
                                            <Volume2 size={40} className="text-teal-400 mx-auto" />
                                            <audio src={activeMediaPreview.url} controls autoPlay className="w-full" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ===== GUIDANCE MODAL OVERLAY ===== */}
                    {activeGuidance && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-[#09181E] border border-teal-800/40 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                                <div className="bg-[#0B1D25] px-6 py-4 border-b border-teal-900/40 flex justify-between items-center">
                                    <h3 className="font-bold text-sm text-slate-100">{apiGuidanceData[activeGuidance].title}</h3>
                                    <button onClick={() => setActiveGuidance(null)} className="text-slate-400 hover:text-slate-200 font-bold text-lg">&times;</button>
                                </div>
                                <div className="p-6">
                                    <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">{apiGuidanceData[activeGuidance].content}</p>
                                </div>
                                <div className="bg-[#050D10] px-6 py-3 border-t border-teal-900/40 flex justify-end">
                                    <button onClick={() => setActiveGuidance(null)} className="bg-teal-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-teal-500">Got it</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ===== CONVERSATIONS TAB ===== */}
                    {subTab === 'conversations' && (
                        <LiveConversations />
                    )}

                    {/* ===== ORDERS TAB ===== */}
                    {subTab === 'orders' && (
                        <OrdersPage />
                    )}

                    {/* ===== ANALYTICS TAB ===== */}
                    {subTab === 'analytics' && (
                        <AnalyticsPage />
                    )}

                    {/* ===== POLICY VOICES TAB ===== */}
                    {subTab === 'policy' && (
                        <VoiceAssetsTab
                            category="policy"
                            title="Policy Voices"
                            description="Manage standard policy audio clips (e.g., Shipping Policy, Return Policy) for AI Agent use."
                        />
                    )}

                    {/* ===== PRERECORDED VOICES TAB ===== */}
                    {subTab === 'prerecorded' && (
                        <VoiceAssetsTab
                            category="prerecorded"
                            title="Pre recorded voices"
                            description="Manage casual pre recorded voice notes for common FAQs and greetings."
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default WhatsAppDashboard;
