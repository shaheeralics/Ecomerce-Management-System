const fs = require('fs');
let wd = fs.readFileSync('src/components/WhatsAppDashboard.tsx', 'utf8');

if (!wd.includes('const [isPaused, setIsPaused] = useState(false);')) {
    wd = wd.replace(
        'const [isRecording, setIsRecording] = useState(false);',
        'const [isRecording, setIsRecording] = useState(false);\n    const [isPaused, setIsPaused] = useState(false);'
    );
}

// Pause/Resume functions
const funcs = `
    const pauseRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
            setIsPaused(true);
        }
    };
    const resumeRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
            setIsPaused(false);
        }
    };
`;
if (!wd.includes('pauseRecording = () =>')) {
    wd = wd.replace('const stopRecording = () => {', funcs + '\n    const stopRecording = () => {');
}

wd = wd.replace('setIsRecording(false);', 'setIsRecording(false);\n        setIsPaused(false);');

// UI Buttons
const recordingButtons = `                                            <div className="flex gap-4 w-full">
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
                                            </div>`;

wd = wd.replace(
    '<div className="flex gap-4 w-full">\n                                                <button onClick={stopRecording} className="flex-1 bg-white text-black py-4 rounded-full font-bold text-lg active:scale-95 shadow-lg flex items-center justify-center gap-2">\n                                                    <Square size={20} /> Stop\n                                                </button>\n                                            </div>',
    recordingButtons
);
// Also for mobile view pulse
wd = wd.replace(
    '${isRecording ? \\\'bg-red-500 animate-pulse\\\' : \\\'bg-[#27272a]\\\'}',
    '${isRecording && !isPaused ? \\\'bg-red-500 animate-pulse\\\' : isPaused ? \\\'bg-amber-500\\\' : \\\'bg-[#27272a]\\\'}'
);

fs.writeFileSync('src/components/WhatsAppDashboard.tsx', wd);
console.log('Added Pause/Resume to Voice Recorder');
