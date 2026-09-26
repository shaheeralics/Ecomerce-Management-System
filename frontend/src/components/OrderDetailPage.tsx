import { useState, useEffect, useRef } from 'react';
import {
    ArrowLeft, Printer, Edit3, Clock,
    Package, CreditCard, MapPin, Phone, User, FileText, Paperclip, Plus, Trash2,
    ChevronDown, Upload, X, File, Download,
    CheckCheck, RotateCcw, MessageCircle
} from 'lucide-react';
import type { Order } from './OrdersPage';
import AddOrderModal from './AddOrderModal';
import { calculateOrderTotals, formatCurrency as fmt } from '../utils';

interface Note {
    id: number;
    order_id: number;
    note: string;
    created_at: string;
}

interface Attachment {
    id: number;
    order_id: number;
    type: 'payment_screenshot' | 'order_proof' | 'additional';
    file_url: string;
    file_name: string;
    file_type: string;
    uploaded_at: string;
}

interface OrderDetail extends Order {
    notes: Note[];
    attachments: Attachment[];
    updated_at?: string;
}

interface Props {
    orderId: number;
    onBack: () => void;
    onOrderUpdated: () => void;
}

const STATUS_META: Record<string, { color: string; dot: string; bg: string; border: string }> = {
    pending:    { color: 'text-amber-400',   dot: 'bg-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-400/30' },
    confirmed:  { color: 'text-blue-400',    dot: 'bg-blue-400',    bg: 'bg-blue-400/10',    border: 'border-blue-400/30' },
    processing: { color: 'text-indigo-400',  dot: 'bg-indigo-400',  bg: 'bg-indigo-400/10',  border: 'border-indigo-400/30' },
    shipped:    { color: 'text-teal-400',    dot: 'bg-teal-400',    bg: 'bg-teal-400/10',    border: 'border-teal-400/30' },
    delivered:  { color: 'text-emerald-400', dot: 'bg-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
    cancelled:  { color: 'text-red-400',     dot: 'bg-red-400',     bg: 'bg-red-400/10',     border: 'border-red-400/30' },
    trashed:    { color: 'text-slate-400',   dot: 'bg-slate-400',   bg: 'bg-slate-400/10',   border: 'border-slate-400/30' },
};

const getStatusMeta = (s: string) => STATUS_META[s?.toLowerCase()] || STATUS_META.pending;
const ALL_STATUSES = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

const fmtDate = (d: string) => new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
});

// --- SUBCOMPONENTS ---

const TimelineView = ({ timeline }: { timeline: any[] }) => (
    <div className="space-y-0 relative">
        {timeline.map((entry, i) => {
            const ism = getStatusMeta(entry.status === 'Order Created' ? 'confirmed' : entry.status);
            return (
                <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full flex-shrink-0 border-2 mt-1 transition-colors ${
                            entry.current
                                ? `${ism.dot} border-transparent shadow-lg shadow-${ism.color.split('-')[1]}/20`
                                : entry.done
                                ? 'bg-teal-500 border-transparent'
                                : 'bg-transparent border-slate-700'
                        }`} />
                        {i < timeline.length - 1 && <div className={`w-0.5 flex-1 my-1.5 transition-colors ${entry.done ? 'bg-teal-700/50' : 'bg-slate-800'}`} style={{minHeight: 24}} />}
                    </div>
                    <div className={`pb-4 ${i === timeline.length - 1 ? 'pb-0' : ''}`}>
                        <p className={`text-xs sm:text-sm font-black transition-colors ${entry.current ? ism.color : entry.done ? 'text-slate-200' : 'text-slate-600'}`}>
                            {entry.status}
                        </p>
                        {entry.description && (
                            <p className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 max-w-[200px] sm:max-w-none">{entry.description}</p>
                        )}
                        {entry.timestamp && entry.done && (
                            <p className="text-[9px] sm:text-[10px] text-slate-500 font-semibold mt-1">
                                {new Date(entry.timestamp).toLocaleDateString()} &bull; {new Date(entry.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                            </p>
                        )}
                    </div>
                </div>
            );
        })}
    </div>
);

// --- MAIN COMPONENT ---
export default function OrderDetailPage({ orderId, onBack, onOrderUpdated }: Props) {
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'invoice' | 'timeline' | 'notes' | 'attachments'>('overview');

    const [pendingStatus, setPendingStatus] = useState('');
    const [updatingStatus, setUpdatingStatus] = useState(false);

    const [newNote, setNewNote] = useState('');
    const [savingNote, setSavingNote] = useState(false);

    const [uploadingType, setUploadingType] = useState<string | null>(null);
    const paymentRef = useRef<HTMLInputElement>(null);
    const additionalRef = useRef<HTMLInputElement>(null);

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);

    const fetchOrder = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/orders/${orderId}`);
            const data = await res.json();
            if (data.success) {
                setOrder(data.data);
                setPendingStatus(data.data.status);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrder();
        const int = setInterval(fetchOrder, 30000);
        return () => clearInterval(int);
    }, [orderId]);

    const updateStatus = async () => {
        if (!order || pendingStatus === order.status) return;
        setUpdatingStatus(true);
        try {
            await fetch(`/api/orders/${order.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: pendingStatus })
            });
            await fetchOrder();
            onOrderUpdated();
        } catch (e) { console.error(e); }
        finally { setUpdatingStatus(false); }
    };

    const addNote = async () => {
        if (!order || !newNote.trim()) return;
        setSavingNote(true);
        try {
            await fetch(`/api/orders/${order.id}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note: newNote.trim() })
            });
            setNewNote('');
            await fetchOrder();
        } catch (e) { console.error(e); }
        finally { setSavingNote(false); }
    };

    const deleteNote = async (id: number) => {
        if (!confirm('Delete this note?')) return;
        try {
            await fetch(`/api/orders/${order?.id}/notes/${id}`, { method: 'DELETE' });
            await fetchOrder();
        } catch (e) { console.error(e); }
    };

    const uploadAttachment = async (file: File, type: string) => {
        if (!order) return;
        if (file.size > 5 * 1024 * 1024) return alert('File must be less than 5MB');
        setUploadingType(type);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);
            await fetch(`/api/orders/${order.id}/attachments`, { method: 'POST', body: formData });
            await fetchOrder();
        } catch (e) { console.error(e); }
        finally { setUploadingType(null); }
    };

    const deleteAttachment = async (id: number) => {
        if (!confirm('Delete this attachment?')) return;
        try {
            await fetch(`/api/orders/${order?.id}/attachments/${id}`, { method: 'DELETE' });
            await fetchOrder();
        } catch (e) { console.error(e); }
    };

    const printReceipt = () => {
        const p = document.getElementById(`order-receipt-${orderId}`);
        if (!p) return;
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write('<html><head><title>Receipt</title><style>body{font-family:sans-serif;padding:32px;font-size:13px;color:#000}h1{margin:0}table{width:100%;border-collapse:collapse}th,td{padding:8px 4px;text-align:left;border-bottom:1px solid #ddd}th{font-size:11px;text-transform:uppercase;color:#666}.right{text-align:right}.total{font-size:18px;font-weight:900}.divider{border-top:2px solid #000;margin:16px 0}</style></head><body>');
        win.document.write(p.innerHTML);
        win.document.write('</body></html>');
        win.document.close();
        setTimeout(() => { win.print(); win.close(); }, 250);
    };

    if (loading || !order) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const sm = getStatusMeta(order.status);
    let orderItems = [];
    try { orderItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items; } catch (e) {}

    const { originalPrice, negotiatedPrice, discountAmount, deliveryFee, totalPayable } = calculateOrderTotals(order);

    const buildTimeline = () => {
        let currentPassed = false;
        let isCancelled = order.status.toLowerCase() === 'cancelled';
        
        const events = [
            { status: 'Order Created', desc: 'Order has been created successfully.', ts: order.created_at },
            { status: 'Pending', desc: 'Order has been created successfully.', ts: null },
            { status: 'Confirmed', desc: 'Order has been confirmed.', ts: null },
            { status: 'Processing', desc: 'Order is being processed.', ts: null },
            { status: 'Shipped', desc: 'Order has been shipped.', ts: null },
            { status: 'Delivered', desc: 'Order has been delivered.', ts: null },
        ];

        let finalTimeline = [];

        for (let i = 0; i < events.length; i++) {
            const ev = events[i];
            
            // If it's cancelled, we stop the normal flow
            if (isCancelled) {
                // If this is the created step, always show it as done
                if (i === 0) {
                    finalTimeline.push({ ...ev, done: true, current: false, timestamp: ev.ts });
                } else {
                    // Add the Cancelled step and break
                    finalTimeline.push({ status: 'Cancelled', desc: 'Order was cancelled.', done: true, current: true, timestamp: order.updated_at });
                    break; // stop showing future steps
                }
            } else {
                let isCurrent = false;
                let isDone = false;
                if (order.status.toLowerCase() === ev.status.toLowerCase() || (i===0 && order.status.toLowerCase()==='pending')) {
                    isCurrent = true;
                    isDone = true;
                    currentPassed = true;
                } else if (!currentPassed) {
                    isDone = true;
                }
                
                finalTimeline.push({
                    ...ev,
                    current: isCurrent,
                    done: isDone,
                    timestamp: isDone ? (i===0 ? ev.ts : order.updated_at) : null
                });
            }
        }
        return finalTimeline;
    };

    const timeline = buildTimeline();

    const tabCounts = {
        items: orderItems.length,
        attachments: order.attachments?.length || 0,
        notes: order.notes?.length || 0,
        timeline: timeline.length
    };

    const attachByType = (t: string) => (order.attachments || []).filter(a => a.type === t);
    const isImage = (t: string) => t.startsWith('image/');

    const openWhatsApp = () => {
        window.open(`https://wa.me/${order.customer_phone.replace(/[^0-9]/g, '')}`, '_blank');
    };

    return (
        <div className="flex flex-col min-h-0 h-full relative pb-16 md:pb-10">
            {/* ========= HEADER ========= */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 print:hidden shrink-0">
                <div>
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 text-teal-400 hover:text-teal-300 transition-colors text-sm font-bold mb-2"
                    >
                        <ArrowLeft size={14} /> Back to Orders
                    </button>
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Order #{order.id}</h2>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${sm.bg} ${sm.color} border ${sm.border}`}>
                            {order.status}
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{fmtDate(order.created_at)} | Order ID: #{order.id}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    
                    <button onClick={printReceipt} className="bg-transparent border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all">
                        <Printer size={14} /> Print Receipt
                    </button>
                    <button onClick={() => setIsEditOpen(true)} className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-teal-600/20">
                        <Edit3 size={14} /> Edit Order
                    </button>
                </div>
            </div>

            {/* ========= DESKTOP TABS ========= */}
            <div className="hidden md:flex gap-1 border-b border-teal-900/30 mb-6 print:hidden overflow-x-auto shrink-0">
                {(['overview', 'items', 'invoice', 'notes', 'attachments'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap border-b-2 flex items-center gap-2
                            ${activeTab === tab
                                ? 'bg-teal-900/20 text-teal-400 border-teal-400'
                                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-white/5'
                            }`}
                    >
                        {tab === 'overview' && <Package size={13} />}
                        {tab === 'items' && <><CheckCheck size={13}/> Items {tabCounts.items > 0 && <span className="ml-0.5 bg-teal-900/50 text-teal-300 px-1.5 py-0.5 rounded-full text-[9px]">{tabCounts.items}</span>}</>}
                        {tab === 'invoice' && <><FileText size={13}/> Invoice</>}
                        
                        {tab === 'notes' && <><FileText size={13}/> Notes {tabCounts.notes > 0 && <span className="ml-0.5 bg-teal-900/50 text-teal-300 px-1.5 py-0.5 rounded-full text-[9px]">{tabCounts.notes}</span>}</>}
                        {tab === 'attachments' && <><Paperclip size={13}/> Attachments {tabCounts.attachments > 0 && <span className="ml-0.5 bg-teal-900/50 text-teal-300 px-1.5 py-0.5 rounded-full text-[9px]">{tabCounts.attachments}</span>}</>}
                        {tab === 'overview' && 'Overview'}
                    </button>
                ))}
            </div>

            {/* ========= MOBILE BOTTOM BAR ========= */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#050D10] border-t border-teal-900/40 z-50 flex justify-around px-2 py-2 pb-safe shadow-2xl">
                {[
                    { id: 'overview', label: 'Overview', icon: Package },
                    { id: 'items', label: 'Items', icon: CheckCheck },
                    { id: 'invoice', label: 'Invoice', icon: FileText },
                    { id: 'notes', label: 'Notes', icon: FileText },
                    { id: 'attachments', label: 'More', icon: Paperclip },
                ].map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id as any)}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg min-w-[60px] transition-colors ${activeTab === item.id ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <item.icon size={18} className="mb-1" />
                        <span className="text-[9px] font-bold">{item.label}</span>
                    </button>
                ))}
            </div>

            {/* ========= MAIN CONTENT WRAPPER ========= */}
            <div className="flex-1 min-w-0 w-full overflow-y-auto pb-6 custom-scrollbar">

                {/* ========= OVERVIEW TAB ========= */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
                        {/* MAIN UNIFIED COLUMN */}
                        <div className="bg-[#09181E] border border-teal-900/40 rounded-2xl shadow-lg flex flex-col divide-y divide-teal-900/20">
                            
                            {/* Customer Information */}
                            <div className="p-6 hover:bg-white/[0.01] transition-colors">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><User size={14} className="text-teal-400"/> Customer Information</h4>
                                    <button onClick={() => setIsEditOpen(true)} className="text-teal-400 hover:text-teal-300 text-[10px] font-bold border border-teal-900/50 bg-teal-900/20 px-3 py-1 rounded-full transition-colors">Edit</button>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-full bg-teal-900/50 text-teal-400 border border-teal-900/50 flex items-center justify-center text-xl font-black flex-shrink-0">
                                        {(order.customer_name || 'U')[0].toUpperCase()}
                                    </div>
                                    <div className="overflow-hidden">
                                        <h3 className="font-bold text-slate-100 text-lg truncate">{order.customer_name}</h3>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <Phone size={12} className="text-slate-500" />
                                            <p className="text-sm text-slate-300 truncate">{order.customer_phone}</p>
                                            <span className="bg-[#25D366]/20 text-[#25D366] text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">WhatsApp</span>
                                        </div>
                                        <div className="flex items-start gap-2 mt-2">
                                            <MapPin size={12} className="text-slate-500 mt-0.5 flex-shrink-0" />
                                            <p className="text-xs text-slate-400 leading-relaxed max-w-full">
                                                {order.address}
                                                {order.city && `, ${order.city}`}
                                                {order.zip_code && ` - ${order.zip_code}`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Payment & Delivery */}
                            <div className="p-6 hover:bg-white/[0.01] transition-colors">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5"><CreditCard size={14} className="text-teal-400"/> Payment & Delivery</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] text-slate-500 mb-1">Payment Method</p>
                                        <p className="text-sm font-bold text-slate-200 capitalize mb-2">{order.payment_method || 'COD'}</p>
                                        <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded">Status: {order.payment_status || 'Pending'}</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500 mb-1">Delivery Method</p>
                                        <p className="text-sm font-bold text-slate-200 capitalize mb-1">Standard</p>
                                        <p className="text-[10px] text-slate-400">Fee: {fmt(Number(order.delivery_fee || 0))}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Items Summary */}
                            <div className="p-6 hover:bg-white/[0.01] transition-colors">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><CheckCheck size={14} className="text-teal-400"/> Items Summary</h4>
                                </div>
                                <div className="space-y-2">
                                    {orderItems.map((item: any, i: number) => (
                                        <div key={i} className="flex items-center gap-3 p-3 bg-[#050D10]/30 rounded-xl border border-teal-900/20">
                                            <div className="w-10 h-10 bg-[#050D10] rounded-lg border border-teal-900/30 flex items-center justify-center flex-shrink-0 text-slate-600 overflow-hidden">
                                                {item.main_image_url ? (
                                                    <img src={item.main_image_url} alt={item.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Package size={16} />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h5 className="text-sm font-bold text-slate-200 truncate">{item.title}</h5>
                                                <p className="text-xs text-slate-400 mt-0.5">{item.quantity} × {fmt(Number(item.unit_price))}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-slate-100">{fmt(item.quantity * Number(item.unit_price))}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Invoice Summary */}
                            <div className="p-6 hover:bg-white/[0.01] transition-colors">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><FileText size={14} className="text-teal-400"/> Invoice</h4>
                                    <button onClick={() => setActiveTab('invoice')} className="text-teal-400 hover:text-teal-300 text-[10px] font-bold border border-teal-900/50 bg-teal-900/20 px-3 py-1 rounded-full transition-colors">View Invoice</button>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400">Original Price</span>
                                        <span className="text-slate-200 font-bold">{fmt(originalPrice)}</span>
                                    </div>
                                    {discountAmount > 0 && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-400">Discount</span>
                                            <span className="text-red-400 font-bold">- {fmt(discountAmount)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400">Negotiated Price</span>
                                        <span className="text-slate-200 font-bold">{fmt(negotiatedPrice)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm pb-4 border-b border-teal-900/30">
                                        <span className="text-slate-400">Delivery Fee</span>
                                        <span className="text-slate-200 font-bold">{fmt(deliveryFee)}</span>
                                    </div>
                                    <div className="flex justify-between text-base items-center bg-[#050D10]/50 p-3 rounded-xl border border-teal-900/30 mt-2">
                                        <span className="text-slate-100 font-black">Total Payable</span>
                                        <span className="text-teal-400 font-black">{fmt(totalPayable)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Customer Notes */}
                            <div className="p-6 hover:bg-white/[0.01] transition-colors">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><MessageCircle size={14} className="text-teal-400"/> Customer Notes</h4>
                                    <button onClick={() => setActiveTab('notes')} className="text-teal-400 hover:text-teal-300 text-[10px] font-bold border border-teal-900/50 bg-teal-900/20 px-3 py-1 rounded-full transition-colors">Add Note</button>
                                </div>
                                <div className="space-y-3">
                                    {(order.notes?.length || 0) === 0 ? (
                                        <div className="py-4 flex items-center justify-center bg-[#050D10]/30 rounded-xl border border-dashed border-teal-900/40">
                                            <p className="text-slate-500 text-sm">No notes yet.</p>
                                        </div>
                                    ) : (
                                        order.notes.map(n => (
                                            <div key={n.id} className="bg-[#050D10] border border-teal-900/20 rounded-xl p-3">
                                                <p className="text-xs text-slate-300 leading-relaxed">{n.note}</p>
                                                <p className="text-[9px] text-slate-500 mt-2">{fmtDate(n.created_at)}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Order Status */}
                            <div className="p-6 hover:bg-white/[0.01] transition-colors">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5"><Package size={14} className="text-teal-400"/> Order Status</h4>
                                <div className="space-y-3 max-w-sm">
                                    <div>
                                        <p className="text-[10px] text-slate-500 mb-1 font-semibold">Current Status</p>
                                        <div className="relative">
                                            <select
                                                value={pendingStatus}
                                                onChange={(e) => setPendingStatus(e.target.value)}
                                                className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-4 py-3 text-sm text-slate-200 font-bold appearance-none outline-none focus:border-teal-500 transition-colors"
                                            >
                                                {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                        </div>
                                    </div>
                                    <button
                                        onClick={updateStatus}
                                        disabled={updatingStatus || pendingStatus === order.status}
                                        className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:hover:bg-teal-600 text-white text-xs font-bold py-3 rounded-xl transition-all shadow-lg shadow-teal-600/20"
                                    >
                                        {updatingStatus ? 'Updating...' : 'Update Status'}
                                    </button>
                                </div>
                            </div>

                        </div>

                        {/* TIMELINE COLUMN */}
                        <div className="bg-[#09181E] border border-teal-900/40 rounded-2xl p-5 shadow-lg h-fit sticky top-6">
                            <h4 className="font-black text-slate-100 mb-6 flex items-center gap-2 text-sm"><Clock size={16} className="text-teal-400"/> Order Timeline</h4>
                            <TimelineView timeline={timeline} />
                        </div>
                    </div>
                )}
                {/* ========= ITEMS TAB ========= */}
                {activeTab === 'items' && (
                    <div className="bg-[#09181E] border border-teal-900/40 rounded-2xl overflow-hidden max-w-4xl mx-auto shadow-xl">
                        <div className="flex items-center justify-between p-5 border-b border-teal-900/30">
                            <h4 className="font-black text-slate-100">Order Items ({orderItems.length})</h4>
                            <button onClick={() => setIsEditOpen(true)} className="bg-teal-900/20 border border-teal-900/50 hover:bg-teal-900/40 text-teal-400 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
                                <Plus size={14} /> Add Item
                            </button>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full min-w-[500px]">
                                <thead>
                                    <tr className="border-b border-teal-900/20 bg-[#050D10]/50">
                                        <th className="text-left p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Product</th>
                                        <th className="text-center p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Size</th>
                                        <th className="text-center p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Qty</th>
                                        <th className="text-right p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Price</th>
                                        <th className="text-right p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-teal-900/20">
                                    {orderItems.map((item: any, i: number) => (
                                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#050D10] border border-teal-900/30 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                        {item.main_image_url ? (
                                                            <img src={item.main_image_url} alt={item.title} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Package size={20} className="text-slate-600" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs sm:text-sm font-bold text-slate-200">{item.title}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="text-[10px] sm:text-xs text-slate-400 bg-[#050D10] px-2 py-1 rounded-md border border-teal-900/30">{item.size || '—'}</span>
                                            </td>
                                            <td className="p-4 text-center text-xs sm:text-sm font-bold text-slate-300">{item.quantity}</td>
                                            <td className="p-4 text-right text-xs sm:text-sm text-slate-400">{fmt(Number(item.unit_price))}</td>
                                            <td className="p-4 text-right text-xs sm:text-sm font-black text-teal-400">{fmt(item.quantity * Number(item.unit_price))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ========= INVOICE TAB ========= */}
                {activeTab === 'invoice' && (
                    <div className="bg-[#09181E] border border-teal-900/40 rounded-2xl p-6 sm:p-8 max-w-4xl mx-auto shadow-xl">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-teal-900/30">
                            <div>
                                <h2 className="text-xl font-black text-slate-100 uppercase tracking-tight">Invoice / Receipt</h2>
                                <p className="text-sm text-slate-400 mt-1">Order #{order.id}</p>
                                <p className="text-xs text-slate-500">{fmtDate(order.created_at)}</p>
                            </div>
                            <div className="text-left sm:text-right w-full sm:w-auto">
                                <h2 className="text-lg font-black text-teal-400">DEVSIL ECOMMERCE</h2>
                                <p className="text-sm text-slate-400 mt-1">Status: {order.status}</p>
                                <button onClick={printReceipt} className="mt-3 w-full sm:w-auto bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all">
                                    <Printer size={14} /> Print Invoice
                                </button>
                            </div>
                        </div>
                        
                        <div className="mb-8 bg-[#050D10] border border-teal-900/30 p-5 rounded-xl">
                            <p className="text-xs font-black text-teal-500 uppercase tracking-wider mb-2">Billed To</p>
                            <p className="font-bold text-slate-200 text-base">{order.customer_name}</p>
                            <p className="text-sm text-slate-400 mt-1">{order.customer_phone}</p>
                            <p className="text-sm text-slate-400 mt-1 max-w-sm">{order.address}{order.city && `, ${order.city}`}{order.zip_code && ` - ${order.zip_code}`}</p>
                        </div>

                        <div className="overflow-x-auto mb-8 custom-scrollbar">
                            <table className="w-full min-w-[500px]">
                                <thead>
                                    <tr className="border-b border-teal-900/40">
                                        <th className="text-left pb-3 text-xs font-black text-slate-400 uppercase tracking-wider">Item</th>
                                        <th className="text-left pb-3 text-xs font-black text-slate-400 uppercase tracking-wider">Size</th>
                                        <th className="text-right pb-3 text-xs font-black text-slate-400 uppercase tracking-wider">Qty</th>
                                        <th className="text-right pb-3 text-xs font-black text-slate-400 uppercase tracking-wider">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-teal-900/20">
                                    {orderItems.map((item: any, i: number) => (
                                        <tr key={i}>
                                            <td className="py-4 text-sm font-bold text-slate-200">
                                                <div className="flex items-center gap-3">
                                                    {item.main_image_url && (
                                                        <img src={item.main_image_url} alt={item.title} className="w-8 h-8 rounded border border-teal-900/30 object-cover" />
                                                    )}
                                                    {item.title}
                                                </div>
                                            </td>
                                            <td className="py-4 text-sm text-slate-400">{item.size || '—'}</td>
                                            <td className="py-4 text-sm font-bold text-slate-300 text-right">{item.quantity}</td>
                                            <td className="py-4 text-sm font-black text-teal-400 text-right">{fmt(item.quantity * Number(item.unit_price))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-col items-end gap-3 w-full border-t border-teal-900/30 pt-6">
                            <div className="flex justify-between w-full sm:max-w-xs text-sm">
                                <span className="text-slate-400">Original Price</span>
                                <span className="text-slate-200 font-bold">{fmt(originalPrice)}</span>
                            </div>
                            {discountAmount > 0 && (
                                <div className="flex justify-between w-full sm:max-w-xs text-sm">
                                    <span className="text-slate-400">Discount</span>
                                    <span className="text-red-400 font-bold">- {fmt(discountAmount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between w-full sm:max-w-xs text-sm">
                                <span className="text-slate-400">Negotiated Price</span>
                                <span className="text-teal-300 font-bold">{fmt(negotiatedPrice)}</span>
                            </div>
                            <div className="flex justify-between w-full sm:max-w-xs text-sm pb-3 border-b border-teal-900/20">
                                <span className="text-slate-400">Delivery Fee</span>
                                <span className="text-slate-200 font-bold">{fmt(deliveryFee)}</span>
                            </div>
                            <div className="flex justify-between w-full sm:max-w-xs text-lg mt-1 bg-teal-900/20 p-3 rounded-xl border border-teal-900/50">
                                <span className="text-slate-100 font-black">Total Payable</span>
                                <span className="text-teal-400 font-black">{fmt(totalPayable)}</span>
                            </div>
                        </div>

                        <div className="mt-10 pt-6 border-t border-teal-900/30 flex flex-col sm:flex-row justify-between gap-4">
                            <div>
                                <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Payment Method</p>
                                <p className="text-sm font-bold text-slate-200 capitalize">{order.payment_method || 'COD'}</p>
                                <p className="text-xs text-slate-400 mt-1">Status: {order.payment_status || 'Pending'}</p>
                            </div>
                            <div className="sm:text-right mt-auto">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">System Generated • DEVSIL AUTOMATION</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ========= TIMELINE TAB ========= */}
                {activeTab === 'timeline' && (
                    <div className="bg-[#09181E] border border-teal-900/40 rounded-2xl p-6 sm:p-10 max-w-2xl mx-auto shadow-xl">
                        <h4 className="font-black text-slate-100 mb-8 text-lg flex items-center gap-2"><Clock size={18} className="text-teal-400"/> Order Timeline</h4>
                        <div className="pl-2">
                            <TimelineView timeline={timeline} />
                        </div>
                    </div>
                )}

                {/* ========= NOTES TAB ========= */}
                {activeTab === 'notes' && (
                    <div className="max-w-2xl mx-auto space-y-6">
                        <div className="bg-[#09181E] border border-teal-900/40 rounded-2xl p-6 shadow-xl">
                            <h4 className="font-black text-slate-100 mb-4 flex items-center gap-2"><FileText size={16} className="text-teal-400"/> Add a Note</h4>
                            <textarea
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                placeholder="Write something about this order..."
                                className="w-full bg-[#050D10] border border-teal-900/30 rounded-xl p-4 text-sm text-slate-200 placeholder:text-slate-600 focus:border-teal-500 outline-none resize-none h-24 mb-3"
                            />
                            <div className="flex justify-end">
                                <button
                                    onClick={addNote}
                                    disabled={savingNote || !newNote.trim()}
                                    className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all"
                                >
                                    {savingNote ? 'Saving...' : 'Add Note'}
                                </button>
                            </div>
                        </div>

                        {(order.notes?.length || 0) === 0 ? (
                            <div className="bg-[#09181E] border border-teal-900/40 rounded-2xl p-10 text-center shadow-xl">
                                <FileText size={36} className="mx-auto mb-3 text-slate-700" />
                                <p className="text-slate-400 font-semibold">No notes yet</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {order.notes.map(n => (
                                    <div key={n.id} className="bg-[#09181E] border border-teal-900/30 rounded-2xl p-5 group relative shadow-lg">
                                        <p className="text-sm text-slate-300 leading-relaxed">{n.note}</p>
                                        <div className="flex items-center justify-between mt-4 border-t border-teal-900/20 pt-4">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{fmtDate(n.created_at)}</p>
                                            <button
                                                onClick={() => deleteNote(n.id)}
                                                className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-900/20 transition-all text-[10px] flex items-center gap-1 font-bold md:opacity-0 md:group-hover:opacity-100"
                                            >
                                                <Trash2 size={12} /> Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ========= ATTACHMENTS TAB ========= */}
                {activeTab === 'attachments' && (
                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="flex items-center justify-between bg-[#09181E] border border-teal-900/40 rounded-2xl p-5 mb-6 shadow-xl">
                            <h4 className="font-black text-slate-100 flex items-center gap-2 text-base"><Paperclip size={18} className="text-teal-400"/> Order Attachments</h4>
                            <button
                                onClick={() => additionalRef.current?.click()}
                                className="bg-teal-900/20 border border-teal-900/50 hover:bg-teal-900/40 text-teal-400 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
                            >
                                <Plus size={14}/> Upload Attachment
                            </button>
                            <input ref={additionalRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => { if (e.target.files?.[0]) uploadAttachment(e.target.files[0], 'additional'); e.target.value = ''; }} />
                        </div>

                        {[
                            { type: 'payment_screenshot', label: 'Payment Screenshot', accept: 'image/*', desc: 'JPG, PNG (Max 5MB)', ref: paymentRef },
                            { type: 'additional', label: 'Additional Attachments', accept: 'image/*,application/pdf', desc: 'JPG, PNG, PDF (Max 5MB)', ref: additionalRef },
                        ].map(section => {
                            const sectionAttachments = attachByType(section.type);
                            const inputRef = section.type === 'payment_screenshot' ? paymentRef : additionalRef;
                            
                            return (
                                <div key={section.type} className="bg-[#09181E] border border-teal-900/40 rounded-2xl p-6 shadow-lg">
                                    <div className="flex items-center justify-between mb-5 border-b border-teal-900/30 pb-3">
                                        <h5 className="font-black text-slate-200 flex items-center gap-2">
                                            {section.label} <span className="bg-teal-900/40 text-teal-400 px-2 py-0.5 rounded-full text-xs">{sectionAttachments.length}</span>
                                        </h5>
                                    </div>

                                    <div className="flex flex-wrap gap-4 items-start">
                                        {/* Upload Zone */}
                                        <div
                                            onClick={() => inputRef.current?.click()}
                                            className="w-full sm:w-40 h-32 sm:h-40 border-2 border-dashed border-teal-900/50 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-teal-500/50 hover:bg-teal-900/10 transition-all group flex-shrink-0"
                                        >
                                            {uploadingType === section.type ? (
                                                <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    <Upload size={22} className="text-slate-500 group-hover:text-teal-400 transition-colors" />
                                                    <p className="text-[10px] font-bold text-slate-500 group-hover:text-teal-300 text-center px-2 transition-colors">Upload</p>
                                                    <p className="text-[9px] text-slate-600 text-center px-2 hidden sm:block">{section.desc}</p>
                                                </>
                                            )}
                                        </div>
                                        <input
                                            ref={inputRef}
                                            type="file"
                                            className="hidden"
                                            accept={section.accept}
                                            onChange={e => { if (e.target.files?.[0]) uploadAttachment(e.target.files[0], section.type); e.target.value = ''; }}
                                        />

                                        {/* Uploaded files */}
                                        {sectionAttachments.map(att => (
                                            <div key={att.id} className="relative group w-full sm:w-40 flex-shrink-0">
                                                <div
                                                    className="w-full h-32 sm:h-40 rounded-xl overflow-hidden border border-teal-900/30 bg-[#050D10] cursor-pointer hover:border-teal-500/40 transition-all"
                                                    onClick={() => isImage(att.file_type) ? setPreviewUrl(att.file_url) : window.open(att.file_url, '_blank')}
                                                >
                                                    {isImage(att.file_type) ? (
                                                        <img src={att.file_url} alt={att.file_name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-500">
                                                            <File size={28} />
                                                            <p className="text-[10px] font-semibold text-center px-4 truncate w-full">{att.file_name}</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); deleteAttachment(att.id); }}
                                                    className="absolute top-2 right-2 w-7 h-7 bg-red-600 hover:bg-red-500 rounded-lg flex items-center justify-center transition-all shadow-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                                >
                                                    <Trash2 size={12} className="text-white" />
                                                </button>
                                                <div className="mt-2 flex items-center justify-between">
                                                    <div className="overflow-hidden">
                                                        <p className="text-[10px] font-bold text-slate-300 truncate pr-2">{att.file_name}</p>
                                                        <p className="text-[9px] text-slate-500 mt-0.5">{new Date(att.uploaded_at).toLocaleDateString()}</p>
                                                    </div>
                                                    <a href={att.file_url} target="_blank" download className="text-teal-400 hover:text-teal-300 p-1 bg-teal-900/20 rounded">
                                                        <Download size={12} />
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ========= LIGHTBOX ========= */}
            {previewUrl && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
                    onClick={() => setPreviewUrl(null)}
                >
                    <button
                        onClick={() => setPreviewUrl(null)}
                        className="absolute top-4 right-4 sm:top-8 sm:right-8 text-white/70 hover:text-white p-2 bg-white/10 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                    <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain"
                        onClick={e => e.stopPropagation()}
                    />
                    <a
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="absolute bottom-8 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold px-6 py-3 rounded-xl flex items-center gap-2 shadow-xl shadow-teal-600/20"
                    >
                        <Download size={16}/> Download Image
                    </a>
                </div>
            )}

            {/* ========= HIDDEN RECEIPT ========= */}
            <div id={`order-receipt-${orderId}`} style={{display:'none'}}>
                <div style={{display:'flex', justifyContent:'space-between', borderBottom:'2px solid #ccc', paddingBottom:24, marginBottom:24}}>
                    <div>
                        <h1 style={{margin:0, fontSize:28, fontWeight:900}}>RECEIPT</h1>
                        <p style={{margin:'4px 0 0', color:'#666'}}>Order #{order.id}</p>
                        <p style={{margin:'2px 0 0', color:'#666'}}>{fmtDate(order.created_at)}</p>
                    </div>
                    <div style={{textAlign:'right'}}>
                        <h2 style={{margin:0}}>DEVSIL ECOMMERCE</h2>
                        <p style={{color:'#666', margin:'4px 0 0'}}>Official Receipt</p>
                        <p style={{color:'#555', fontWeight:'bold', marginTop:8}}>Status: {order.status}</p>
                    </div>
                </div>
                <div style={{marginBottom:24}}>
                    <p style={{fontWeight:900, color:'#999', textTransform:'uppercase', fontSize:11, marginBottom:6}}>Customer</p>
                    <p style={{fontWeight:'bold', fontSize:16, margin:0}}>{order.customer_name}</p>
                    <p style={{margin:'4px 0'}}>{order.customer_phone}</p>
                    <p style={{margin:'4px 0', maxWidth:300}}>{order.address}{order.city && `, ${order.city}`}{order.zip_code && ` - ${order.zip_code}`}</p>
                </div>
                <table style={{width:'100%', borderCollapse:'collapse', marginBottom:24}}>
                    <thead>
                        <tr style={{borderBottom:'2px solid #ccc'}}>
                            <th style={{textAlign:'left', padding:'8px 4px', fontSize:11, textTransform:'uppercase', color:'#666'}}>Item</th>
                            <th style={{textAlign:'left', padding:'8px 4px', fontSize:11, textTransform:'uppercase', color:'#666'}}>Size</th>
                            <th style={{textAlign:'right', padding:'8px 4px', fontSize:11, textTransform:'uppercase', color:'#666'}}>Qty</th>
                            <th style={{textAlign:'right', padding:'8px 4px', fontSize:11, textTransform:'uppercase', color:'#666'}}>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orderItems.map((item: any, i: number) => (
                            <tr key={i} style={{borderBottom:'1px solid #eee'}}>
                                <td style={{padding:'10px 4px', fontWeight:'bold'}}>{item.title}</td>
                                <td style={{padding:'10px 4px', color:'#666'}}>{item.size || '—'}</td>
                                <td style={{padding:'10px 4px', textAlign:'right'}}>{item.quantity}</td>
                                <td style={{padding:'10px 4px', textAlign:'right', fontWeight:'bold'}}>{fmt(item.quantity * Number(item.unit_price))}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{display:'flex', justifyContent:'flex-end', marginBottom:24}}>
                    <div style={{width:260}}>
                        <div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #eee', padding:'6px 0'}}>
                            <span style={{color:'#666'}}>Subtotal</span><span style={{fontWeight:'bold'}}>{fmt(Number(order.price))}</span>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #eee', padding:'6px 0'}}>
                            <span style={{color:'#666'}}>Delivery Fee</span><span style={{fontWeight:'bold'}}>{fmt(Number(order.delivery_fee||0))}</span>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', padding:'10px 0', fontSize:20, fontWeight:900}}>
                            <span>Total</span><span>{fmt(totalPayable)}</span>
                        </div>
                    </div>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', borderTop:'2px solid #ccc', paddingTop:20}}>
                    <div>
                        <p style={{fontWeight:900, color:'#999', textTransform:'uppercase', fontSize:11}}>Payment</p>
                        <p style={{fontWeight:'bold', textTransform:'capitalize'}}>{order.payment_method || 'COD'}</p>
                        <p style={{color:'#666'}}>Status: {order.payment_status || 'Pending'}</p>
                    </div>
                    <div style={{textAlign:'right', color:'#999', fontSize:11}}>
                        System Generated • DEVSIL AUTOMATION
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            {isEditOpen && (
                <AddOrderModal
                    isOpen={isEditOpen}
                    onClose={() => setIsEditOpen(false)}
                    onSuccess={async () => { await fetchOrder(); onOrderUpdated(); }}
                    editOrder={order}
                />
            )}
        </div>
    );
}
