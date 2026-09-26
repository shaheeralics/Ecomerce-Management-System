import { useState, useEffect, useRef } from 'react';
import { Search, MoreVertical, Paperclip, Image as ImageIcon, FileText, Smile, Mic, Send, MapPin, Phone, Mail, ShoppingBag, User, XCircle } from 'lucide-react';
import OrderDetailPage from './OrderDetailPage'; // Assuming this exists for modal
import AddOrderModal from './AddOrderModal';

interface Conversation {
    id: number;
    customer_phone: string;
    status: string;
    known_slots?: any;
    updated_at: string;
}

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
        const loadActiveData = async () => {
            try {
                // Fetch Messages
                const res = await fetch(`/api/conversations/${activeConvId}/messages`);
                const data = await res.json();
                if (data.data) {
                    setMessages(data.data);
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    const customerName = knownSlots?.name || `Customer ${activeConv?.id || ''}`;
    
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

    const handleTakeover = async () => {
        if (!activeConvId) return;
        try {
            await fetch(`/api/conversations/${activeConvId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'human_takeover' })
            });
            loadConversations();
        } catch (e) {
            console.error(e);
        }
    };

    const filteredConvs = conversations.filter(c => {
        if (filter === 'open' && c.status === 'closed') return false;
        if (filter === 'closed' && c.status !== 'closed') return false;
        // Search
        if (search) {
            const s = search.toLowerCase();
            return c.customer_phone.includes(s) || (c.known_slots && JSON.stringify(c.known_slots).toLowerCase().includes(s));
        }
        return true;
    });

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] relative">
            {/* Error Toast */}
            {errorMsg && (
                <div className="absolute top-0 right-0 bg-red-600/90 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 z-50">
                    <XCircle size={14} /> {errorMsg}
                    <button onClick={() => setErrorMsg('')} className="ml-2 hover:text-red-200"><XCircle size={12}/></button>
                </div>
            )}
            <div className="mb-4">
                <h3 className="text-2xl font-bold text-slate-100 tracking-tight">Live Conversations</h3>
                <p className="text-slate-400 text-xs mt-1">Monitor real-time WhatsApp incoming chats, customer profiles, and their orders.</p>
            </div>
            
            <div className="flex-1 flex gap-4 overflow-hidden">
                {/* 1. Chat List Sidebar */}
                <div className="w-80 bg-[#09181E] border border-teal-900/40 rounded-2xl flex flex-col overflow-hidden shadow-lg flex-shrink-0">
                    <div className="p-4 border-b border-teal-900/30">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input 
                                type="text" 
                                placeholder="Search customers..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-teal-500"
                            />
                        </div>
                    </div>
                    {/* Filters */}
                    <div className="flex px-4 py-2 border-b border-teal-900/30 text-xs font-semibold">
                        <button onClick={() => setFilter('all')} className={`flex-1 text-center pb-2 border-b-2 ${filter==='all' ? 'border-teal-400 text-teal-400' : 'border-transparent text-slate-500'}`}>All</button>
                        <button onClick={() => setFilter('unread')} className={`flex-1 text-center pb-2 border-b-2 ${filter==='unread' ? 'border-teal-400 text-teal-400' : 'border-transparent text-slate-500'}`}>Unread</button>
                        <button onClick={() => setFilter('open')} className={`flex-1 text-center pb-2 border-b-2 ${filter==='open' ? 'border-teal-400 text-teal-400' : 'border-transparent text-slate-500'}`}>Open</button>
                        <button onClick={() => setFilter('closed')} className={`flex-1 text-center pb-2 border-b-2 ${filter==='closed' ? 'border-teal-400 text-teal-400' : 'border-transparent text-slate-500'}`}>Closed</button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {loading ? (
                            <div className="flex justify-center py-10">
                                <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : filteredConvs.length === 0 ? (
                            <div className="text-center py-10 text-slate-500 text-xs">
                                No conversations found.
                            </div>
                        ) : (
                            filteredConvs.map(conv => {
                                let kSlots = conv.known_slots;
                                if (typeof kSlots === 'string') {
                                    try { kSlots = JSON.parse(kSlots); } catch (e) {}
                                }
                                const name = kSlots?.name || `Customer ${conv.id}`;
                                const isSelected = activeConvId === conv.id;
                                
                                return (
                                    <div 
                                        key={conv.id} 
                                        onClick={() => { setActiveConvId(conv.id); setShowProfile(false); }}
                                        className={`p-3 rounded-xl cursor-pointer transition-all flex gap-3 ${isSelected ? 'bg-[#0B1D25] border border-teal-700/50' : 'hover:bg-teal-950/20 border border-transparent'}`}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-teal-800/40 flex items-center justify-center text-teal-400 font-bold flex-shrink-0">
                                            {name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="text-sm font-bold text-slate-100 truncate">{name}</h4>
                                                <span className="text-[10px] text-teal-500 font-semibold">{new Date(conv.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {conv.status === 'agent_active' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"></div>}
                                                <p className="text-xs text-slate-400 truncate">{conv.customer_phone}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* 2. Active Chat Window */}
                <div className="flex-1 bg-[#09181E] border border-teal-900/40 rounded-2xl flex flex-col overflow-hidden shadow-lg min-w-[300px]">
                    {activeConvId ? (
                        <>
                            <div 
                                className="p-4 border-b border-teal-900/30 flex items-center justify-between bg-[#0B1D25] cursor-pointer hover:bg-teal-950/40 transition-colors"
                                onClick={() => setShowProfile(true)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-teal-800/40 flex items-center justify-center text-teal-400 font-bold">
                                        {customerName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-100">{customerName}</h4>
                                        <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> 
                                            {activeConv?.status === 'agent_active' ? 'Agent Active' : 'Human Overridden'}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                    <button onClick={handleTakeover} className="bg-[#071317] border border-teal-800/40 text-teal-400 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-teal-900/30 transition-all shadow-md">
                                        Takeover Chat
                                    </button>
                                    <button className="text-slate-400 hover:text-slate-300 p-1.5 rounded-lg hover:bg-[#071317]">
                                        <MoreVertical size={16} />
                                    </button>
                                </div>
                            </div>
                            {/* Show Profile Overlay if toggled */}
                            {showProfile ? (
                                <div className="flex-1 overflow-y-auto bg-[#09181E] custom-scrollbar flex flex-col">
                                    <div className="p-4 border-b border-teal-900/30 bg-[#071317] flex justify-between items-center sticky top-0 z-10 shadow-md">
                                        <button 
                                            onClick={() => setShowProfile(false)}
                                            className="text-slate-400 hover:text-teal-400 flex items-center gap-2 font-semibold text-xs transition-colors"
                                        >
                                            <span className="text-lg leading-none">&larr;</span> Back to Chat
                                        </button>
                                        <button className="text-[10px] text-teal-400 border border-teal-700/50 px-3 py-1 rounded-lg hover:bg-teal-900/30 transition-colors">Edit Customer</button>
                                    </div>
                                    
                                    <div className="p-6 max-w-3xl mx-auto w-full space-y-8">
                                        <div className="text-center pb-6 border-b border-teal-900/30">
                                            <div className="w-24 h-24 mx-auto rounded-full bg-teal-800/40 flex items-center justify-center text-teal-400 text-4xl font-bold mb-4 shadow-inner border-2 border-teal-700/50">
                                                {customerName.charAt(0).toUpperCase()}
                                            </div>
                                            <h3 className="font-bold text-slate-100 text-2xl">{customerName}</h3>
                                            <div className="text-xs text-emerald-400 font-semibold flex items-center justify-center gap-1 mt-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-400"></div> Online
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Contact Info */}
                                            <div className="bg-[#071317] border border-teal-900/30 rounded-2xl p-5 shadow-lg">
                                                <h4 className="text-sm font-bold text-slate-100 mb-4 border-b border-teal-900/30 pb-2">Contact Details</h4>
                                                <div className="space-y-4">
                                                    <div className="flex items-start gap-4">
                                                        <div className="bg-teal-900/30 p-2 rounded-lg text-teal-500"><Phone size={16} /></div>
                                                        <div>
                                                            <p className="text-xs text-slate-500 uppercase font-semibold">Phone Number</p>
                                                            <p className="text-slate-200 font-medium">{activeConv?.customer_phone}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start gap-4">
                                                        <div className="bg-teal-900/30 p-2 rounded-lg text-teal-500"><MapPin size={16} /></div>
                                                        <div>
                                                            <p className="text-xs text-slate-500 uppercase font-semibold">Address</p>
                                                            <p className="text-slate-300 text-sm">{knownSlots?.address || 'No address provided'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start gap-4">
                                                        <div className="bg-teal-900/30 p-2 rounded-lg text-teal-500"><Mail size={16} /></div>
                                                        <div>
                                                            <p className="text-xs text-slate-500 uppercase font-semibold">Email</p>
                                                            <p className="text-slate-400 text-sm">No email provided</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Quick Actions */}
                                            <div className="bg-[#071317] border border-teal-900/30 rounded-2xl p-5 shadow-lg">
                                                <h4 className="text-sm font-bold text-slate-100 mb-4 border-b border-teal-900/30 pb-2">Quick Actions</h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button className="flex flex-col items-center justify-center gap-2 bg-[#050D10] border border-teal-900/50 hover:bg-teal-900/30 hover:border-teal-700/50 text-teal-400 p-4 rounded-xl text-xs font-semibold transition-all">
                                                        <ShoppingBag size={20} /> Create Order
                                                    </button>
                                                    <button className="flex flex-col items-center justify-center gap-2 bg-[#050D10] border border-teal-900/50 hover:bg-teal-900/30 hover:border-teal-700/50 text-teal-400 p-4 rounded-xl text-xs font-semibold transition-all">
                                                        <FileText size={20} /> View Orders
                                                    </button>
                                                    <button className="flex flex-col items-center justify-center gap-2 bg-[#050D10] border border-teal-900/50 hover:bg-teal-900/30 hover:border-teal-700/50 text-teal-400 p-4 rounded-xl text-xs font-semibold transition-all">
                                                        <ImageIcon size={20} /> Send Catalog
                                                    </button>
                                                    <button className="flex flex-col items-center justify-center gap-2 bg-[#050D10] border border-teal-900/50 hover:bg-teal-900/30 hover:border-teal-700/50 text-teal-400 p-4 rounded-xl text-xs font-semibold transition-all">
                                                        <FileText size={20} /> Apply Policy
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Orders List */}
                                        <div className="bg-[#071317] border border-teal-900/30 rounded-2xl p-5 shadow-lg">
                                            <div className="flex justify-between items-center mb-4 border-b border-teal-900/30 pb-2">
                                                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                                                    <FileText size={16} className="text-teal-500" /> Recent Orders ({recentOrders.length})
                                                </h4>
                                            </div>
                                            {recentOrders.length === 0 ? (
                                                <div className="text-center py-6 bg-[#050D10] rounded-xl border border-teal-900/30">
                                                    <p className="text-sm text-slate-500">No recent orders found for this customer.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {recentOrders.map((order: any) => (
                                                        <div 
                                                            key={order.id} 
                                                            onClick={() => { setSelectedOrderId(order.id); setIsOrderModalOpen(true); }}
                                                            className="bg-[#050D10] p-4 rounded-xl border border-teal-900/50 flex justify-between items-center cursor-pointer hover:border-teal-500 transition-colors shadow-sm"
                                                        >
                                                            <div>
                                                                <p className="text-sm font-bold text-teal-400">Order #{order.id}</p>
                                                                <p className="text-xs text-slate-400 mt-1">{new Date(order.created_at).toLocaleString()}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-sm font-bold text-slate-200">Rs {order.price}</p>
                                                                <span className={`text-[10px] px-2 py-1 rounded-full mt-1.5 inline-block font-bold uppercase tracking-wider ${
                                                                    order.status === 'Pending' ? 'bg-amber-900/40 text-amber-400 border border-amber-800/50' :
                                                                    order.status === 'Delivered' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50' : 'bg-red-900/40 text-red-400 border border-red-800/50'
                                                                }`}>
                                                                    {order.status}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="flex justify-center pt-4">
                                            <button className="flex items-center gap-2 bg-red-950/40 border border-red-900/60 hover:bg-red-900/60 text-red-400 px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg">
                                                <XCircle size={16} /> Block Customer
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-[#09181E] to-[#050D10] custom-scrollbar">
                                <div className="flex justify-center my-2">
                                    <span className="text-[10px] bg-[#071317] px-3 py-1 rounded-full text-slate-500 border border-teal-900/30 shadow-sm">
                                        Conversation History
                                    </span>
                                </div>
                                
                                {messages.map(msg => {
                                    const isCustomer = msg.sender === 'customer';
                                    const isAgent = msg.sender === 'agent';
                                    
                                    return (
                                        <div key={msg.id} className={`flex flex-col ${isCustomer ? 'self-start items-start' : 'self-end items-end'}`}>
                                            <div className={`max-w-[75%] p-3 rounded-2xl text-sm shadow-md ${
                                                isCustomer 
                                                    ? 'bg-[#071317] border border-teal-900/40 text-slate-300 rounded-tl-sm' 
                                                    : isAgent 
                                                        ? 'bg-teal-900/60 border border-teal-600/40 text-teal-50 rounded-tr-sm' 
                                                        : 'bg-teal-700 text-white rounded-tr-sm'
                                            }`}>
                                                {msg.text_content && <p>{msg.text_content}</p>}
                                                {msg.media_url && (
                                                    <div className="mt-2 rounded-lg overflow-hidden border border-white/10">
                                                        {msg.type === 'image' ? <img src={msg.media_url} className="w-full h-auto max-h-48 object-cover" /> 
                                                        : <a href={msg.media_url} target="_blank" className="text-blue-300 underline text-xs break-all">{msg.media_url}</a>}
                                                    </div>
                                                )}
                                            </div>
                                            <div className={`text-[10px] text-slate-500 mt-1 flex gap-1 ${isCustomer ? 'ml-1' : 'mr-1'}`}>
                                                <span>{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                {!isCustomer && <span>✓✓</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="p-3 border-t border-teal-900/30 bg-[#0B1D25]">
                                <div className="flex items-center gap-2">
                                    <button className="text-slate-400 hover:text-teal-400 p-2 transition-colors"><Paperclip size={18} /></button>
                                    <button className="text-slate-400 hover:text-teal-400 p-2 transition-colors"><ImageIcon size={18} /></button>
                                    <button className="text-slate-400 hover:text-teal-400 p-2 transition-colors"><FileText size={18} /></button>
                                    
                                    <div className="flex-1 bg-[#050D10] border border-teal-900/50 rounded-xl px-4 py-2 flex items-center gap-2 focus-within:ring-1 focus-within:ring-teal-500">
                                        <input 
                                            type="text" 
                                            value={composeText}
                                            onChange={e => setComposeText(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                                            placeholder="Type a message..." 
                                            className="w-full bg-transparent text-sm text-slate-100 outline-none"
                                        />
                                        <button className="text-slate-500 hover:text-teal-400"><Smile size={18} /></button>
                                    </div>
                                    
                                    {composeText ? (
                                        <button onClick={handleSend} className="bg-teal-600 hover:bg-teal-500 text-white p-2.5 rounded-xl font-bold transition-all shadow-lg shadow-teal-600/30">
                                            <Send size={18} />
                                        </button>
                                    ) : (
                                        <button className="bg-[#071317] border border-teal-900/50 hover:bg-teal-900/30 text-teal-400 p-2.5 rounded-xl font-bold transition-all">
                                            <Mic size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            </>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                            <div className="w-16 h-16 rounded-full bg-teal-900/20 flex items-center justify-center mb-4">
                                <Send size={24} className="text-teal-700/50" />
                            </div>
                            <p>Select a conversation to start chatting</p>
                        </div>
                    )}
                </div>
            </div>
                        

            
            {/* Order Detail Modal */}
            {isOrderModalOpen && selectedOrderId && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#051116] border border-teal-900/40 rounded-2xl w-[90vw] max-w-6xl h-[90vh] overflow-y-auto relative shadow-2xl">
                        <button onClick={() => setIsOrderModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white bg-[#09181E] p-2 rounded-full z-10 border border-teal-900/50">
                            X
                        </button>
                        <OrderDetailPage orderId={selectedOrderId} onBack={() => setIsOrderModalOpen(false)} onOrderUpdated={() => {}} />
                    </div>
                </div>
            )}
            
            {/* Create Order Modal */}
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
