import React, { useState } from 'react';
import { Key, Info, CheckCircle, Copy, Shield, Sparkles, Store } from 'lucide-react';

const apiGuidanceData = {
  metaToken: {
    title: 'How to get Meta WhatsApp Token',
    content: '1. Go to the Meta for Developers portal (developers.facebook.com).\n2. Create an App with "Business" type.\n3. Add the "WhatsApp" product to your app.\n4. Under WhatsApp > API Setup, you will find the "Temporary access token".\n5. For a permanent token, create a System User in Facebook Business Manager with whatsapp_business_messaging permissions.'
  },
  metaPhoneId: {
    title: 'How to get Meta Phone Number ID',
    content: '1. In Meta Developer App, go to WhatsApp > API Setup.\n2. In the "Send and receive messages" section, copy the "Phone number ID".'
  },
  metaVerifyToken: {
    title: 'How to set Meta Verify Token',
    content: 'This is a custom token string! Enter any secure string and match it in your Meta Webhook setup.'
  },
  llmApiKey: {
    title: 'How to get LLM API Key',
    content: 'For Gemini: Go to Google AI Studio (aistudio.google.com) and click "Get API Key".\nFor OpenAI: Go to platform.openai.com/api-keys.'
  },
  shopifyUrl: {
    title: 'How to get Shopify Store URL',
    content: 'Your store myshopify domain. Example: my-store.myshopify.com (without https://).'
  },
  shopifyToken: {
    title: 'How to get Shopify Access Token',
    content: '1. In Shopify Admin, go to Settings > Apps and sales channels > Develop apps.\n2. Create app and configure Admin API scopes (`write_products`, `read_products`).\n3. Install app and copy Admin API access token.'
  },
  shopifyWebhookSecret: {
    title: 'How to get Shopify Webhook Secret',
    content: 'In Shopify Admin > Settings > Notifications > Webhooks, copy the signing secret.'
  }
};

const ApiSettings = () => {
  const [activeGuidance, setActiveGuidance] = useState<keyof typeof apiGuidanceData | null>(null);
  const [activeApiTab, setActiveApiTab] = useState<'whatsapp' | 'llm' | 'shopify'>('whatsapp');
  
  const [formData, setFormData] = useState({
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

  React.useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.metaToken !== undefined) {
          setFormData(prev => ({ ...prev, ...data }));
        }
      })
      .catch(() => console.log('Database connection error'));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!response.ok) throw new Error('Database error');
      alert('API Settings saved permanently to MySQL Database!');
    } catch (e) {
      alert('Error: Backend database connection failed.');
    }
  };

  return (
    <div className="h-full w-full bg-[#071317] flex overflow-hidden">
      {/* Sidebar Tabs */}
      <div className="w-64 bg-[#0A181D] border-r border-teal-900/30 flex flex-col p-4 flex-shrink-0">
        <div className="flex items-center gap-3 px-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <Key size={18} />
          </div>
          <h2 className="text-sm font-bold text-slate-100">Global Credentials</h2>
        </div>
        <nav className="flex flex-col space-y-1.5">
            <button 
                onClick={() => setActiveApiTab('whatsapp')}
                className={`text-left px-4 py-3 rounded-xl font-medium text-xs transition-all flex items-center gap-3 ${
                    activeApiTab === 'whatsapp' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30 font-semibold' : 'text-slate-400 hover:bg-teal-950/40 hover:text-slate-200'
                }`}
            >
                <Shield size={16} /> WhatsApp API
            </button>
            <button 
                onClick={() => setActiveApiTab('llm')}
                className={`text-left px-4 py-3 rounded-xl font-medium text-xs transition-all flex items-center gap-3 ${
                    activeApiTab === 'llm' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30 font-semibold' : 'text-slate-400 hover:bg-teal-950/40 hover:text-slate-200'
                }`}
            >
                <Sparkles size={16} /> LLM AI Settings
            </button>
            <button 
                onClick={() => setActiveApiTab('shopify')}
                className={`text-left px-4 py-3 rounded-xl font-medium text-xs transition-all flex items-center gap-3 ${
                    activeApiTab === 'shopify' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30 font-semibold' : 'text-slate-400 hover:bg-teal-950/40 hover:text-slate-200'
                }`}
            >
                <Store size={16} /> Shopify API
            </button>
        </nav>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-8 bg-[#071317] overflow-auto">
        
        {/* Modal Guidance */}
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

        <div className="max-w-4xl space-y-6">
          
          {/* WhatsApp Settings */}
          {activeApiTab === 'whatsapp' && (
            <section className="bg-[#09181E] border border-teal-900/40 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-lg font-bold text-slate-100 pb-3 border-b border-teal-900/30">Meta WhatsApp API Credentials</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">WhatsApp Access Token</label>
                  <div className="flex gap-2">
                    <input type="password" name="metaToken" value={formData.metaToken} onChange={handleChange}
                      className="flex-1 bg-[#050D10] border border-teal-900/50 rounded-xl px-3.5 py-2 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-teal-500" placeholder="EA..." />
                    <button type="button" onClick={() => setActiveGuidance('metaToken')} className="bg-[#0D222A] text-teal-300 hover:bg-teal-950/60 border border-teal-800/30 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1">
                      <Info size={14} /> Guide
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number ID</label>
                  <div className="flex gap-2">
                    <input type="text" name="metaPhoneId" value={formData.metaPhoneId} onChange={handleChange}
                      className="flex-1 bg-[#050D10] border border-teal-900/50 rounded-xl px-3.5 py-2 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-teal-500" placeholder="101234567890123" />
                    <button type="button" onClick={() => setActiveGuidance('metaPhoneId')} className="bg-[#0D222A] text-teal-300 hover:bg-teal-950/60 border border-teal-800/30 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1">
                      <Info size={14} /> Guide
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Meta App ID</label>
                  <input type="text" name="metaAppId" value={formData.metaAppId} onChange={handleChange}
                    className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-3.5 py-2 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-teal-500" placeholder="987654321..." />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Meta App Secret</label>
                  <input type="password" name="metaAppSecret" value={formData.metaAppSecret} onChange={handleChange}
                    className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-3.5 py-2 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-teal-500" placeholder="App Secret" />
                </div>

                <div className="pt-4 border-t border-teal-900/30">
                  <label className="block text-xs font-semibold text-teal-400 mb-1">Auto-Generated Webhook Callback URL</label>
                  <div className="flex gap-2">
                    <input type="text" readOnly value={formData.webhookUrl || ''} 
                      className="flex-1 bg-[#050D10] border border-teal-900/50 rounded-xl px-3.5 py-2 text-xs text-slate-400 font-mono" />
                    <button type="button" onClick={() => { if(formData.webhookUrl) { navigator.clipboard.writeText(formData.webhookUrl); alert('Copied!'); } }}
                      className="bg-teal-600 hover:bg-teal-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                      <Copy size={14} /> Copy URL
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* LLM Settings */}
          {activeApiTab === 'llm' && (
            <section className="bg-[#09181E] border border-teal-900/40 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-lg font-bold text-slate-100 pb-3 border-b border-teal-900/30">LLM AI Provider Key</h3>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">AI Provider API Key (Gemini / OpenAI)</label>
                <div className="flex gap-2">
                  <input type="password" name="llmApiKey" value={formData.llmApiKey} onChange={handleChange}
                    className="flex-1 bg-[#050D10] border border-teal-900/50 rounded-xl px-3.5 py-2 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-teal-500" placeholder="AI Key" />
                  <button type="button" onClick={() => setActiveGuidance('llmApiKey')} className="bg-[#0D222A] text-teal-300 hover:bg-teal-950/60 border border-teal-800/30 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1">
                    <Info size={14} /> Guide
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Shopify Settings */}
          {activeApiTab === 'shopify' && (
            <section className="bg-[#09181E] border border-teal-900/40 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-lg font-bold text-slate-100 pb-3 border-b border-teal-900/30">Shopify API Integration</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Store URL</label>
                  <input type="text" name="shopifyUrl" value={formData.shopifyUrl} onChange={handleChange}
                    className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-3.5 py-2 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-teal-500" placeholder="your-store.myshopify.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Admin API Access Token</label>
                  <input type="password" name="shopifyToken" value={formData.shopifyToken} onChange={handleChange}
                    className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-3.5 py-2 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-teal-500" placeholder="shpat_..." />
                </div>
              </div>
            </section>
          )}

          <div className="flex justify-end pt-4">
            <button onClick={handleSave} className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-lg shadow-teal-600/30 flex items-center gap-2">
              <CheckCircle size={16} /> Save Global Credentials
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

export default ApiSettings;
