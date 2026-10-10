import WhatsAppDashboard from './components/WhatsAppDashboard';

function App() {
  return (
    <div className="h-screen w-screen bg-[#071317] text-slate-100 flex flex-col overflow-hidden font-sans">
      {/* Main Full-Bleed Content Workspace */}
      <main className="flex-1 overflow-hidden relative">
        <WhatsAppDashboard />
      </main>
    </div>
  );
}

export default App;
