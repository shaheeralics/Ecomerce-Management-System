import WhatsAppDashboard from './components/WhatsAppDashboard';

function App() {
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
      </nav>

      {/* Main Full-Bleed Content Workspace */}
      <main className="flex-1 overflow-hidden relative">
        <WhatsAppDashboard />
      </main>
    </div>
  );
}

export default App;
