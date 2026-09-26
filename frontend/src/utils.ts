export const calculateOrderTotals = (order: any) => {
    let orderItems = [];
    try {
        orderItems = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
    } catch (e) {}

    // 1. Original Price = catalog price of each item × quantity
    const originalPrice = orderItems.reduce((sum: number, item: any) => sum + (Number(item.quantity || 1) * Number(item.unit_price || 0)), 0);

    // 2. Negotiated Price = order.price
    let negotiatedPrice = Number(order.price || 0);
    
    // Safety check: Negotiated Price must NEVER be higher than Original Price.
    if (originalPrice > 0 && negotiatedPrice > originalPrice) {
        negotiatedPrice = originalPrice;
    }

    // If order has no items, but has a price (edge case), originalPrice will be 0.
    // In that case, we treat originalPrice as the negotiatedPrice.
    const finalOriginalPrice = originalPrice > 0 ? originalPrice : negotiatedPrice;

    // 3. Discount Amount
    let discountAmount = finalOriginalPrice - negotiatedPrice;
    if (discountAmount < 0) discountAmount = 0;

    // 4. Delivery Fee
    const deliveryFee = Number(order.delivery_fee || 0);

    // 5. Total Payable
    const totalPayable = negotiatedPrice + deliveryFee;

    return {
        originalPrice: finalOriginalPrice,
        negotiatedPrice,
        discountAmount,
        deliveryFee,
        totalPayable
    };
};

export const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n);
