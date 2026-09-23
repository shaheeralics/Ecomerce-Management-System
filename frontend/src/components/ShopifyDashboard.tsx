import { useState } from 'react';
import { ShoppingBag, Upload, CheckCircle } from 'lucide-react';

const ShopifyDashboard = () => {
    const [, setImages] = useState<File[]>([]);
    const [, setLabels] = useState<string[]>([]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files);
            setImages(prev => [...prev, ...filesArray]);
            setLabels(prev => [...prev, ...filesArray.map(() => 'Other')]);
        }
    };

    return (
        <div className="h-full w-full bg-[#071317] p-8 overflow-auto">
            <div className="max-w-4xl mx-auto bg-[#09181E] border border-teal-900/40 rounded-2xl p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-teal-900/30">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                        <ShoppingBag size={22} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-100">Shopify Listing Automator</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Upload product images and details to auto-generate & sync Shopify store listings.</p>
                    </div>
                </div>

                <form className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Brand Name</label>
                            <input type="text" className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-teal-500" placeholder="e.g. Nike" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Gender Category</label>
                            <select className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-teal-500">
                                <option value="men">Men</option>
                                <option value="women">Women</option>
                                <option value="unisex">Unisex</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Original Size</label>
                            <input type="text" className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-teal-500" placeholder="e.g. 42" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Starting Price</label>
                                <input type="number" className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-teal-500" placeholder="150" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Minimum Price</label>
                                <input type="number" className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-teal-500" placeholder="100" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">Rough Description</label>
                        <textarea 
                            className="w-full h-28 bg-[#050D10] border border-teal-900/50 rounded-xl p-3 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-teal-500 resize-none" 
                            placeholder="Type some rough details about the product..."
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-2">Product Images</label>
                        <div className="border-2 border-dashed border-teal-900/40 hover:border-teal-500 rounded-xl p-6 bg-[#050D10] text-center cursor-pointer transition-all group">
                            <input type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden" id="shopify-image-upload" />
                            <label htmlFor="shopify-image-upload" className="cursor-pointer block">
                                <div className="w-10 h-10 rounded-full bg-teal-950/60 group-hover:bg-teal-600/20 text-teal-400 flex items-center justify-center mx-auto mb-2 transition-colors">
                                    <Upload size={20} />
                                </div>
                                <span className="text-xs font-semibold text-teal-400 group-hover:underline">Click to browse product photos</span>
                                <p className="text-[11px] text-slate-500 mt-1">Images will be uploaded to Shopify CDN</p>
                            </label>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-teal-900/30 flex justify-end">
                        <button type="button" className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-lg shadow-teal-600/30 flex items-center gap-2">
                            <CheckCircle size={16} /> Automate Publish to Shopify
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ShopifyDashboard;
