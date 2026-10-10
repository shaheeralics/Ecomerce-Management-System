// @ts-nocheck
import { useState, useEffect } from 'react';
import { 
    Search, Filter, 
    CheckCircle, Clock, Truck, XCircle,
    ShoppingBag, CreditCard, Box, Activity, Plus, Trash2, MoreVertical, ChevronLeft
} from 'lucide-react';
import AddOrderModal from './AddOrderModal';
import OrderDetailPage from './OrderDetailPage';
import { calculateOrderTotals } from '../utils';

export interface Order {
    id: number;
    conversation_id: number | null;
    product_id: number | null;
    product_title: string | null;
    main_image_url: string | null;
    customer_name: string;
    customer_phone: string;
    address: string;
    city?: string | null;
    zip_code?: string | null;
    custom_product_name?: string | null;
    price: number;
    minimum_price?: number;
    status: string;
    payment_status?: string | null;
    payment_method?: string | null;
    delivery_method?: string | null;
    delivery_fee?: number | null;
    payment_screenshot_url?: string | null;
    delivery_proof_url?: string | null;
    items?: any;
    timeline?: any;
    customer_note?: string | null;
    created_at: string;
}

export default function OrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [paymentFilter, setPaymentFilter] = useState('all');
    
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [stats, setStats] = useState({ total: 0, revenue: 0, pending: 0, processing: 0, delivered: 0, cancelled: 0 });
    const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
    const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
    const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
    
    const fetchOrders = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            if (searchTerm) queryParams.append('search', searchTerm);
            if (statusFilter !== 'all') queryParams.append('status', statusFilter);
            if (paymentFilter !== 'all') queryParams.append('payment', paymentFilter);
            
            const res = await fetch(`/api/orders?${queryParams.toString()}`);
            const data = await res.json();
            if (data.success) {
                setOrders(data.data);
                if (data.stats) setStats(data.stats);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const debounce = setTimeout(() => { fetchOrders(); }, 300);
        return () => clearTimeout(debounce);
    }, [searchTerm, statusFilter, paymentFilter]);

    const filteredOrders = orders;

    const updateOrderStatus = async (id: number, newStatus: string) => {
        try {
            await fetch('/api/orders/' + id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            fetchOrders();
        } catch (error) {
            console.error(error);
        }
    };

    const handleMoveToTrash = async (id: number) => {
        await updateOrderStatus(id, 'Trashed');
        setOpenDropdownId(null);
    };

    const deleteOrder = async (id: number) => {
        if (!confirm('Are you sure you want to permanently delete this order? This action cannot be undone.')) return;
        try {
            const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                if (selectedOrder?.id === id) setSelectedOrder(null);
                fetchOrders();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(amount);
    };

    const getStatusColor = (status: string) => {
        const s = status?.toLowerCase() || '';
        if (s === 'delivered') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        if (s === 'shipped' || s === 'processing' || s === 'confirmed') return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        if (s === 'cancelled' || s === 'trashed') return 'text-red-400 bg-red-500/10 border-red-500/20';
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    };

    // Render Full Screen Mobile Native UI if selectedOrder or isAddOrderOpen
    if (isAddOrderOpen || selectedOrder) {
        return (
            <div className="flex flex-col w-full h-[100dvh] md:h-full bg-[#030712] absolute inset-0 z-50 animate-in slide-in-from-right duration-200">
                <div className="h-14 bg-[#09090b] border-b border-white/5 flex items-center justify-between px-4 shrink-0 shadow-sm">
                    <button 
                        onClick={() => { setIsAddOrderOpen(false); setSelectedOrder(null); setOrderToEdit(null); }} 
                        className="text-indigo-400 active:opacity-50 p-2 -m-2 flex items-center gap-1"
                    >
                        <ChevronLeft size={24} /> <span className="text-base font-semibold md:hidden">Back</span>
                    </button>
                    <h1 className="text-base font-bold text-white hidden md:block">{selectedOrder ? `Order #${selectedOrder.id}` : (orderToEdit ? 'Edit Order' : 'New Order')}</h1>
                    <div className="w-10"></div> {/* Spacer for center alignment */}
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {selectedOrder ? (
                        <OrderDetailPage orderId={selectedOrder.id} onBack={() => setSelectedOrder(null)} onOrderUpdated={fetchOrders} />
                    ) : (
                        <AddOrderModal 
                            isOpen={isAddOrderOpen} 
                            onClose={() => { setIsAddOrderOpen(false); setOrderToEdit(null); }} 
                            onSuccess={fetchOrders} 
                            editOrder={orderToEdit}
                            
                        />
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full h-full bg-[#030712] overflow-hidden font-sans">
            {/* Desktop Filters Header (Hidden on Mobile for cleaner direct list) */}
            <div className="hidden md:flex p-4 md:p-6 pb-2 items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-white hidden md:block">Orders</h1>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search orders..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="bg-[#09090b] border border-white/5 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-white/20 w-48 transition-all"
                        />
                    </div>
                    <select 
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="bg-[#09090b] border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none appearance-none"
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
                <button 
                    onClick={() => setIsAddOrderOpen(true)}
                    className="bg-white text-black hover:bg-zinc-200 px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                >
                    <Plus size={16} /> New Order
                </button>
            </div>

            {/* Mobile Sticky Add Order Button (Instead of top header) */}
            <button 
                onClick={() => setIsAddOrderOpen(true)}
                className="md:hidden fixed bottom-24 right-4 w-14 h-14 bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-[0_8px_30px_rgb(99,102,241,0.4)] z-40 active:scale-95 transition-transform"
            >
                <Plus size={28} strokeWidth={2.5} />
            </button>

            {/* Desktop Table View */}
            <div className="hidden md:block flex-1 overflow-auto p-6 pt-2 custom-scrollbar">
                <div className="bg-[#09090b] rounded-2xl border border-white/5 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#18181b] border-b border-white/5 text-xs uppercase tracking-wider text-zinc-500 font-bold">
                                <th className="px-6 py-4">Order Info</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Amount</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr><td colSpan={5} className="text-center py-10 text-zinc-500">Loading...</td></tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-10 text-zinc-500">No orders found.</td></tr>
                            ) : (
                                filteredOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-[#18181b] transition-colors group cursor-pointer" onClick={() => setSelectedOrder(order)}>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-white">#{order.id}</div>
                                            <div className="text-xs text-zinc-500 mt-1">{new Date(order.created_at).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-semibold text-zinc-200">{order.customer_name}</div>
                                            <div className="text-xs text-zinc-500">{order.customer_phone}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-white">{formatCurrency(calculateOrderTotals(order).totalPayable)}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(order.status)}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }} className="text-indigo-400 hover:text-indigo-300 text-xs font-bold px-3 py-1.5 bg-indigo-500/10 rounded-lg">View</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Direct List View */}
            <div className="md:hidden pt-2 bg-[#09090b]/95 backdrop-blur-xl border-b border-white/5 shrink-0 z-50">
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <h1 className="text-xl font-bold tracking-tight text-white">Orders</h1>
                    <div className="flex-1 flex justify-end">
                        <div className="relative w-full max-w-[200px]">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input 
                                type="text" 
                                placeholder="Search orders..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="bg-[#18181b] text-sm text-white rounded-full pl-9 pr-4 py-2 w-full outline-none border border-white/5 focus:border-indigo-500/50 transition-all" 
                            />
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="md:hidden flex-1 overflow-y-auto pb-[85px] px-4 pt-4 custom-scrollbar space-y-3">
                {loading ? (
                    <div className="text-center py-10 text-zinc-500 text-sm">Loading orders...</div>
                ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-10 text-zinc-500 text-sm">No orders yet. Tap + to add.</div>
                ) : (
                    filteredOrders.map(order => (
                        <div 
                            key={order.id} 
                            onClick={() => setSelectedOrder(order)}
                            className="bg-[#09090b] rounded-2xl p-4 border border-white/5 active:bg-white/5 transition-colors flex flex-col gap-3"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-bold text-white text-base">#{order.id}</h4>
                                    <p className="text-xs text-zinc-500">{new Date(order.created_at).toLocaleDateString()}</p>
                                </div>
                                <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(order.status)}`}>
                                    {order.status}
                                </span>
                            </div>
                            
                            <div className="flex justify-between items-end border-t border-white/5 pt-3">
                                <div>
                                    <p className="font-semibold text-zinc-300 text-sm">{order.customer_name}</p>
                                    <p className="text-xs text-zinc-500">{order.customer_phone}</p>
                                </div>
                                <p className="font-bold text-white text-base">{formatCurrency(calculateOrderTotals(order).totalPayable)}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
