import { useState } from 'react';
import WhatsAppDashboard from './components/WhatsAppDashboard';
import ShopifyDashboard from './components/ShopifyDashboard';
import { MessageSquare, ShoppingBag } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'shopify'>('whatsapp');

  return (
    <div className="h-screen w-screen bg-[#071317] text-slate-100 flex flex-col overflow-hidden font-sans">
      {/* Devsil Top Navbar */}
      <nav className="bg-[#0A1A20] border-b border-teal-900/40 px-6 py-3 flex items-center justify-between flex-shrink-0 z-30 shadow-lg">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 p-1 flex items-center justify-center shadow-md shadow-teal-500/10">
            <img src="/devsil-logo.png" alt="Devsil Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 tracking-tight flex items-center gap-2">
              DEVSIL <span className="text-teal-400 text-xs font-semibold px-2 py-0.5 rounded bg-teal-950/80 border border-teal-800/60 uppercase">Ecommerce Automation</span>
            </h1>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-[#061014] p-1 rounded-xl border border-teal-900/30">
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'whatsapp' 
                ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-teal-950/40'
            }`}
          >
            <MessageSquare size={16} />
            WhatsApp Agent
          </button>
        </div>
      </nav>

      {/* Main Full-Bleed Content Workspace */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'whatsapp' && <WhatsAppDashboard />}
        {activeTab === 'shopify' && <ShopifyDashboard />}
      </main>
    </div>
  );
}

export default App;
