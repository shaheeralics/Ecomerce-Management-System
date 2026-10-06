import { useState, useEffect, useRef } from 'react';
import { Search, ChevronLeft, MoreVertical, Paperclip, Image as ImageIcon, FileText, Smile, Mic, Send, MapPin, Phone, Mail, ShoppingBag, User, XCircle, Bot, UserCheck, MessageSquare, Video, Plus } from 'lucide-react';
import OrderDetailPage from './OrderDetailPage'; // Assuming this exists for modal
import AddOrderModal from './AddOrderModal';

interface Conversation { [key: string]: any }

interface Message {
    id: number;
    sender: 'customer' | 'agent' | 'human';
    type: string;
    text_content?: string;
    media_url?: string;
    created_at: string;
}

export default function LiveConversations() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConvId, setActiveConvId] = useState<number | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [filter, setFilter] = useState<'all'|'unread'|'open'|'closed'>('all');
    const [search, setSearch] = useState('');
    const [composeText, setComposeText] = useState('');
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    
    // Modals
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
    const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
    
    // Profile View State
    const [showProfile, setShowProfile] = useState(false);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch conversations
    const loadConversations = async () => {
        try {
            const res = await fetch('/api/conversations');
            const data = await res.json();
            if (data.data) {
                setConversations(data.data);
            } else {
                setErrorMsg(data.error || 'Failed to fetch conversations');
            }
        } catch (e) {
            console.error(e);
            setErrorMsg('Network error while fetching conversations');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConversations();
        const interval = setInterval(loadConversations, 5000);


    return () => clearInterval(interval);
    }, []);

    // Fetch messages & orders for active conversation
    useEffect(() => {
        if (!activeConvId) return;
        let isFirstLoad = true;
        const loadActiveData = async () => {
            try {
                // Fetch Messages
                const res = await fetch(`/api/conversations/${activeConvId}/messages`);
                const data = await res.json();
                if (data.data) {
                    setMessages(prev => {
                        const prevLastMsgId = prev.length > 0 ? prev[prev.length - 1].id : null;
                        const newLastMsgId = data.data.length > 0 ? data.data[data.data.length - 1].id : null;

                        if (isFirstLoad || prevLastMsgId !== newLastMsgId) {
                            setTimeout(() => {
                                messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
                            }, 50);
                        }
                        return data.data;
                    });
                    isFirstLoad = false;
                }
            } catch (e) { console.error(e); }
        };
        loadActiveData();
        const interval = setInterval(loadActiveData, 3000);
        return () => clearInterval(interval);
    }, [activeConvId]);

    // Fetch orders when conversation changes
    useEffect(() => {
        if (!activeConvId) return;
        const conv = conversations.find(c => c.id === activeConvId);
        if (!conv) return;
        const loadOrders = async () => {
            try {
                const res = await fetch(`/api/orders/customers/${encodeURIComponent(conv.customer_phone)}/orders`);
                const data = await res.json();
                if (data.success) {
                    setRecentOrders(data.data);
                }
            } catch (e) { console.error(e); }
        };
        loadOrders();
    }, [activeConvId, conversations]);

    const activeConv = conversations.find(c => c.id === activeConvId);
    let knownSlots = activeConv?.known_slots;
    if (typeof knownSlots === 'string') {
        try { knownSlots = JSON.parse(knownSlots); } catch (e) {}
    }
    const customerName = activeConv?.customer_name || knownSlots?.name || `Customer ${activeConv?.id || ''}`;
    
    const handleSend = async () => {
        if (!composeText.trim() || !activeConvId) return;
        const text = composeText;
        setComposeText('');
        try {
            await fetch(`/api/conversations/${activeConvId}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'text', content: text })
            });
            // Instantly append local message
            setMessages(prev => [...prev, { id: Date.now(), sender: 'human', type: 'text', text_content: text, created_at: new Date().toISOString() }]);
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        } catch (e) {
            console.error(e);
        }
    };

    const handleToggleTakeover = async () => {
        if (!activeConvId) return;
        const currentConv = conversations.find(c => c.id === activeConvId);
        const isCurrentlyTakeover = currentConv?.status === 'human_takeover';
        const newStatus = isCurrentlyTakeover ? 'agent_active' : 'human_takeover';

        try {
            // Optimistically update conversation state immediately
            setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, status: newStatus } : c));

            await fetch(`/api/conversations/${activeConvId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            loadConversations();
        } catch (e) {
            console.error('Failed to update conversation status:', e);
            loadConversations();
        }
    };

    const filteredConvs = conversations.filter((c: any) => {
        if (filter === 'open' && c.status === 'closed') return false;
        if (filter === 'closed' && c.status !== 'closed') return false;
        // Search
        if (search) {
            const s = search.toLowerCase();
            const phone = c.customer_phone || c.phone_number || '';
            return phone.includes(s) || (c.customer_name && c.customer_name.toLowerCase().includes(s)) || (c.known_slots && JSON.stringify(c.known_slots).toLowerCase().includes(s));
        }
        return true;
    });

    return (
        <div className="fixed inset-0 h-[100dvh] w-full bg-[#030712] text-zinc-100 flex font-sans overflow-hidden overscroll-none">
            
            {/* ======================================= */}
            {/* ========== DESKTOP VIEW =============== */}
            {/* ======================================= */}
            <div className="hidden md:flex w-full h-full relative">
                {/* Left Pane - Chat List */}
                <div className="w-[350px] border-r border-white/5 bg-[#09090b] flex flex-col shrink-0 h-full">
                    <div className="p-4 border-b border-white/5 bg-[#09090b] z-10">
                        <div className="flex gap-2 p-1 bg-[#18181b] rounded-xl overflow-hidden shadow-inner border border-white/5">
                            {['all', 'unread', 'open', 'closed'].map(f => (
                                <button 
                                    key={f}
                                    onClick={() => setFilter(f as any)}
                                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${filter === f ? 'bg-white text-black shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                        {loading ? (
                            <div className="p-8 text-center text-zinc-500 text-sm">Loading conversations...</div>
                        ) : conversations.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500 text-sm flex flex-col items-center">
                                <MessageSquare size={32} className="mb-3 text-zinc-700" />
                                <p>No conversations found</p>
                            </div>
                        ) : (
                            filteredConvs.map(conv => (
                                <div 
                                    key={conv.id} 
                                    onClick={() => { setActiveConvId(conv.id); setShowProfile(false); }}
                                    className={`p-4 border-b border-white/5 cursor-pointer transition-all hover:bg-white/5 flex gap-3 ${activeConvId === conv.id ? 'bg-white/5 border-l-2 border-l-white' : 'border-l-2 border-l-transparent'}`}
                                >
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full bg-[#18181b] border border-white/10 flex items-center justify-center text-zinc-400 font-bold shrink-0">
                                            {conv.customer_name ? String(conv.customer_name).substring(0, 2).toUpperCase() : <User size={20} />}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-bold text-sm text-zinc-100 truncate">{conv.customer_name || conv.customer_phone}</h4>
                                            {conv.last_message_at && (
                                                <span className="text-[10px] text-zinc-500 shrink-0">{new Date(conv.last_message_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-zinc-400 truncate max-w-[200px]">
                                            {conv.last_message || 'Tap to view conversation'}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Pane - Chat Window & Profile */}
                <div className="flex-1 bg-[#030712] flex h-full relative">
                    {activeConvId ? (
                        <>
                            <div className="flex-1 flex flex-col h-full relative border-r border-white/5 transition-all duration-300">
                                {/* Chat Header */}
                                <div className="h-16 bg-[#09090b] border-b border-white/5 flex items-center px-6 justify-between shrink-0 shadow-sm z-10 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setShowProfile(!showProfile)}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[#18181b] flex items-center justify-center font-bold text-zinc-300">
                                            {activeConv?.customer_name ? String(activeConv.customer_name).substring(0, 2).toUpperCase() : <User size={18} />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white leading-tight">{activeConv?.customer_name || activeConv?.phone_number}</h3>
                                            <p className="text-xs text-zinc-500">{activeConv?.phone_number}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Chat Messages */}
                                <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-[#030712]">
                                    {messages.map((msg, idx) => {
                                        const isCustomer = msg.sender === 'customer';
                                        const isAgent = msg.sender === 'agent';
                                        
                                        return (
                                            <div key={msg.id || idx} className={`flex flex-col mb-4 ${isCustomer ? 'items-start' : 'items-end'}`}>
                                                <div className={`max-w-[75%] p-3 text-sm shadow-md rounded-2xl ${
                                                    isCustomer 
                                                        ? 'bg-[#18181b] border border-white/5 text-zinc-300 rounded-tl-sm' 
                                                        : isAgent 
                                                            ? 'bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-tr-sm' 
                                                            : 'bg-white text-black rounded-tr-sm font-medium'
                                                }`}>
                                                    {msg.text_content && <p className="whitespace-pre-wrap break-words break-all">{msg.text_content}</p>}
                                                    {msg.media_url && (
                                                        <div className="mt-2 rounded-lg overflow-hidden border border-white/10">
                                                            {msg.type === 'image' ? <img src={msg.media_url} className="w-full h-auto max-h-48 object-cover" /> 
                                                            : (msg.type === 'video' || msg.media_url.includes('.mp4')) ? (
                                                                <video controls className="w-full max-w-[250px] rounded-lg outline-none" preload="metadata">
                                                                    <source src={msg.media_url} type="video/mp4" />
                                                                </video>
                                                            )
                                                            : (msg.type === 'audio' || msg.media_url.includes('.ogg') || msg.media_url.includes('.mp3')) ? (
                                                                <div className="bg-[#09090b] rounded-xl p-2 border border-white/5 shadow-inner">
                                                                    <audio controls preload="metadata" className="w-full max-w-[250px] h-10 outline-none"><source src={msg.media_url} /></audio>
                                                                </div>
                                                            )
                                                            : <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline text-xs break-all">{msg.media_url}</a>}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`text-[10px] text-zinc-500 mt-1 flex gap-1 ${isCustomer ? 'ml-1' : 'mr-1'}`}>
                                                    <span>{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                    {!isCustomer && <span>••</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Chat Input Box */}
                                <div className="p-4 border-t border-white/5 bg-[#09090b]">
                                    <div className="flex items-center gap-2">
                                        <button className="text-zinc-500 hover:text-white p-2 transition-colors"><Paperclip size={18} /></button>
                                        
                                        <div className="flex-1 bg-[#18181b] border border-white/5 rounded-full px-4 py-3 flex items-center gap-2 focus-within:ring-1 focus-within:ring-white/20">
                                            <input 
                                                type="text" 
                                                value={composeText}
                                                onChange={e => setComposeText(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                                                placeholder="Message..." 
                                                className="w-full bg-transparent text-sm text-zinc-100 outline-none"
                                            />
                                        </div>
                                        
                                        {composeText ? (
                                            <button onClick={handleSend} className="bg-white hover:bg-zinc-200 text-black p-3 rounded-full font-bold transition-all shadow-lg shadow-white/10">
                                                <Send size={18} />
                                            </button>
                                        ) : (
                                            <button className="bg-[#18181b] border border-white/5 hover:bg-white/10 text-white p-3 rounded-full font-bold transition-all">
                                                <Mic size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Profile Pane */}
                            {showProfile && (
                                <div className="w-[300px] bg-[#09090b] flex flex-col border-l border-white/5 h-full animate-in slide-in-from-right duration-200 shadow-2xl shrink-0">
                                    <div className="p-6 border-b border-white/5 text-center flex flex-col items-center shrink-0">
                                        <div className="w-20 h-20 rounded-full bg-[#18181b] border-2 border-white/10 flex items-center justify-center font-bold text-3xl text-zinc-400 mb-3 shadow-xl">
                                            {activeConv?.customer_name ? String(activeConv.customer_name).substring(0, 2).toUpperCase() : <User size={32} />}
                                        </div>
                                        <h3 className="font-bold text-lg text-white">{activeConv?.customer_name || 'Unknown User'}</h3>
                                        <p className="text-sm text-zinc-500 flex items-center gap-1 mt-1 justify-center"><Phone size={12} /> {activeConv?.phone_number}</p>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                        <div className="bg-[#18181b] rounded-2xl p-4 border border-white/5 shadow-sm">
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="font-bold text-sm text-white flex items-center gap-2"><ShoppingBag size={14} className="text-indigo-400" /> Recent Orders</h4>
                                                <button onClick={() => setIsCreateOrderOpen(true)} className="text-[10px] bg-white text-black px-2 py-1 rounded-md font-bold hover:bg-zinc-200">NEW</button>
                                            </div>
                                            {recentOrders.length === 0 ? (
                                                <p className="text-xs text-zinc-500 text-center py-4">No recent orders</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {recentOrders.map(o => (
                                                        <div key={o.id} onClick={() => { setSelectedOrderId(o.id); setIsOrderModalOpen(true); }} className="text-xs bg-[#09090b] p-3 rounded-xl border border-white/5 cursor-pointer hover:border-white/20 transition-all flex justify-between items-center">
                                                            <div><span className="font-bold text-white">#{o.id}</span> <span className="text-zinc-500 ml-1">{new Date(o.created_at).toLocaleDateString()}</span></div>
                                                            <div className="font-bold text-white">Rs {o.total_amount}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 bg-[#030712]">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                <MessageSquare size={24} className="text-zinc-500" />
                            </div>
                            <p className="font-medium text-sm">Select a conversation to start chatting</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ======================================= */}
            {/* ========== MOBILE VIEW ================ */}
            {/* ======================================= */}
            <div className="md:hidden flex h-[100dvh] w-full bg-[#030712] relative overflow-hidden">
                
                {/* Mobile Full Screen Chat List (Edge-to-Edge) */}
                <div className="flex flex-col w-full h-full bg-[#030712] overflow-hidden">
                    {/* Mobile Header */}
                    <div className="pt-2 bg-[#09090b]/95 backdrop-blur-xl border-b border-white/5 shrink-0 z-50">
                        <div className="px-4 py-3 flex items-center justify-between gap-3">
                            <h1 className="text-xl font-bold tracking-tight text-white">Messages</h1>
                            <div className="flex-1 flex justify-end">
                                <div className="relative w-full max-w-[200px]">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                    <input type="text" placeholder="Search chats..." value={search} onChange={e => setSearch(e.target.value)} className="bg-[#18181b] text-sm text-white rounded-full pl-9 pr-4 py-2 w-full outline-none border border-white/5 focus:border-indigo-500/50 transition-all" />
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto w-full custom-scrollbar pt-0 pb-[85px]">
                        {loading ? (
                            <div className="p-8 text-center text-zinc-500 text-sm">Loading chats...</div>
                        ) : conversations.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500 text-sm">No chats found</div>
                        ) : (
                            filteredConvs.map(conv => (
                                <div 
                                    key={conv.id} 
                                    onClick={() => { setActiveConvId(conv.id); setShowProfile(false); }}
                                    className="p-4 border-b border-white/5 active:bg-white/5 flex gap-4 w-full"
                                >
                                    <div className="w-12 h-12 rounded-full bg-[#18181b] border border-white/10 flex items-center justify-center text-zinc-400 font-bold shrink-0">
                                        {conv.customer_name ? String(conv.customer_name).substring(0, 2).toUpperCase() : <User size={20} />}
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <h4 className="font-bold text-base text-zinc-100 truncate pr-2">{conv.customer_name || conv.customer_phone}</h4>
                                            {conv.last_message_at && (
                                                <span className="text-xs text-zinc-500 shrink-0">{new Date(conv.last_message_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-zinc-400 truncate">
                                            {conv.last_message || 'Tap to view'}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Mobile Full Screen Chat Screen */}
                {activeConvId && (
                    <div className="fixed inset-0 z-[100] bg-[#030712] flex flex-col animate-in slide-in-from-right duration-200">
                        {/* Native App Chat Header */}
                        <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center justify-between shrink-0 shadow-sm px-2 w-full">
                            <div className="flex items-center">
                                <button onClick={() => setActiveConvId(null)} className="p-3 text-indigo-400 active:opacity-50 flex items-center gap-1">
                                    <ChevronLeft size={24} />
                                </button>
                                <div className="flex items-center gap-3 cursor-pointer active:opacity-70" onClick={() => setShowProfile(true)}>
                                    <div className="w-9 h-9 rounded-full bg-[#18181b] flex items-center justify-center font-bold text-zinc-300 shrink-0">
                                        {activeConv?.customer_name ? String(activeConv.customer_name).substring(0, 2).toUpperCase() : <User size={16} />}
                                    </div>
                                    <div className="flex flex-col">
                                        <h3 className="font-bold text-white text-base leading-tight truncate max-w-[150px]">{activeConv?.customer_name || activeConv?.phone_number}</h3>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center pr-2">
                                <button className="p-2 text-zinc-400"><Phone size={20} /></button>
                                <button className="p-2 text-zinc-400"><Video size={20} /></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#030712]">
                            {messages.map((msg, idx) => {
                                const isCustomer = msg.sender === 'customer';
                                const isAgent = msg.sender === 'agent';
                                
                                return (
                                    <div key={msg.id || idx} className={`flex flex-col mb-4 ${isCustomer ? 'items-start' : 'items-end'}`}>
                                        <div className={`max-w-[80%] p-3 text-base shadow-md rounded-2xl ${
                                            isCustomer 
                                                ? 'bg-[#18181b] border border-white/5 text-zinc-200 rounded-tl-sm' 
                                                : isAgent 
                                                    ? 'bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-tr-sm' 
                                                    : 'bg-white text-black rounded-tr-sm font-medium'
                                        }`}>
                                            {msg.text_content && <p className="whitespace-pre-wrap break-words break-all">{msg.text_content}</p>}
                                            {msg.media_url && (
                                                <div className="mt-2 rounded-lg overflow-hidden">
                                                    {msg.type === 'image' ? <img src={msg.media_url} className="w-full h-auto max-h-60 object-cover" /> : <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline text-sm break-all">Media File</a>}
                                                </div>
                                            )}
                                        </div>
                                        <div className={`text-[11px] text-zinc-500 mt-1 flex gap-1 ${isCustomer ? 'ml-1' : 'mr-1'}`}>
                                            <span>{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            {!isCustomer && <span>••</span>}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Mobile Keyboard / Input area */}
                        <div className="p-2 pb-safe border-t border-white/5 bg-[#09090b] flex items-end gap-2 w-full">
                            <button className="p-3 text-zinc-400 active:text-white shrink-0"><Plus size={24} /></button>
                            <div className="flex-1 bg-[#18181b] border border-white/5 rounded-[24px] min-h-[44px] flex items-center px-4 py-2">
                                <input 
                                    type="text" 
                                    value={composeText}
                                    onChange={e => setComposeText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                    placeholder="Message" 
                                    className="w-full bg-transparent text-base text-zinc-100 outline-none"
                                />
                            </div>
                            {composeText ? (
                                <button onClick={handleSend} className="bg-indigo-500 text-white p-3 rounded-full font-bold active:scale-95 shrink-0 shadow-lg shadow-indigo-500/30">
                                    <Send size={20} className="ml-0.5" />
                                </button>
                            ) : (
                                <button className="p-3 text-zinc-400 active:text-white shrink-0">
                                    <Mic size={24} />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Mobile Full Screen Profile View */}
                {showProfile && (
                    <div className="absolute inset-0 z-[70] bg-[#030712] flex flex-col animate-in slide-in-from-right duration-200">
                        <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center px-4 shrink-0 shadow-sm relative">
                            <button onClick={() => setShowProfile(false)} className="absolute left-4 p-2 -m-2 text-indigo-400 active:opacity-50 flex items-center gap-1 z-10">
                                <ChevronLeft size={24} />
                            </button>
                            <h1 className="text-lg font-bold tracking-tight text-white capitalize w-full text-center">Contact Info</h1>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <div className="p-8 text-center flex flex-col items-center bg-[#09090b] border-b border-white/5 shadow-sm">
                                <div className="w-24 h-24 rounded-full bg-[#18181b] border-2 border-white/10 flex items-center justify-center font-bold text-4xl text-zinc-400 mb-4 shadow-xl">
                                    {activeConv?.customer_name ? String(activeConv.customer_name).substring(0, 2).toUpperCase() : <User size={40} />}
                                </div>
                                <h3 className="font-bold text-2xl text-white tracking-tight">{activeConv?.customer_name || 'Unknown User'}</h3>
                                <p className="text-base text-zinc-400 flex items-center gap-2 mt-2 justify-center font-medium"><Phone size={16} /> {activeConv?.phone_number}</p>
                            </div>

                            <div className="p-4 space-y-4">
                                <div className="bg-[#18181b] rounded-2xl p-4 border border-white/5 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="font-bold text-base text-white flex items-center gap-2"><ShoppingBag size={18} className="text-indigo-400" /> Recent Orders</h4>
                                        <button onClick={() => setIsCreateOrderOpen(true)} className="text-xs bg-white text-black px-3 py-1.5 rounded-full font-bold hover:bg-zinc-200 shadow-sm">Add New</button>
                                    </div>
                                    {recentOrders.length === 0 ? (
                                        <p className="text-sm text-zinc-500 text-center py-6">No recent orders found for this contact.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {recentOrders.map(o => (
                                                <div key={o.id} onClick={() => { setSelectedOrderId(o.id); setIsOrderModalOpen(true); }} className="bg-[#09090b] p-4 rounded-2xl border border-white/5 active:bg-white/5 transition-colors flex justify-between items-center shadow-sm">
                                                    <div><span className="font-bold text-white text-base">#{o.id}</span> <p className="text-zinc-500 text-xs mt-1">{new Date(o.created_at).toLocaleDateString()}</p></div>
                                                    <div className="font-bold text-white text-base">Rs {o.total_amount}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Shared Modals (kept for desktop and mobile overrides) */}
            {isOrderModalOpen && selectedOrderId && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-2 md:p-4 animate-in fade-in">
                    <div className="bg-[#09090b] border border-white/10 rounded-3xl w-[100vw] h-[100dvh] md:w-[90vw] md:max-w-6xl md:h-[90vh] overflow-hidden relative shadow-2xl flex flex-col animate-in slide-in-from-bottom md:slide-in-from-bottom-0 md:zoom-in-95">
                        <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center px-4 shrink-0 shadow-sm relative">
                            <button onClick={() => setIsOrderModalOpen(false)} className="absolute left-4 p-2 -m-2 text-indigo-400 active:opacity-50 flex items-center gap-1 z-10 md:hidden">
                                <ChevronLeft size={24} /> <span className="text-base font-semibold">Back</span>
                            </button>
                            <h1 className="text-lg font-bold tracking-tight text-white capitalize w-full text-center">Order Details</h1>
                            <button onClick={() => setIsOrderModalOpen(false)} className="hidden md:flex absolute top-4 right-4 text-zinc-400 hover:text-white bg-[#18181b] p-2 rounded-full z-10 border border-white/5 shadow-sm">
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <OrderDetailPage orderId={selectedOrderId} onBack={() => setIsOrderModalOpen(false)} onOrderUpdated={() => {}} />
                        </div>
                    </div>
                </div>
            )}
            
            {isCreateOrderOpen && (
                <AddOrderModal
                    isOpen={isCreateOrderOpen}
                    onClose={() => setIsCreateOrderOpen(false)}
                    onSuccess={() => { setIsCreateOrderOpen(false); /* Reload orders */ }}
                />
            )}
        </div>
    );
}
