const fs = require('fs');

// Fix AIAgentPanel.tsx
let ap = fs.readFileSync('src/components/AIAgentPanel.tsx', 'utf8');

// Use Regex to replace the entire activeMobileView === 'chat' block
// We can find the start and end by index.
const startMarker = "    if (activeMobileView === 'chat') {";
const endMarker = "        );\n    }";

const startIndex = ap.indexOf(startMarker);
if (startIndex !== -1) {
    const endIndex = ap.indexOf(endMarker, startIndex) + endMarker.length;
    
    const newChatView = `    if (activeMobileView === 'chat') {
        return (
            <div className="absolute inset-0 z-50 bg-[#0b141a] flex flex-col animate-in slide-in-from-right duration-200 md:hidden">
                <div className="h-14 bg-[#202c33] flex items-center px-2 justify-between shrink-0 shadow-sm">
                    <button onClick={() => setActiveMobileView(null)} className="p-2 text-white active:opacity-50 flex items-center gap-1">
                        <ChevronLeft size={28} />
                        <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center overflow-hidden border border-white/10">
                            <Bot size={20} className="text-indigo-200"/>
                        </div>
                    </button>
                    <button onClick={clearChat} className="p-3 text-white/80 active:opacity-50">
                        <Trash2 size={20} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 bg-[#0b141a] relative custom-scrollbar">
                    <div className="relative z-10 space-y-2">
                        {messages.length === 0 && (
                            <div className="flex justify-center mt-4">
                                <span className="bg-[#182229] text-[#8696a0] text-[11px] font-bold px-3 py-1 rounded-lg shadow-sm">Today</span>
                            </div>
                        )}
                        {messages.map(msg => (
                            <div key={msg.id} className={\`flex \${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full\`}>
                                <div className={\`max-w-[85%] rounded-lg px-2 pt-2 pb-1 text-[15px] shadow-sm relative \${
                                    msg.role === 'user' ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
                                    : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
                                }\`}>
                                    {msg.content && <p className="whitespace-pre-wrap leading-tight">{msg.content}</p>}
                                    <div className="text-[10px] text-right mt-1 opacity-60 flex justify-end items-center gap-1 float-right ml-3">
                                        {msg.timestamp.toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit'})}
                                    </div>
                                    <div className="clear-both" />
                                </div>
                            </div>
                        ))}
                        {sending && (
                            <div className="flex justify-start w-full">
                                <div className="bg-[#202c33] text-[#e9edef] rounded-lg rounded-tl-none px-3 py-2 text-[13px] shadow-sm italic opacity-70">
                                    Typing...
                                </div>
                            </div>
                        )}
                    </div>
                    <div ref={chatEndRef} className="h-4" />
                </div>
                <div className="p-1.5 pb-safe bg-[#0b141a] flex items-end gap-1.5 w-full shrink-0">
                    <div className="flex-1 bg-[#2a2f32] rounded-3xl min-h-[44px] max-h-[100px] overflow-y-auto flex items-end px-4 py-2.5 shadow-sm">
                        <input 
                            type="text" 
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSendText()}
                            placeholder="Message" 
                            className="w-full bg-transparent text-[15px] text-zinc-100 outline-none leading-tight"
                        />
                    </div>
                    {inputText ? (
                        <button onClick={handleSendText} className="w-[44px] h-[44px] rounded-full bg-[#00a884] text-white flex items-center justify-center shrink-0 shadow-md active:scale-95 transition-transform">
                            <Send size={20} className="ml-0.5" />
                        </button>
                    ) : (
                        <button className="w-[44px] h-[44px] rounded-full bg-[#00a884] text-white flex items-center justify-center shrink-0 shadow-md active:scale-95 transition-transform">
                            <Mic size={20} />
                        </button>
                    )}
                </div>
            </div>
        );
    }`;

    ap = ap.substring(0, startIndex) + newChatView + ap.substring(endIndex);
    fs.writeFileSync('src/components/AIAgentPanel.tsx', ap);
}

console.log('Done Agent');
