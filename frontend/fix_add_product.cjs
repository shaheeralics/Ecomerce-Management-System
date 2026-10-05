const fs = require('fs');

let wd = fs.readFileSync('src/components/WhatsAppDashboard.tsx', 'utf8');

const startMarker = "                {activeMobilePage === 'add-product' && (";
const endMarker = "                )}";

const startIndex = wd.indexOf(startMarker);
if (startIndex !== -1) {
    let brackets = 0;
    let endIndex = startIndex;
    
    // Simple bracket matching to find the end of the add-product block
    let foundStart = false;
    for (let i = startIndex; i < wd.length; i++) {
        if (wd[i] === '{') {
            brackets++;
            foundStart = true;
        } else if (wd[i] === '}') {
            brackets--;
        }
        
        if (foundStart && brackets === 0) {
            endIndex = i + 1;
            break;
        }
    }

    const newAddProductView = `                {/* 4) ADD PRODUCT MOBILE NATIVE SCREEN (Stack Navigation) */}
                {activeMobilePage === 'add-product' && (
                    <div className="flex flex-col h-full w-full absolute inset-0 bg-[#030712] z-[70] animate-in slide-in-from-bottom duration-300">
                        <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center px-4 shrink-0 shadow-sm relative">
                            <button onClick={() => setActiveMobilePage('main')} className="absolute left-4 p-2 -m-2 text-indigo-400 active:opacity-50 flex items-center gap-1 z-10">
                                <ChevronLeft size={24} /> <span className="text-base font-semibold">Cancel</span>
                            </button>
                        </div>
                        <div className="flex-1 p-6 flex flex-col items-center justify-center bg-gradient-to-b from-[#09090b] to-[#030712]">
                            <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6">
                                <Mic size={40} className="text-indigo-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Smart Add</h2>
                            <p className="text-sm text-zinc-400 text-center mb-10 max-w-[250px]">
                                Record a voice note detailing the product's name, price, brand and size. AI will automatically list it!
                            </p>
                            
                            <button 
                                onClick={() => setActiveMobilePage('add-product-voice')}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white w-full py-4 rounded-full font-bold shadow-lg shadow-indigo-900/20 active:scale-95 transition-all text-lg flex items-center justify-center gap-2"
                            >
                                <Mic size={20} /> Record Voice
                            </button>
                            
                            <button 
                                onClick={() => setActiveMobilePage('add-product-edit')}
                                className="mt-4 text-zinc-500 font-bold active:opacity-50 underline underline-offset-4"
                            >
                                Enter Manually Instead
                            </button>
                        </div>
                    </div>
                )}

                {activeMobilePage === 'add-product-voice' && (
                    <div className="flex flex-col h-full w-full absolute inset-0 bg-[#030712] z-[80] animate-in slide-in-from-right duration-200">
                        <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center px-4 shrink-0 shadow-sm relative">
                            <button onClick={() => setActiveMobilePage('add-product')} className="absolute left-4 p-2 -m-2 text-indigo-400 active:opacity-50 flex items-center gap-1 z-10">
                                <ChevronLeft size={24} /> <span className="text-base font-semibold">Back</span>
                            </button>
                        </div>
                        <div className="flex-1 p-6 flex flex-col items-center justify-center">
                            {audioPreviewUrl ? (
                                <div className="w-full flex flex-col items-center">
                                    <audio controls src={audioPreviewUrl} className="w-full mb-8 h-12" />
                                    <button 
                                        onClick={() => setActiveMobilePage('add-product-edit')}
                                        className="bg-emerald-600 text-white w-full py-4 rounded-full font-bold shadow-lg active:scale-95 transition-all text-lg flex items-center justify-center gap-2 mb-4"
                                    >
                                        <Edit3 size={20} /> Next: Edit Details
                                    </button>
                                    <button onClick={() => {setAudioBlob(null); setAudioPreviewUrl(null);}} className="text-red-400 font-bold p-4 active:opacity-50">
                                        Retake Audio
                                    </button>
                                </div>
                            ) : (
                                <div className="w-full flex flex-col items-center">
                                    <div className={\`w-32 h-32 rounded-full flex items-center justify-center mb-8 shadow-xl transition-all \${isRecording ? 'bg-red-500/20 shadow-red-500/20 scale-105' : 'bg-[#18181b]'}\`}>
                                        <div className={\`w-24 h-24 rounded-full flex items-center justify-center \${isRecording ? 'bg-red-500 animate-pulse' : 'bg-[#27272a]'}\`}>
                                            <Mic size={40} className="text-white" />
                                        </div>
                                    </div>
                                    {isRecording ? (
                                        <>
                                            <p className="text-3xl font-mono font-bold text-white mb-8">Recording...</p>
                                            <button onClick={stopRecording} className="bg-white text-black w-full py-4 rounded-full font-bold text-lg active:scale-95 shadow-lg flex items-center justify-center gap-2">
                                                <Square size={20} /> Stop Recording
                                            </button>
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
                )}

                {activeMobilePage === 'add-product-edit' && (
                    <div className="flex flex-col h-full w-full absolute inset-0 bg-[#09090b] z-[90] animate-in slide-in-from-right duration-200">
                        <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center px-4 shrink-0 shadow-sm relative">
                            <button onClick={() => setActiveMobilePage(audioPreviewUrl ? 'add-product-voice' : 'add-product')} className="absolute left-4 p-2 -m-2 text-indigo-400 active:opacity-50 flex items-center gap-1 z-10">
                                <ChevronLeft size={24} /> <span className="text-base font-semibold">Back</span>
                            </button>
                            <button onClick={handleSubmit} disabled={loading} className="absolute right-4 p-2 -m-2 text-emerald-400 active:opacity-50 font-bold text-base">
                                {loading ? 'Saving' : 'Save'}
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 pb-12 space-y-6">
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

                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest pl-2">Media</label>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="col-span-3">
                                        <input type="file" multiple accept="image/*" onChange={handleImageSelect} className="hidden" id="file-images-mob" />
                                        <label htmlFor="file-images-mob" className="flex items-center justify-center gap-3 h-16 bg-[#18181b] border border-white/5 rounded-2xl active:bg-white/5 transition-all cursor-pointer">
                                            <Camera size={20} className="text-zinc-400" />
                                            <span className="text-base font-semibold text-zinc-200">Add Photos</span>
                                        </label>
                                        {productImages && productImages.length > 0 && (
                                            <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                                                {productImages.map((img, i) => (
                                                    <div key={i} className="w-20 h-20 rounded-xl bg-[#18181b] shrink-0 border border-white/10 overflow-hidden relative">
                                                        <img src={img.url} className="w-full h-full object-cover" />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="col-span-3">
                                        <input type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" id="file-video-mob" />
                                        <label htmlFor="file-video-mob" className="flex items-center justify-center gap-3 h-16 bg-[#18181b] border border-white/5 rounded-2xl active:bg-white/5 transition-all cursor-pointer">
                                            <Video size={20} className="text-zinc-400" />
                                            <span className="text-base font-semibold text-zinc-200">{selectedVideo ? 'Video Selected' : 'Add Video'}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}`;
    
    wd = wd.substring(0, startIndex) + newAddProductView + wd.substring(endIndex);
    
    // Add Edit3 to imports if missing
    if (!wd.includes('Edit3')) {
        wd = wd.replace('import {', 'import { Edit3,');
    }
    
    fs.writeFileSync('src/components/WhatsAppDashboard.tsx', wd);
    console.log('Fixed WhatsAppDashboard AddProduct UI');
} else {
    console.log('Could not find startMarker in WhatsAppDashboard');
}
