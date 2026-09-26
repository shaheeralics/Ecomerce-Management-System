// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
    PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import { Download, Calendar, Activity, ShoppingCart, Users, DollarSign, Filter, Box, MapPin } from 'lucide-react';

const STATUS_COLORS = ['#fbbf24', '#8b5cf6', '#0ea5e9', '#10b981', '#ef4444'];
const CATEGORY_COLORS = ['#fde047', '#0ea5e9', '#3b82f6', '#d946ef', '#c084fc', '#f43f5e'];

const AnalyticsPage = () => {
    const [dateRange, setDateRange] = useState('last30days');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [analyticsData, setAnalyticsData] = useState<any>(null);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            let url = `/api/analytics?range=${dateRange}`;
            if (dateRange === 'custom' && startDate && endDate) {
                url += `&startDate=${startDate}&endDate=${endDate}`;
            }
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setAnalyticsData(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (dateRange !== 'custom') {
            fetchAnalytics();
        }
    }, [dateRange]);

    const renderChange = (value: any) => {
        if (!value) return null;
        const val = parseFloat(value);
        const isPositive = val >= 0;
        return (
            <span className={`text-[10px] font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPositive ? '↑' : '↓'}{isPositive ? '+' : ''}{value}%
            </span>
        );
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(val);
    const formatCurrencyShort = (val: number) => `Rs ${(val/1000).toFixed(0)}K`;
    const formatNumber = (val: number) => new Intl.NumberFormat('en-US').format(val);

    const getRangeLabel = () => {
        if (dateRange === 'custom') return `${startDate} to ${endDate}`;
        const map: Record<string, string> = {
            today: 'Today', yesterday: 'Yesterday', last7days: 'Last 7 Days', last30days: 'Last 30 Days',
            thismonth: 'This Month', lastmonth: 'Last Month', thisyear: 'This Year', alltime: 'All Time'
        };
        return map[dateRange] || 'All Time';
    };

    const handleExport = () => {
        if (!analyticsData) return;
        const { kpi, statusDistribution, categorySales, topProducts, paymentMethods } = analyticsData;
        
        let csv = "data:text/csv;charset=utf-8,";
        
        csv += `Report Period,${getRangeLabel()}\n\n`;
        
        csv += "--- KEY PERFORMANCE INDICATORS ---\n";
        csv += "Metric,Value,Change vs Prev\n";
        csv += `Total Revenue,${kpi.totalRevenue},${kpi.changes?.revenue}%\n`;
        csv += `Total Orders,${kpi.totalOrders},${kpi.changes?.orders}%\n`;
        csv += `Active Customers,${kpi.activeCustomers},${kpi.changes?.customers}%\n`;
        csv += `Average Order Value,${kpi.aov},${kpi.changes?.aov}%\n`;
        csv += `Conversion Rate,${kpi.conversionRate != null ? kpi.conversionRate + '%' : 'N/A'},${kpi.changes?.conversion}%\n\n`;
        
        csv += "--- ORDERS BY STATUS ---\n";
        csv += "Status,Orders\n";
        (statusDistribution || []).forEach((s: any) => csv += `${s.name},${s.value}\n`);
        csv += "\n";
        
        csv += "--- SALES BY CATEGORY ---\n";
        csv += "Category,Revenue\n";
        (categorySales || []).forEach((c: any) => csv += `${c.name},${c.value}\n`);
        csv += "\n";
        
        csv += "--- TOP SELLING PRODUCTS ---\n";
        csv += "Product ID,Name,Units Sold,Revenue\n";
        (topProducts || []).forEach((p: any) => csv += `${p.id},"${p.name}",${p.units_sold},${p.revenue}\n`);
        csv += "\n";
        
        csv += "--- PAYMENT METHODS ---\n";
        csv += "Method,Orders\n";
        (paymentMethods || []).forEach((m: any) => csv += `${m.name},${m.value}\n`);
        
        const encodedUri = encodeURI(csv);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `analytics_report_${dateRange === 'custom' ? startDate+'_to_'+endDate : dateRange}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    if (loading && !analyticsData) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
            </div>
        );
    }

    const { kpi, statusDistribution, paymentMethods, locations, trend, topProducts, categorySales, customerGrowth, ordersTrend } = analyticsData || {};

    const totalCategorySales = categorySales?.reduce((acc: number, val: any) => acc + val.value, 0) || 1;

    return (
        <div className="space-y-4 pb-10 max-w-[1600px] mx-auto text-slate-200">
            {/* Header */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-4 pb-4 border-b border-teal-900/40 gap-4">
                <div>
                    <h3 className="text-2xl font-bold text-white tracking-tight">Analytics & Insights</h3>
                    <p className="text-slate-400 text-xs mt-1">Track your business performance, understand customer behavior, and make data-driven decisions.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 lg:flex-none min-w-[140px]">
                        <select 
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                            className="w-full bg-[#09181E] border border-teal-900/50 text-slate-200 text-xs rounded-lg px-8 py-2.5 outline-none focus:border-teal-500 appearance-none font-medium"
                        >
                            <option value="today">Today</option>
                            <option value="yesterday">Yesterday</option>
                            <option value="last7days">Last 7 Days</option>
                            <option value="last30days">Last 30 Days</option>
                            <option value="thismonth">This Month</option>
                            <option value="lastmonth">Last Month</option>
                            <option value="thisyear">This Year</option>
                            <option value="custom">Custom Range</option>
                        </select>
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    
                    {dateRange === 'custom' && (
                        <div className="flex items-center gap-2">
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-[#09181E] border border-teal-900/50 text-slate-200 text-xs rounded-lg px-2 py-2 outline-none focus:border-teal-500 w-32" />
                            <span className="text-slate-400 text-xs">to</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-[#09181E] border border-teal-900/50 text-slate-200 text-xs rounded-lg px-2 py-2 outline-none focus:border-teal-500 w-32" />
                            <button onClick={fetchAnalytics} className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all">Apply</button>
                        </div>
                    )}

                    <button 
                        onClick={handleExport}
                        className="flex items-center gap-2 bg-transparent border border-cyan-700/50 text-cyan-400 hover:bg-cyan-500/10 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
                    >
                        <Download size={14} /> Export Report
                    </button>
                </div>
            </div>
            
            {/* ROW 1: KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                {/* Revenue */}
                <div className="bg-[#0b1426] border border-teal-900/40 rounded-xl p-4 shadow-lg flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-950/40 rounded-full border border-emerald-900/50 text-emerald-400 shrink-0 flex items-center justify-center w-9 h-9">
                        <span className="font-bold text-sm">Rs</span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="text-[10px] font-semibold text-slate-400 truncate">Total Revenue</h4>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-bold text-white truncate">{formatCurrency(kpi?.totalRevenue || 0)}</p>
                            {renderChange(kpi?.changes?.revenue)}
                        </div>
                        <p className="text-[9px] text-slate-500 mt-0.5 truncate">vs prev period</p>
                    </div>
                </div>
                {/* Orders */}
                <div className="bg-[#0b1426] border border-teal-900/40 rounded-xl p-4 shadow-lg flex items-center gap-3">
                    <div className="p-2.5 bg-cyan-950/40 rounded-full border border-cyan-900/50 text-cyan-400 shrink-0">
                        <ShoppingCart size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="text-[10px] font-semibold text-slate-400 truncate">Total Orders</h4>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-bold text-white truncate">{formatNumber(kpi?.totalOrders || 0)}</p>
                            {renderChange(kpi?.changes?.orders)}
                        </div>
                        <p className="text-[9px] text-slate-500 mt-0.5 truncate">vs prev period</p>
                    </div>
                </div>
                {/* Customers */}
                <div className="bg-[#0b1426] border border-teal-900/40 rounded-xl p-4 shadow-lg flex items-center gap-3">
                    <div className="p-2.5 bg-blue-950/40 rounded-full border border-blue-900/50 text-blue-400 shrink-0">
                        <Users size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="text-[10px] font-semibold text-slate-400 truncate">Active Customers</h4>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-bold text-white truncate">{formatNumber(kpi?.activeCustomers || 0)}</p>
                            {renderChange(kpi?.changes?.customers)}
                        </div>
                        <p className="text-[9px] text-slate-500 mt-0.5 truncate">vs prev period</p>
                    </div>
                </div>
                {/* AOV */}
                <div className="bg-[#0b1426] border border-teal-900/40 rounded-xl p-4 shadow-lg flex items-center gap-3">
                    <div className="p-2.5 bg-amber-950/40 rounded-full border border-amber-900/50 text-amber-400 shrink-0">
                        <Activity size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="text-[10px] font-semibold text-slate-400 truncate">Average Order Value</h4>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-bold text-white truncate">{formatCurrency(kpi?.aov || 0)}</p>
                            {renderChange(kpi?.changes?.aov)}
                        </div>
                        <p className="text-[9px] text-slate-500 mt-0.5 truncate">vs prev period</p>
                    </div>
                </div>
                {/* Conversion */}
                <div className="bg-[#0b1426] border border-teal-900/40 rounded-xl p-4 shadow-lg flex items-center gap-3">
                    <div className="p-2.5 bg-purple-950/40 rounded-full border border-purple-900/50 text-purple-400 shrink-0">
                        <Filter size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="text-[10px] font-semibold text-slate-400 truncate">Conversion Rate</h4>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-bold text-white truncate">{kpi?.conversionRate != null ? `${kpi.conversionRate}%` : 'N/A'}</p>
                            {renderChange(kpi?.changes?.conversion)}
                        </div>
                        <p className="text-[9px] text-slate-500 mt-0.5 truncate">vs prev period</p>
                    </div>
                </div>
            </div>

            {/* ROW 2 */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                
                {/* Revenue Overview Chart */}
                <div className="xl:col-span-2 bg-[#0b1426] border border-teal-900/40 rounded-xl p-5 shadow-lg relative overflow-hidden h-[300px] flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h4 className="text-[11px] font-semibold text-slate-300">Revenue Overview</h4>
                            <div className="flex items-baseline gap-2 mt-1">
                                <p className="text-2xl font-bold text-white">{formatCurrency(kpi?.totalRevenue || 0)}</p>
                                {renderChange(kpi?.changes?.revenue)}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex gap-4 text-[10px] font-medium text-slate-400">
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></div> Revenue</span>
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_#a855f7]"></div> Orders</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trend} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.5} />
                                <XAxis dataKey="date" stroke="#475569" fontSize={9} tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', {month:'short', day:'numeric'})} axisLine={false} tickLine={false} />
                                <YAxis stroke="#475569" fontSize={9} tickFormatter={(val) => `${val/1000}K`} axisLine={false} tickLine={false} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc', fontSize: '11px' }}
                                    formatter={(value: any, name: any) => [name === 'revenue' ? formatCurrency(value) : value, name?.charAt?.(0).toUpperCase() + name?.slice?.(1)]}
                                    labelFormatter={(label: any) => new Date(label).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#22d3ee" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                                <Line type="monotone" dataKey="orders" stroke="#a855f7" strokeWidth={2.5} dot={{r: 3, fill: '#a855f7'}} activeDot={{r: 5}} yAxisId="orders" />
                                <YAxis yAxisId="orders" hide />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Orders by Status */}
                <div className="bg-[#0b1426] border border-teal-900/40 rounded-xl p-5 shadow-lg relative overflow-hidden flex flex-col h-[300px]">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-[11px] font-semibold text-slate-300">Orders by Status</h4>
                    </div>
                    <div className="flex-1 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="h-[150px] sm:h-full w-full sm:w-[45%] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusDistribution?.length ? statusDistribution : [{name:'No Data', value:1}]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="60%"
                                        outerRadius="80%"
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {(statusDistribution?.length ? statusDistribution : [{name:'No Data', value:1}]).map((_entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px' }} itemStyle={{color: '#f8fafc'}} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-xl font-bold text-white">{kpi?.totalOrders || 0}</span>
                                <span className="text-[8px] text-slate-400 uppercase">Total Orders</span>
                            </div>
                        </div>
                        
                        <div className="w-full sm:w-[55%] flex flex-col justify-center space-y-2 mt-4 sm:mt-0">
                            {statusDistribution?.map((item: any, idx: number) => (
                                <div key={item.name} className="flex justify-between items-center text-[10px]">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: STATUS_COLORS[idx % STATUS_COLORS.length]}}></div>
                                        <span className="text-slate-300">{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-white">{item.value}</span>
                                        <span className="text-slate-500 w-8 text-right">{Math.round((item.value / (kpi?.totalOrders || 1)) * 100)}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ROW 3 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Sales by Category */}
                <div className="bg-[#0b1426] border border-teal-900/40 rounded-xl p-5 shadow-lg relative flex flex-col h-[280px]">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-[11px] font-semibold text-slate-300">Sales by Category</h4>
                        <div className="bg-slate-900/50 border border-teal-900/40 text-teal-400 font-medium text-[9px] rounded px-2 py-1">{getRangeLabel()}</div>
                    </div>
                    <div className="flex-1 flex flex-col sm:flex-row items-center justify-between gap-2 mt-2 sm:mt-0">
                        <div className="h-[150px] sm:h-full w-full sm:w-[45%] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categorySales?.length ? categorySales : [{name:'No Data', value:1}]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="50%"
                                        outerRadius="80%"
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {(categorySales?.length ? categorySales : [{name:'No Data', value:1}]).map((_entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-xs font-bold text-white">{formatCurrencyShort(totalCategorySales)}</span>
                                <span className="text-[8px] text-slate-400 uppercase">Total Sales</span>
                            </div>
                        </div>
                        
                        <div className="w-full sm:w-[55%] flex flex-col justify-center space-y-1.5 mt-4 sm:mt-0">
                            {categorySales?.map((item: any, idx: number) => (
                                <div key={item.name} className="flex justify-between items-center text-[9px]">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}}></div>
                                        <span className="text-slate-300 truncate w-14">{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-200">{formatCurrency(item.value)}</span>
                                        <span className="text-slate-500 w-6 text-right">{Math.round((item.value / totalCategorySales) * 100)}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Top Selling Products */}
                <div className="bg-[#0b1426] border border-teal-900/40 rounded-xl p-5 shadow-lg flex flex-col h-[280px]">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-[11px] font-semibold text-slate-300">Top Selling Products</h4>
                        <div className="bg-slate-900/50 border border-teal-900/40 text-teal-400 font-medium text-[9px] rounded px-2 py-1">{getRangeLabel()}</div>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {topProducts?.map((product: any, idx: number) => (
                            <div key={product.id || idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/30 hover:bg-slate-800/50 transition-colors group">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-400 shrink-0">
                                        {idx + 1}
                                    </div>
                                    {product.image ? (
                                        <img src={product.image} className="w-8 h-8 object-cover rounded bg-slate-800 shrink-0" alt={product.name} />
                                    ) : (
                                        <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center shrink-0"><Box size={14} className="text-slate-500"/></div>
                                    )}
                                    <div className="min-w-0">
                                        <h5 className="text-[10px] font-medium text-white truncate">{product.name || 'Unknown Product'}</h5>
                                        <p className="text-[9px] text-slate-400">{product.units_sold} sold</p>
                                    </div>
                                </div>
                                <div className="shrink-0 text-right">
                                    <p className="text-[10px] font-semibold text-slate-300">{formatCurrency(product.revenue)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Customer Growth */}
                <div className="bg-[#0b1426] border border-teal-900/40 rounded-xl p-5 shadow-lg flex flex-col h-[280px]">
                    <div className="flex justify-between items-center mb-2">
                        <div>
                            <h4 className="text-[11px] font-semibold text-slate-300">Customer Growth</h4>
                            <div className="flex items-baseline gap-2 mt-0.5">
                                <p className="text-xl font-bold text-white">{kpi?.activeCustomers || 0}</p>
                                {renderChange(kpi?.changes?.customers)}
                            </div>
                            <p className="text-[9px] text-slate-500">New customers</p>
                        </div>
                        <div className="bg-slate-900/50 border border-teal-900/40 text-teal-400 font-medium text-[9px] rounded px-2 py-1 self-start">{getRangeLabel()}</div>
                    </div>
                    <div className="flex-1 w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={customerGrowth} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.5} />
                                <XAxis dataKey="date" stroke="#475569" fontSize={8} tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', {month:'short', day:'numeric'})} axisLine={false} tickLine={false} />
                                <YAxis stroke="#475569" fontSize={8} axisLine={false} tickLine={false} />
                                <Tooltip 
                                    cursor={{fill: '#1e293b', opacity: 0.4}}
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px' }}
                                    labelFormatter={(label: any) => new Date(label).toLocaleDateString('en-US', {month:'short', day:'numeric'})}
                                />
                                <Bar dataKey="customers" fill="#0ea5e9" radius={[2, 2, 0, 0]} barSize={6} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* ROW 4 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Top Customer Locations */}
                <div className="bg-[#0b1426] border border-teal-900/40 rounded-xl p-5 shadow-lg h-[240px]">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-[11px] font-semibold text-slate-300">Top Customer Locations</h4>
                        <div className="bg-slate-900/50 border border-teal-900/40 text-teal-400 font-medium text-[9px] rounded px-2 py-1">{getRangeLabel()}</div>
                    </div>
                    <div className="space-y-3">
                        {locations?.map((loc: any) => (
                            <div key={loc.name} className="flex items-center gap-3">
                                <MapPin size={12} className="text-slate-500 shrink-0"/>
                                <span className="text-[10px] text-slate-300 w-16 truncate">{loc.name}</span>
                                <span className="text-[10px] text-slate-400 w-12 text-right">{loc.value} orders</span>
                                <div className="flex-1 bg-slate-800/80 h-1.5 rounded-full overflow-hidden mx-2">
                                    <div className="bg-cyan-500 h-full rounded-full shadow-[0_0_8px_#06b6d4]" style={{ width: `${(loc.value / (kpi?.totalOrders || 1)) * 100}%` }}></div>
                                </div>
                                <span className="text-[10px] font-medium text-slate-200 w-6 text-right">{Math.round((loc.value / (kpi?.totalOrders || 1)) * 100)}%</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Orders Trend */}
                <div className="bg-[#0b1426] border border-teal-900/40 rounded-xl p-5 shadow-lg flex flex-col h-[240px]">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-[11px] font-semibold text-slate-300">Orders Trend</h4>
                        <div className="flex items-center gap-3">
                            <div className="flex gap-3 text-[9px] font-medium text-slate-400">
                                <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> New Orders</span>
                                <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Delivered Orders</span>
                            </div>
                            <div className="bg-slate-900/50 border border-teal-900/40 text-teal-400 font-medium text-[9px] rounded px-2 py-1">{getRangeLabel()}</div>
                        </div>
                    </div>
                    <div className="flex-1 w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={ordersTrend} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.5} />
                                <XAxis dataKey="date" stroke="#475569" fontSize={8} tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', {month:'short', day:'numeric'})} axisLine={false} tickLine={false} />
                                <YAxis stroke="#475569" fontSize={8} axisLine={false} tickLine={false} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px' }}
                                    labelFormatter={(label: any) => new Date(label).toLocaleDateString('en-US', {month:'short', day:'numeric'})}
                                />
                                <Line type="monotone" dataKey="newOrders" name="New Orders" stroke="#3b82f6" strokeWidth={2} dot={{r: 2, fill: '#3b82f6'}} activeDot={{r: 4}} />
                                <Line type="monotone" dataKey="deliveredOrders" name="Delivered Orders" stroke="#10b981" strokeWidth={2} dot={{r: 2, fill: '#10b981'}} activeDot={{r: 4}} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Payment Methods */}
                <div className="bg-[#0b1426] border border-teal-900/40 rounded-xl p-5 shadow-lg h-[240px]">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="text-[11px] font-semibold text-slate-300">Payment Methods</h4>
                        <div className="bg-slate-900/50 border border-teal-900/40 text-teal-400 font-medium text-[9px] rounded px-2 py-1">{getRangeLabel()}</div>
                    </div>
                    <div className="space-y-5">
                        {paymentMethods?.map((method: any, idx: number) => {
                            const colors = ['bg-cyan-500 shadow-[0_0_8px_#06b6d4]', 'bg-blue-500 shadow-[0_0_8px_#3b82f6]', 'bg-purple-500 shadow-[0_0_8px_#a855f7]', 'bg-pink-500 shadow-[0_0_8px_#ec4899]'];
                            const colorClass = colors[idx % colors.length];
                            return (
                                <div key={method.name}>
                                    <div className="flex justify-between items-center mb-1.5 text-[10px]">
                                        <span className="text-slate-300 font-medium capitalize truncate w-32">{method.name.replace(/_/g, ' ')}</span>
                                        <span className="font-bold text-slate-200">{Math.round((method.value / (kpi?.totalOrders || 1)) * 100)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${(method.value / (kpi?.totalOrders || 1)) * 100}%` }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPage;
