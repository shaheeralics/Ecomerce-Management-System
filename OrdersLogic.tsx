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
