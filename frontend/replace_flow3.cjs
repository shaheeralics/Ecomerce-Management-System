const fs = require('fs');
let wd = fs.readFileSync('src/components/WhatsAppDashboard.tsx', 'utf8');

const startMarker = "{/* 4) ADD PRODUCT MOBILE NATIVE SCREEN (Stack Navigation) */}";
const endMarker = "            </div>\n\n            {/* Global Media Preview */}"; 

const startIndex = wd.indexOf(startMarker);
const endIndex = wd.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.log("Could not find markers!");
    process.exit(1);
}

const replacement = `                {/* 4) ADD PRODUCT MOBILE NATIVE SCREEN (Stack Navigation) */}
                {activeMobilePage === 'add-product' && (
                    <div className="flex flex-col h-full w-full absolute inset-0 bg-[#030712] z-[70] animate-in slide-in-from-right duration-200">
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
                )}

                {activeMobilePage === 'add-product-text' && (
                    <div className="flex flex-col h-full w-full absolute inset-0 bg-[#09090b] z-[80] animate-in slide-in-from-right duration-200">
                        <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center px-4 shrink-0 shadow-sm relative">
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
                )}

                {activeMobilePage === 'add-product-media' && (
                    <div className="flex flex-col h-full w-full absolute inset-0 bg-[#09090b] z-[80] animate-in slide-in-from-right duration-200">
                        <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center px-4 shrink-0 shadow-sm relative">
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
                                        onClick={() => setActiveMobilePage('add-product-voice-edit')}
                                        className="bg-indigo-600 text-white w-full py-4 rounded-full font-bold shadow-lg active:scale-95 transition-all text-lg flex items-center justify-center gap-2 mb-4"
                                    >
                                        <Edit3 size={20} /> Advanced Edit
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
                                            <div className="flex gap-4 w-full">
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
                )}

                {activeMobilePage === 'add-product-voice-edit' && (
                    <div className="flex flex-col h-full w-full absolute inset-0 bg-[#030712] z-[90] animate-in slide-in-from-right duration-200">
                        <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center px-4 shrink-0 shadow-sm relative z-50">
                            <button onClick={() => setActiveMobilePage('add-product-voice')} className="absolute left-4 p-2 -m-2 text-indigo-400 active:opacity-50 flex items-center gap-1 z-10">
                                <ChevronLeft size={24} /> <span className="text-base font-semibold">Cancel</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden relative">
                            <VoiceAssetsTab category="policy" title="Product Voice Editor" description="" standaloneMode={true} standaloneBlob={audioBlob} onStandaloneSave={(blob) => { setAudioBlob(blob); setAudioPreviewUrl(URL.createObjectURL(blob)); setActiveMobilePage('add-product-voice'); }} />
                        </div>
                    </div>
                )}\n`;

let newWd = wd.substring(0, startIndex) + replacement + "\n" + wd.substring(endIndex);

if (!newWd.includes('ImageIcon')) {
    newWd = newWd.replace(/import \{([^}]+)\} from 'lucide-react';/, "import { $1, ImageIcon } from 'lucide-react';");
}

fs.writeFileSync('src/components/WhatsAppDashboard.tsx', newWd);
console.log('Done replacement');
