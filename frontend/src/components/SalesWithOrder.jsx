import React, { useState, useEffect, useMemo } from 'react';
import { mastersAPI, transactionsAPI } from '../service/api';
import { 
    Save, ShoppingCart, Search, Plus, RefreshCw,
    ChevronLeft, ChevronRight, X, ArrowRightCircle,
    CheckCircle2, Database, Activity, Filter, Info,
    Loader2, MinusCircle
} from 'lucide-react';

const SalesWithOrder = () => {
    // --- Initial States (100% preserved) ---
    const emptyHeader = {
        id: null,
        order_no: '',
        date: new Date().toISOString().split('T')[0],
        party_id: '',
        broker_id: '',
        place: '',
        is_cancelled: false,
        status: 'OPEN'
    };

    const emptyRow = {
        product_id: '',
        rate_cr: 0,
        rate_imm: 0,
        rate_per: '',
        qty: 0,
        packing_type: '',
        bag_wt: 0
    };

    // --- Main States (100% preserved) ---
    const [list, setList] = useState([]);
    const [formData, setFormData] = useState(emptyHeader);
    const [gridRows, setGridRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('head');
    const [showSuccess, setShowSuccess] = useState(false);

    // Master Data (100% preserved)
    const [parties, setParties] = useState([]);
    const [brokers, setBrokers] = useState([]);
    const [products, setProducts] = useState([]);

    // Filtering & Pagination (100% preserved)
    const [searchField, setSearchField] = useState('order_no');
    const [searchValue, setSearchValue] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const totalQty = useMemo(() => 
        gridRows.reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0), 
    [gridRows]);

    useEffect(() => {
        fetchMasters();
        fetchRecords();
    }, []);

    const fetchMasters = async () => {
        try {
            const [p, b, pr] = await Promise.all([
                mastersAPI.accounts.getAll(),
                mastersAPI.brokers.getAll(),
                mastersAPI.products.getAll()
            ]);
            setParties(p.data.data || []);
            setBrokers(b.data.data || []);
            setProducts(pr.data.data || []);
        } catch (err) { 
            console.error("Master Load Error", err); 
        }
    };

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await transactionsAPI.orders.getAll();
            setList(res.data.data || []);
        } catch (err) { 
            console.error("Fetch Error", err); 
        } finally { 
            setLoading(false); 
        }
    };

    const handleAddNew = () => {
        const nextNo = list.length > 0 
            ? Math.max(...list.map(o => parseInt(o.order_no) || 0)) + 1 
            : 1;
        
        setFormData({ ...emptyHeader, order_no: String(nextNo) });
        setGridRows([{ ...emptyRow }]);
        setActiveTab('head');
        setIsModalOpen(true);
    };

    const updateGrid = (index, field, value) => {
        const updated = [...gridRows];
        if (field === 'product_id') {
            const product = products.find(p => String(p.id) === String(value));
            updated[index] = {
                ...updated[index],
                product_id: value,
                packing_type: product ? product.packing_type : '',
                bag_wt: product ? product.pack_nett_wt : 0,
            };
        } else {
            updated[index][field] = value;
        }
        setGridRows(updated);
    };

    const handleSave = async () => {
        if (!formData.party_id) return alert("Customer required");
        const validDetails = gridRows.filter(r => r.product_id !== '');
        if (validDetails.length === 0) return alert("Add at least one product line");

        setSubmitLoading(true);
        try {
            const payload = { ...formData, OrderDetails: validDetails };
            if (formData.id) {
                await transactionsAPI.orders.update(formData.id, payload);
            } else {
                await transactionsAPI.orders.create(payload);
            }
            
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
            setIsModalOpen(false);
            fetchRecords();
        } catch (err) { 
            alert("Save failed"); 
        } finally { 
            setSubmitLoading(false); 
        }
    };

    const handleRowClick = (item) => {
        setFormData({ ...item });
        setGridRows(
            item.OrderDetails?.length > 0 
                ? item.OrderDetails.map(d => ({ ...d })) 
                : [{ ...emptyRow }]
        );
        setActiveTab('head');
        setIsModalOpen(true);
    };

    // --- Dynamic Filtering Logic (100% preserved) ---
    const filteredData = useMemo(() => {
        let result = Array.isArray(list) ? [...list] : [];
        if (searchValue.trim()) {
            result = result.filter(item => {
                const val = searchField === 'party' 
                    ? item.Party?.account_name 
                    : item[searchField];
                return String(val || '').toLowerCase().includes(searchValue.toLowerCase());
            });
        }
        return result.sort((a, b) => b.id - a.id);
    }, [list, searchValue, searchField]);

    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
    const currentItems = filteredData.slice(
        (currentPage - 1) * itemsPerPage, 
        currentPage * itemsPerPage
    );

    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
            
            {/* SUCCESS OVERLAY (preserved) */}
            {showSuccess && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white p-10 rounded-3xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in">
                        <CheckCircle2 size={72} className="text-emerald-500" />
                        <h3 className="text-2xl font-black text-slate-800">Order Committed Successfully</h3>
                    </div>
                </div>
            )}

            {/* HEADER (styled exactly like AccountMaster) */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        <ShoppingCart className="text-blue-600" size={32} /> 
                        Sales Booking Master
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Capture sales orders and manage itemized SKU bookings</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleAddNew} 
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-semibold shadow-md transition-all active:scale-95 text-sm"
                    >
                        <Plus size={18} /> New Booking
                    </button>
                    <button 
                        onClick={fetchRecords} 
                        className="p-3 border border-slate-200 rounded-2xl bg-white text-slate-400 hover:text-blue-600 transition-colors"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* FILTER BAR (styled exactly like AccountMaster) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-end">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Search Field</label>
                        <select 
                            value={searchField} 
                            onChange={(e) => setSearchField(e.target.value)}
                            className="w-full border border-slate-200 p-3 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="order_no">Order Number</option>
                            <option value="party">Party Name</option>
                            <option value="place">Place</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Quick Search</label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                className="w-full border border-slate-200 pl-12 py-3 rounded-xl text-sm font-medium bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Type to search..."
                            />
                        </div>
                    </div>
                    <div className="bg-blue-50 text-blue-600 border border-blue-100 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2">
                        <Filter size={16}/> {filteredData.length} Records Found
                    </div>
                </div>
            </div>

            {/* REGISTRY TABLE (styled exactly like AccountMaster) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-blue-600 text-white font-mono">
                                <th className="p-5 text-sm font-semibold uppercase tracking-wider">Order Ref</th>
                                <th className="p-5 text-sm font-semibold uppercase tracking-wider">Date</th>
                                <th className="p-5 text-sm font-semibold uppercase tracking-wider">Party / Customer</th>
                                <th className="p-5 text-sm font-semibold uppercase tracking-wider">Place</th>
                                <th className="p-5 text-sm font-semibold uppercase tracking-wider text-center">Status</th>
                                <th className="p-5 w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-24">
                                        <div className="flex flex-col items-center justify-center">
                                            <Loader2 size={48} className="animate-spin text-blue-500 mb-4" />
                                            <p className="text-slate-500 font-medium">Loading orders...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : currentItems.length > 0 ? (
                                currentItems.map((item) => (
                                    <tr 
                                        key={item.id} 
                                        onClick={() => handleRowClick(item)}
                                        className="transition-all cursor-pointer hover:bg-blue-50/70 group"
                                    >
                                        <td className="p-5 font-black text-blue-600">#{item.order_no}</td>
                                        <td className="p-5 text-slate-500 font-medium">{item.date}</td>
                                        <td className="p-5 font-semibold text-slate-700 uppercase">{item.Party?.account_name}</td>
                                        <td className="p-5 text-slate-500 uppercase text-sm font-medium">{item.place || '—'}</td>
                                        <td className="p-5 text-center">
                                            <span className={`inline-block px-5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${item.is_cancelled ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-emerald-100 text-emerald-600 border border-emerald-200'}`}>
                                                {item.is_cancelled ? 'CANCELLED' : 'OPEN'}
                                            </span>
                                        </td>
                                        <td className="p-5">
                                            <ArrowRightCircle size={20} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="py-28 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <ShoppingCart size={56} className="text-slate-300 mb-6" />
                                            <h3 className="text-2xl font-semibold text-slate-800">No orders yet</h3>
                                            <p className="text-slate-500 mt-2">Click New Booking to create your first order</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination (styled exactly like AccountMaster) */}
                <div className="p-5 bg-slate-50 border-t flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">Page {currentPage} of {totalPages}</span>
                    <div className="flex gap-2">
                        <button 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                            className="p-3 border rounded-2xl bg-white disabled:opacity-40 hover:bg-slate-100"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button 
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                            className="p-3 border rounded-2xl bg-white disabled:opacity-40 hover:bg-slate-100"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* FULL SCREEN MODAL (styled exactly like AccountMaster) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[94vh]">
                        
                        {/* Modal Header */}
                        <div className="bg-blue-600 px-8 py-6 text-white flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 p-3 rounded-2xl">
                                    <ShoppingCart size={26} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold tracking-tight">Order Management</h2>
                                    <p className="text-blue-100 text-sm">#{formData.order_no || 'NEW'} • {formData.id ? 'Edit Mode' : 'New Entry'}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)} 
                                className="p-2 hover:bg-white/20 rounded-full transition"
                            >
                                <X size={28} />
                            </button>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex border-b bg-slate-50 px-8">
                            <button 
                                onClick={() => setActiveTab('head')}
                                className={`px-8 py-5 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'head' ? 'text-blue-600' : 'text-slate-500'}`}
                            >
                                01. HEADER INFO
                                {activeTab === 'head' && <div className="absolute bottom-0 left-0 h-0.5 w-full bg-blue-600" />}
                            </button>
                            <button 
                                onClick={() => setActiveTab('detail')}
                                className={`px-8 py-5 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'detail' ? 'text-blue-600' : 'text-slate-500'}`}
                            >
                                02. ITEMIZATION
                                {activeTab === 'detail' && <div className="absolute bottom-0 left-0 h-0.5 w-full bg-blue-600" />}
                            </button>
                        </div>

                        {/* Modal Body - Split Layout (exactly like AccountMaster) */}
                        <div className="flex-1 overflow-auto p-8 bg-slate-50 flex flex-col lg:flex-row gap-8">
                            
                            {activeTab === 'head' ? (
                                <>
                                    {/* LEFT: Header Form */}
                                    <div className="flex-1 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <InputField 
                                                label="Order Reference #" 
                                                value={formData.order_no} 
                                                readOnly 
                                                className="bg-blue-50 border-blue-100 text-blue-600" 
                                            />
                                            <InputField 
                                                label="Booking Date" 
                                                type="date" 
                                                value={formData.date} 
                                                onChange={e => setFormData({...formData, date: e.target.value})} 
                                            />

                                            <div className="md:col-span-2">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Customer / Party Name</label>
                                                <select 
                                                    value={formData.party_id} 
                                                    onChange={e => setFormData({...formData, party_id: e.target.value})}
                                                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="">-- SEARCH CLIENT DATABASE --</option>
                                                    {parties.map(p => (
                                                        <option key={p.id} value={p.id}>{p.account_name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <InputField 
                                                label="Shipping Destination" 
                                                value={formData.place} 
                                                onChange={e => setFormData({...formData, place: e.target.value.toUpperCase()})} 
                                                placeholder="E.G. CHENNAI, MUMBAI"
                                            />

                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Assigned Broker</label>
                                                <select 
                                                    value={formData.broker_id} 
                                                    onChange={e => setFormData({...formData, broker_id: e.target.value})}
                                                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="">DIRECT (NO BROKER)</option>
                                                    {brokers.map(b => (
                                                        <option key={b.id} value={b.id}>{b.broker_name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* RIGHT: Metadata Sidebar (preserved logic) */}
                                    <div className="w-full lg:w-96 bg-slate-900 rounded-3xl p-8 text-white flex flex-col gap-6 shadow-2xl">
                                        <div className="text-center pb-6 border-b border-slate-800">
                                            <Database size={48} className="text-blue-500 mx-auto mb-3" />
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Metadata Control</p>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-800">
                                                <label className="text-[9px] font-black text-slate-400 uppercase block mb-2 tracking-widest">Order Status</label>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-3 h-3 rounded-full ${formData.is_cancelled ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                                    <span className="text-sm font-black uppercase tracking-widest">{formData.is_cancelled ? 'Cancelled' : 'Active'}</span>
                                                </div>
                                            </div>
                                            <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-800">
                                                <label className="text-[9px] font-black text-slate-400 uppercase block mb-2 tracking-widest">Internal ID</label>
                                                <div className="font-mono font-bold text-blue-400 tracking-widest flex items-center gap-2">
                                                    <span>#{formData.id || 'NEW_SEQ'}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setFormData({...formData, is_cancelled: !formData.is_cancelled})}
                                                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${formData.is_cancelled ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
                                            >
                                                {formData.is_cancelled ? 'RESTORE ORDER' : 'CANCEL ORDER'}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                /* DETAIL TAB - Split exactly like AccountMaster */
                                <>
                                    {/* LEFT: Dynamic Grid Table (preserved logic) */}
                                    <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-slate-900 text-white text-xs font-black uppercase tracking-widest">
                                                <tr>
                                                    <th className="p-6 text-left">SKU / Product Detail</th>
                                                    <th className="p-6 text-center w-32">Packing</th>
                                                    <th className="p-6 text-center w-32">Bag Wt</th>
                                                    <th className="p-6 text-center w-32">Rate (CR)</th>
                                                    <th className="p-6 text-center w-32">Rate (IMM)</th>
                                                    <th className="p-6 text-center w-24">Per</th>
                                                    <th className="p-6 text-center w-40">Booking Qty</th>
                                                    <th className="p-6 w-16"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-mono text-sm">
                                                {gridRows.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                                                        <td className="p-4">
                                                            <select 
                                                                value={row.product_id} 
                                                                onChange={e => updateGrid(idx, 'product_id', e.target.value)}
                                                                className="w-full bg-transparent border border-slate-200 p-3 rounded-2xl text-blue-600 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                                                            >
                                                                <option value="">-- SELECT PRODUCT --</option>
                                                                {products.map(p => (
                                                                    <option key={p.id} value={p.id}>{p.product_name}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="p-4 text-center text-slate-400 font-medium">{row.packing_type || '—'}</td>
                                                        <td className="p-4 text-center text-slate-400 font-medium">{row.bag_wt ? `${row.bag_wt} KG` : '—'}</td>
                                                        <td className="p-4">
                                                            <input 
                                                                type="number" 
                                                                value={row.rate_cr} 
                                                                onChange={e => updateGrid(idx, 'rate_cr', e.target.value)}
                                                                className="w-full p-3 text-center font-semibold text-blue-700 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" 
                                                            />
                                                        </td>
                                                        <td className="p-4">
                                                            <input 
                                                                type="number" 
                                                                value={row.rate_imm} 
                                                                onChange={e => updateGrid(idx, 'rate_imm', e.target.value)}
                                                                className="w-full p-3 text-center font-semibold text-indigo-700 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" 
                                                            />
                                                        </td>
                                                        <td className="p-4">
                                                            <input 
                                                                type="text" 
                                                                value={row.rate_per} 
                                                                onChange={e => updateGrid(idx, 'rate_per', e.target.value)}
                                                                className="w-full p-3 text-center font-semibold uppercase outline-none border border-slate-200 rounded-2xl" 
                                                                placeholder="0" 
                                                            />
                                                        </td>
                                                        <td className="p-4">
                                                            <input 
                                                                type="number" 
                                                                value={row.qty} 
                                                                onChange={e => updateGrid(idx, 'qty', e.target.value)}
                                                                className="w-full p-3 text-center font-semibold text-emerald-700 bg-emerald-50 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500" 
                                                            />
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <button 
                                                                onClick={() => setGridRows(gridRows.filter((_, i) => i !== idx))}
                                                                className="text-red-400 hover:text-red-600 transition-colors"
                                                            >
                                                                <MinusCircle size={24} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <button 
                                            onClick={() => setGridRows([...gridRows, { ...emptyRow }])}
                                            className="w-full p-5 bg-slate-50 text-blue-600 text-xs font-black uppercase tracking-[0.3em] hover:bg-blue-50 flex items-center justify-center gap-2 transition-all"
                                        >
                                            <Plus size={18} /> Append SKU Line
                                        </button>
                                    </div>

                                    {/* RIGHT: Summary Cockpit (preserved totalQty logic) */}
                                    <div className="w-full lg:w-96 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl p-8 text-white flex flex-col justify-between shadow-2xl">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-white/20 p-4 rounded-2xl">
                                                <Activity size={32} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-blue-200 uppercase tracking-widest">Cumulative Loading Weight</p>
                                                <h3 className="text-5xl font-black font-mono tracking-tighter mt-1">
                                                    {totalQty.toLocaleString()} <span className="text-2xl opacity-80">KG</span>
                                                </h3>
                                            </div>
                                        </div>
                                        <div className="text-right mt-auto">
                                            <p className="text-xs font-black text-blue-200 uppercase tracking-widest">Active SKU Lines</p>
                                            <h3 className="text-5xl font-black font-mono tracking-tighter">
                                                {gridRows.filter(r => r.product_id).length}
                                            </h3>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Modal Footer (styled exactly like AccountMaster) */}
                        <div className="p-6 bg-white border-t flex justify-between items-center">
                            <div className="flex items-center gap-3 text-slate-400 text-xs font-medium">
                                <Info size={18} />
                                Ensure all product rates are validated against current market CR/IMM
                            </div>
                            <div className="flex gap-4">
                                <button 
                                    onClick={() => setIsModalOpen(false)} 
                                    className="px-10 py-4 font-bold text-slate-400 hover:text-slate-600 text-xs tracking-widest uppercase transition-colors"
                                >
                                    Discard
                                </button>
                                <button 
                                    onClick={handleSave} 
                                    disabled={submitLoading}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-4 rounded-2xl font-black shadow-xl flex items-center gap-3 active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-70"
                                >
                                    <Save size={18} /> 
                                    {submitLoading ? 'Processing...' : 'Commit Order to DB'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                input[type='number']::-webkit-inner-spin-button,
                input[type='number']::-webkit-outer-spin-button { 
                    -webkit-appearance: none; 
                    margin: 0; 
                }
            `}</style>
        </div>
    );
};

// Reusable InputField (identical to AccountMaster)
const InputField = ({ label, className = "", ...props }) => (
    <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 block">{label}</label>
        <input 
            {...props} 
            className={`w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 transition-all ${className}`} 
        />
    </div>
);

export default SalesWithOrder;