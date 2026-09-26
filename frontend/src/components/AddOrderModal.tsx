import { useState, useEffect } from 'react';
import { X, Search, Plus, Trash2, Box, Truck, CreditCard, User } from 'lucide-react';

interface AddOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editOrder?: any;
}

export default function AddOrderModal({ isOpen, onClose, onSuccess, editOrder }: AddOrderModalProps) {
    // Customer State
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerResults, setCustomerResults] = useState<any[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    
    // Product State
    const [productSearch, setProductSearch] = useState('');
    const [productResults, setProductResults] = useState<any[]>([]);
    const [availableProducts, setAvailableProducts] = useState<any[]>([]);
    const [visibleCount, setVisibleCount] = useState(5);
    
    // Items State
    const [items, setItems] = useState<any[]>([]);
    
    // Delivery & Payment State
    const [deliveryMethod, setDeliveryMethod] = useState('Standard');
    const [deliveryFee, setDeliveryFee] = useState(250);
    const [paymentMethod, setPaymentMethod] = useState('COD');
    const [paymentStatus, setPaymentStatus] = useState('Pending');
    const [orderStatus, setOrderStatus] = useState('Pending');

    useEffect(() => {
        if (isOpen) {
            fetch('/api/products')
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        const available = data.data.filter((p: any) => p.status === 'available');
                        setAvailableProducts(available);
                        setProductResults(available);
                    }
                }).catch(err => console.error('Failed to fetch initial products', err));

            if (editOrder) {
                setCustomerName(editOrder.customer_name || '');
                setCustomerPhone(editOrder.customer_phone || '');
                setAddress(editOrder.address || '');
                setCity(editOrder.city || '');
                
                setDeliveryMethod(editOrder.delivery_method || 'Standard');
                setDeliveryFee(editOrder.delivery_fee ?? 250);
                setPaymentMethod(editOrder.payment_method || 'COD');
                setPaymentStatus(editOrder.payment_status || 'Pending');
                setOrderStatus(editOrder.status || 'Pending');
                
                let orderItems = [];
                try {
                    orderItems = typeof editOrder.items === 'string' ? JSON.parse(editOrder.items) : (editOrder.items || []);
                } catch(e) {}
                
                if (orderItems.length === 0 && editOrder.product_id) {
                    orderItems = [{
                        product_id: editOrder.product_id,
                        title: editOrder.product_title || editOrder.custom_product_name,
                        unit_price: editOrder.price - (editOrder.delivery_fee || 0),
                        quantity: 1
                    }];
                }
                setItems(orderItems);
            } else {
                setCustomerName(''); setCustomerPhone(''); setAddress(''); setCity('');
                setDeliveryMethod('Standard'); setDeliveryFee(250);
                setPaymentMethod('COD'); setPaymentStatus('Pending'); setOrderStatus('Pending');
                setItems([]);
                setCustomerSearch(''); setProductSearch('');
                setSelectedCustomer(null);
            }
        }
    }, [isOpen, editOrder]);

    // Searching Customers
    useEffect(() => {
        if (!customerSearch || selectedCustomer) {
            setCustomerResults([]);
            return;
        }
        const delay = setTimeout(async () => {
            try {
                const res = await fetch(`/api/orders/customers/search?q=${encodeURIComponent(customerSearch)}`);
                const data = await res.json();
                if (data.success) setCustomerResults(data.data);
            } catch (err) { }
        }, 300);
        return () => clearTimeout(delay);
    }, [customerSearch, selectedCustomer]);

    // Searching Products
    useEffect(() => {
        if (!productSearch) {
            setProductResults(availableProducts);
            return;
        }
        const delay = setTimeout(async () => {
            try {
                const res = await fetch(`/api/products/search/query?q=${encodeURIComponent(productSearch)}`);
                const data = await res.json();
                if (data.success) {
                    const available = data.data.filter((p: any) => p.status === 'available');
                    setProductResults(available);
                }
            } catch (err) { }
        }, 300);
        return () => clearTimeout(delay);
    }, [productSearch, availableProducts]);

    const selectCustomer = (cust: any) => {
        setSelectedCustomer(cust);
        setCustomerName(cust.customer_name || '');
        setCustomerPhone(cust.customer_phone || '');
        setAddress(cust.address || '');
        setCity(cust.city || '');
        setCustomerSearch('');
        setCustomerResults([]);
    };

    const addProduct = (prod: any) => {
        setItems(prev => [...prev, {
            product_id: prod.id,
            title: prod.title,
            main_image_url: prod.main_image_url,
            size: prod.size_original || 'Standard',
            quantity: 1,
            unit_price: Number(prod.starting_price || 0),
            negotiated_price: Number(prod.starting_price || 0)
        }]);
        setProductSearch('');
        setProductResults([]);
    };

    const updateItem = (index: number, field: string, value: any) => {
        setItems(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const removeItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const subtotal = items.reduce((acc, item) => acc + (item.quantity * (item.negotiated_price ?? item.unit_price)), 0);
    const originalSubtotal = items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    const total = subtotal + Number(deliveryFee);

    const handleSubmit = async () => {
        if (!customerName || !customerPhone || items.length === 0) {
            alert("Please provide customer details and at least one item.");
            return;
        }
        
        try {
            const url = editOrder ? `/api/orders/${editOrder.id}` : '/api/orders';
            const method = editOrder ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    address,
                    city,
                    product_id: items[0].product_id, // Backward compatibility
                    custom_product_name: items[0].title, // Backward compatibility
                    price: subtotal,
                    status: orderStatus,
                    payment_status: paymentStatus,
                    payment_method: paymentMethod,
                    delivery_method: deliveryMethod,
                    delivery_fee: deliveryFee,
                    items
                })
            });
            const data = await res.json();
            if (data.success) {
                onSuccess();
                onClose();
            } else {
                alert("Failed to save order");
            }
        } catch (err) {
            alert("Error saving order");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-[#050D10] border border-teal-900/50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-teal-900/30 bg-[#09181E]">
                    <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                        {editOrder ? <CreditCard className="text-teal-500" /> : <Plus className="text-teal-500" />} 
                        {editOrder ? 'Edit Order' : 'Add New Order'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-teal-900/30 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    
                    {/* Customer Section */}
                    <section>
                        <h3 className="text-sm font-bold text-teal-500 uppercase tracking-wider mb-4 flex items-center gap-2"><User size={16}/> Customer Details</h3>
                        
                        {!selectedCustomer && (
                            <div className="relative mb-4">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Search existing customer by name or phone..." 
                                    value={customerSearch}
                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                    className="w-full bg-[#09181E] border border-teal-900/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-100 outline-none focus:border-teal-500"
                                />
                                {customerResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#09181E] border border-teal-900/50 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                                        {customerResults.map((c, i) => (
                                            <div key={i} onClick={() => selectCustomer(c)} className="px-4 py-3 hover:bg-teal-900/30 cursor-pointer border-b border-teal-900/20 last:border-0">
                                                <p className="text-sm font-bold text-slate-200">{c.customer_name}</p>
                                                <p className="text-xs text-slate-400">{c.customer_phone} • {c.city}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Full Name *</label>
                                <input type="text" value={customerName} onChange={e => {setCustomerName(e.target.value); setSelectedCustomer(null);}} className="w-full bg-[#09181E] border border-teal-900/50 rounded-xl px-4 py-2 text-sm text-slate-100" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Phone Number *</label>
                                <input type="text" value={customerPhone} onChange={e => {setCustomerPhone(e.target.value); setSelectedCustomer(null);}} className="w-full bg-[#09181E] border border-teal-900/50 rounded-xl px-4 py-2 text-sm text-slate-100" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-400 mb-1">Complete Address</label>
                                <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-[#09181E] border border-teal-900/50 rounded-xl px-4 py-2 text-sm text-slate-100" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">City</label>
                                <input type="text" value={city} onChange={e => setCity(e.target.value)} className="w-full bg-[#09181E] border border-teal-900/50 rounded-xl px-4 py-2 text-sm text-slate-100" />
                            </div>
                        </div>
                    </section>

                    <div className="h-px bg-teal-900/30"></div>

                    {/* Products Section */}
                    <section>
                        <h3 className="text-sm font-bold text-teal-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Box size={16}/> Order Items</h3>
                        
                        <div className="relative mb-4">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search product to add..." 
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                className="w-full bg-[#09181E] border border-teal-900/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-100 outline-none focus:border-teal-500"
                            />
                        </div>
                        
                        {productResults.length > 0 && (
                            <div className="mb-6 bg-[#050D10] border border-teal-900/50 rounded-xl overflow-hidden shadow-inner">
                                <div className="max-h-56 overflow-y-auto">
                                    {productResults.slice(0, visibleCount).map((p, i) => (
                                        <div key={i} onClick={() => addProduct(p)} className="flex items-center gap-3 px-4 py-3 hover:bg-teal-900/30 cursor-pointer border-b border-teal-900/20 last:border-0 transition-colors">
                                            {p.main_image_url ? (
                                                <img src={p.main_image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-teal-900/30" />
                                            ) : <div className="w-10 h-10 rounded-lg bg-teal-900/50 border border-teal-900/30 flex items-center justify-center text-teal-700"><Box size={16}/></div>}
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-slate-200">{p.title}</p>
                                                <p className="text-xs text-teal-400">Rs {p.starting_price}</p>
                                            </div>
                                            <div className="bg-teal-900/40 text-teal-400 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-teal-800/60 transition-colors">Add Item +</div>
                                        </div>
                                    ))}
                                </div>
                                {visibleCount < productResults.length && (
                                    <div className="border-t border-teal-900/30 bg-[#09181E]">
                                        <button 
                                            onClick={() => setVisibleCount(prev => prev + 5)}
                                            className="w-full py-2.5 text-xs font-semibold text-teal-400 hover:text-teal-300 hover:bg-teal-900/20 transition-colors"
                                        >
                                            Load More ({productResults.length - visibleCount} items left)
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {items.length > 0 && (
                            <div className="border border-teal-900/40 rounded-xl overflow-hidden bg-[#09181E]">
                                <table className="w-full text-left">
                                    <thead className="bg-[#050D10]/50 border-b border-teal-900/30 text-[10px] uppercase text-teal-500">
                                        <tr>
                                            <th className="px-4 py-2 font-bold">Product</th>
                                            <th className="px-4 py-2 font-bold">Size</th>
                                            <th className="px-4 py-2 font-bold w-24">Qty</th>
                                            <th className="px-4 py-2 font-bold w-24">Original</th>
                                            <th className="px-4 py-2 font-bold w-24">Negotiated</th>
                                            <th className="px-4 py-2 font-bold w-28">Subtotal</th>
                                            <th className="px-4 py-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-teal-900/20">
                                        {items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="px-4 py-3 text-sm text-slate-200">{item.title}</td>
                                                <td className="px-4 py-3">
                                                    <input type="text" value={item.size} onChange={e => updateItem(idx, 'size', e.target.value)} className="w-full bg-[#050D10] border border-teal-900/50 rounded px-2 py-1 text-xs text-slate-200" />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} className="w-full bg-[#050D10] border border-teal-900/50 rounded px-2 py-1 text-xs text-slate-200" />
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-400 line-through">
                                                    Rs {Number(item.unit_price).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input type="number" value={item.negotiated_price ?? item.unit_price} onChange={e => updateItem(idx, 'negotiated_price', Number(e.target.value))} className="w-full bg-[#050D10] border border-teal-900/50 rounded px-2 py-1 text-xs text-teal-300 font-bold" />
                                                </td>
                                                <td className="px-4 py-3 text-sm font-bold text-teal-400">
                                                    Rs {(item.quantity * (item.negotiated_price ?? item.unit_price)).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {items.length === 0 && (
                            <div className="text-center py-6 text-sm text-slate-500 border border-dashed border-teal-900/40 rounded-xl">
                                No items added yet. Search a product above.
                            </div>
                        )}
                    </section>

                    <div className="h-px bg-teal-900/30"></div>

                    {/* Footer / Meta Section */}
                    <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-teal-500 uppercase tracking-wider flex items-center gap-2"><Truck size={16}/> Delivery & Payment</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Delivery Method</label>
                                    <select value={deliveryMethod} onChange={e => setDeliveryMethod(e.target.value)} className="w-full bg-[#09181E] border border-teal-900/50 rounded-xl px-4 py-2 text-sm text-slate-100 outline-none">
                                        <option value="Standard">Standard</option>
                                        <option value="Express">Express</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Delivery Fee</label>
                                    <input type="number" value={deliveryFee} onChange={e => setDeliveryFee(Number(e.target.value))} className="w-full bg-[#09181E] border border-teal-900/50 rounded-xl px-4 py-2 text-sm text-slate-100 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Payment Method</label>
                                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full bg-[#09181E] border border-teal-900/50 rounded-xl px-4 py-2 text-sm text-slate-100 outline-none">
                                        <option value="COD">COD</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Credit Card">Credit Card</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Payment Status</label>
                                    <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className="w-full bg-[#09181E] border border-teal-900/50 rounded-xl px-4 py-2 text-sm text-slate-100 outline-none">
                                        <option value="Pending">Pending</option>
                                        <option value="Paid">Paid</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#09181E] border border-teal-900/40 rounded-xl p-6 h-fit">
                            <h3 className="text-sm font-bold text-teal-500 uppercase tracking-wider mb-4 flex items-center gap-2"><CreditCard size={16}/> Summary</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between text-slate-300">
                                    <span>Original Subtotal</span>
                                    <span className="font-semibold">Rs {originalSubtotal.toLocaleString()}</span>
                                </div>
                                {originalSubtotal > subtotal && (
                                    <div className="flex justify-between text-red-400">
                                        <span>Discount</span>
                                        <span className="font-bold">-Rs {(originalSubtotal - subtotal).toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-slate-300">
                                    <span>Negotiated Subtotal</span>
                                    <span className="font-semibold">Rs {subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-slate-300 pb-3 border-b border-teal-900/30">
                                    <span>Delivery Fee</span>
                                    <span className="font-semibold">Rs {deliveryFee.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold text-teal-400 pt-1">
                                    <span>Grand Total</span>
                                    <span>Rs {total.toLocaleString()}</span>
                                </div>
                            </div>
                            
                            <div className="mt-6">
                                <label className="block text-xs font-bold text-slate-400 mb-1">Initial Order Status</label>
                                <select value={orderStatus} onChange={e => setOrderStatus(e.target.value)} className="w-full bg-[#050D10] border border-teal-900/50 rounded-xl px-4 py-2 text-sm text-slate-100 outline-none mb-4">
                                    <option value="Pending">Pending</option>
                                    <option value="Confirmed">Confirmed</option>
                                </select>
                            </div>

                            <button 
                                onClick={handleSubmit}
                                disabled={items.length === 0 || !customerName || !customerPhone}
                                className="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-teal-900/50 disabled:text-teal-700 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-teal-600/20"
                            >
                                Create Order
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
