import { useState, useEffect } from 'react';
import { 
    Search, Filter, 
    CheckCircle, Clock, Truck, XCircle,
    ShoppingBag, CreditCard, Box, Activity, Plus, Trash2, MoreVertical
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
        const s = status.toLowerCase();
        if (s === 'delivered') return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
        if (s === 'shipped' || s === 'processing' || s === 'confirmed') return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
        if (s === 'cancelled' || s === 'trashed') return 'text-red-400 bg-red-400/10 border-red-400/20';
        return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    };

    return (
        <div className="space-y-6 pb-10 relative">

            {/* ===== ORDER DETAIL VIEW ===== */}
            {selectedOrder && (
                <OrderDetailPage
                    orderId={selectedOrder.id}
                    onBack={() => { setSelectedOrder(null); fetchOrders(); }}
                    onOrderUpdated={fetchOrders}
                />
            )}

            {/* ===== ORDERS LIST VIEW ===== */}
            {!selectedOrder && (
                <>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-teal-900/30 print:hidden">
                        <div>
                            <h3 className="text-2xl font-bold text-slate-100 tracking-tight">Orders</h3>
                            <p className="text-slate-400 text-xs mt-1">Manage customer orders, status, payment, delivery and receipts.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => { setOrderToEdit(null); setIsAddOrderOpen(true); }} className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 shadow-lg shadow-teal-600/20">
                                <Plus size={16} /> Add New Order
                            </button>
                            <button onClick={fetchOrders} className="bg-[#09181E] border border-teal-900/40 text-teal-400 hover:text-white px-4 py-2 rounded-xl font-semibold text-xs transition-colors flex items-center gap-2">
                                <Activity size={16} /> Refresh
                            </button>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 print:hidden">
                        <div className="bg-[#09181E] border border-teal-900/40 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 bg-teal-900/20 rounded-lg text-teal-400"><ShoppingBag size={18} /></div>
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-slate-100">{stats.total}</h4>
                                <p className="text-[10px] text-slate-400 font-medium">Total Orders</p>
                            </div>
                        </div>
                        <div className="bg-[#09181E] border border-teal-900/40 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 bg-emerald-900/20 rounded-lg text-emerald-400"><Activity size={18} /></div>
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-slate-100">{formatCurrency(stats.revenue || 0)}</h4>
                                <p className="text-[10px] text-slate-400 font-medium">Total Revenue</p>
                            </div>
                        </div>
                        <div className="bg-[#09181E] border border-teal-900/40 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 bg-amber-900/20 rounded-lg text-amber-400"><Clock size={18} /></div>
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-slate-100">{stats.pending}</h4>
                                <p className="text-[10px] text-slate-400 font-medium">Pending</p>
                            </div>
                        </div>
                        <div className="bg-[#09181E] border border-teal-900/40 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 bg-blue-900/20 rounded-lg text-blue-400"><Truck size={18} /></div>
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-slate-100">{stats.processing}</h4>
                                <p className="text-[10px] text-slate-400 font-medium">Processing</p>
                            </div>
                        </div>
                        <div className="bg-[#09181E] border border-teal-900/40 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 bg-emerald-900/20 rounded-lg text-emerald-400"><CheckCircle size={18} /></div>
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-slate-100">{stats.delivered}</h4>
                                <p className="text-[10px] text-slate-400 font-medium">Delivered</p>
                            </div>
                        </div>
                        <div className="bg-[#09181E] border border-teal-900/40 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 bg-red-900/20 rounded-lg text-red-400"><XCircle size={18} /></div>
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-slate-100">{stats.cancelled}</h4>
                                <p className="text-[10px] text-slate-400 font-medium">Cancelled</p>
                            </div>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="bg-[#09181E] border border-teal-900/40 rounded-2xl p-4 shadow-lg flex flex-wrap gap-4 items-center print:hidden">
                        <div className="flex-1 min-w-[200px] relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search order #, name, phone..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                            />
                        </div>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2 bg-[#050D10] border border-teal-900/50 rounded-xl px-3 py-2">
                                <Filter size={14} className="text-teal-400" />
                                <select 
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="bg-transparent text-sm text-slate-200 outline-none cursor-pointer"
                                >
                                    <option value="all" className="bg-[#050D10] text-slate-200">All Status</option>
                                    <option value="pending" className="bg-[#050D10] text-slate-200">Pending</option>
                                    <option value="confirmed" className="bg-[#050D10] text-slate-200">Confirmed</option>
                                    <option value="processing" className="bg-[#050D10] text-slate-200">Processing</option>
                                    <option value="shipped" className="bg-[#050D10] text-slate-200">Shipped</option>
                                    <option value="delivered" className="bg-[#050D10] text-slate-200">Delivered</option>
                                    <option value="cancelled" className="bg-[#050D10] text-slate-200">Cancelled</option>
                                    <option value="trashed" className="bg-[#050D10] text-slate-200">Trashed</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2 bg-[#050D10] border border-teal-900/50 rounded-xl px-3 py-2">
                                <CreditCard size={14} className="text-teal-400" />
                                <select 
                                    value={paymentFilter}
                                    onChange={(e) => setPaymentFilter(e.target.value)}
                                    className="bg-transparent text-sm text-slate-200 outline-none cursor-pointer"
                                >
                                    <option value="all" className="bg-[#050D10] text-slate-200">All Payments</option>
                                    <option value="pending" className="bg-[#050D10] text-slate-200">Pending</option>
                                    <option value="paid" className="bg-[#050D10] text-slate-200">Paid</option>
                                    <option value="cod" className="bg-[#050D10] text-slate-200">COD</option>
                                </select>
                            </div>
                            <button 
                                onClick={() => { setSearchTerm(''); setStatusFilter('all'); setPaymentFilter('all'); }}
                                className="text-xs text-slate-400 hover:text-teal-400 font-semibold px-2 transition-colors"
                            >
                                Clear Filters
                            </button>
                        </div>
                    </div>

                    {/* Orders Table */}
                    <div className="bg-[#09181E] border border-teal-900/40 rounded-2xl shadow-xl overflow-hidden print:hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left whitespace-nowrap">
                                <thead>
                                    <tr className="bg-[#050D10]/50 border-b border-teal-900/30">
                                        <th className="px-6 py-4 text-[10px] font-bold text-teal-500 uppercase tracking-wider">Order #</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-teal-500 uppercase tracking-wider">Customer</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-teal-500 uppercase tracking-wider">Items</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-teal-500 uppercase tracking-wider">Total</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-teal-500 uppercase tracking-wider">Payment</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-teal-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-teal-500 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-teal-500 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-teal-900/20">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                                <Activity size={24} className="mx-auto mb-2 animate-spin text-teal-500" />
                                                Loading orders...
                                            </td>
                                        </tr>
                                    ) : filteredOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-16 text-center">
                                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-900/20 text-teal-500 mb-4">
                                                    <ShoppingBag size={28} />
                                                </div>
                                                <h4 className="text-lg font-bold text-slate-200 mb-1">No Orders Found</h4>
                                                <p className="text-sm text-slate-500">Try adjusting your filters or search term.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredOrders.map(order => (
                                            <tr 
                                                key={order.id} 
                                                onClick={() => setSelectedOrder(order)}
                                                className="hover:bg-teal-900/10 transition-colors cursor-pointer group"
                                            >
                                                <td className="px-6 py-4">
                                                    <span className="font-mono text-sm font-semibold text-teal-400">#{order.id}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-teal-900/40 border border-teal-700/50 flex items-center justify-center text-teal-300 font-bold text-xs uppercase shadow-inner">
                                                            {order.customer_name ? order.customer_name.charAt(0) : '?'}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{order.customer_name || 'Unknown'}</p>
                                                            <p className="text-[11px] text-slate-500">{order.customer_phone}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        {(() => {
                                                            let orderItems: any[] = [];
                                                            try { orderItems = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []); } catch(e) {}
                                                            if (orderItems.length === 0) {
                                                                orderItems = [{
                                                                    title: order.product_title || order.custom_product_name || 'Custom Product Request',
                                                                    main_image_url: order.main_image_url
                                                                }];
                                                            }
                                                            const firstItem = orderItems[0];
                                                            return (
                                                                <>
                                                                    {firstItem.main_image_url ? (
                                                                        <img src={firstItem.main_image_url} alt="product" className="w-8 h-8 rounded bg-[#050D10] object-cover border border-teal-900/30" />
                                                                    ) : (
                                                                        <div className="w-8 h-8 rounded bg-teal-900/20 border border-teal-900/30 flex items-center justify-center text-teal-600"><Box size={14} /></div>
                                                                    )}
                                                                    <div>
                                                                        <p className="text-xs text-slate-300 max-w-[150px] truncate">{firstItem.title}</p>
                                                                        <p className="text-[10px] text-slate-500">{orderItems.length} Item{orderItems.length !== 1 && 's'}</p>
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm font-bold text-slate-200">{formatCurrency(calculateOrderTotals(order).totalPayable)}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs text-slate-300 capitalize">{order.payment_method || 'COD'}</span>
                                                        <span className={`text-[10px] font-semibold ${order.payment_status?.toLowerCase() === 'paid' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                            {order.payment_status || 'Pending'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(order.status)}`}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-xs text-slate-300">{new Date(order.created_at).toLocaleDateString()}</p>
                                                    <p className="text-[10px] text-slate-500">{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                                </td>
                                                <td className="px-6 py-4 text-right relative">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === order.id ? null : order.id); }}
                                                        className="text-slate-400 hover:text-teal-400 transition-colors p-2 rounded-lg hover:bg-teal-900/40"
                                                    >
                                                        <MoreVertical size={18} />
                                                    </button>
                                                    {openDropdownId === order.id && (
                                                        <div 
                                                            className="absolute right-8 top-10 z-50 w-36 bg-[#09181E] border border-teal-900/50 rounded-xl shadow-2xl py-1 overflow-hidden" 
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button 
                                                                onClick={() => { setOpenDropdownId(null); setSelectedOrder(order); }}
                                                                className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-teal-900/30 hover:text-teal-400 transition-colors"
                                                            >
                                                                View Details
                                                            </button>
                                                            <button 
                                                                onClick={() => { setOpenDropdownId(null); setOrderToEdit(order); setIsAddOrderOpen(true); }}
                                                                className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-teal-900/30 hover:text-teal-400 transition-colors"
                                                            >
                                                                Edit
                                                            </button>
                                                            {order.status?.toLowerCase() === 'trashed' ? (
                                                                <>
                                                                    <button 
                                                                        onClick={() => { setOpenDropdownId(null); updateOrderStatus(order.id, 'Pending'); }}
                                                                        className="w-full text-left px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-900/20 transition-colors flex items-center justify-between"
                                                                    >
                                                                        Restore
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => { setOpenDropdownId(null); deleteOrder(order.id); }}
                                                                        className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-900/30 transition-colors flex items-center justify-between"
                                                                    >
                                                                        Delete <Trash2 size={12} />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <button 
                                                                    onClick={() => handleMoveToTrash(order.id)}
                                                                    className="w-full text-left px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-900/20 transition-colors flex items-center justify-between"
                                                                >
                                                                    Trash <Trash2 size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <AddOrderModal 
                        isOpen={isAddOrderOpen} 
                        onClose={() => { setIsAddOrderOpen(false); setOrderToEdit(null); }} 
                        onSuccess={fetchOrders} 
                        editOrder={orderToEdit}
                    />
                </>
            )}
        </div>
    );
}
