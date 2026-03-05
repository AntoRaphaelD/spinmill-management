import React, { useState, useEffect, useMemo } from 'react';
import { mastersAPI, transactionsAPI } from '../service/api';
import { 
    Save, Zap, Search, Plus, RefreshCw,
    ChevronLeft, ChevronRight, X, ArrowRightCircle,
    Database, Activity, Filter, Info, Loader2,
    MinusCircle
} from 'lucide-react';

const SalesWithoutOrder = () => {
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
        qty: 0,
        rate_per: 0,
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
    const [activeTab, setActiveTab] = useState("head");

    // Master Data (100% preserved)
    const [parties, setParties] = useState([]);
    const [brokers, setBrokers] = useState([]);
    const [products, setProducts] = useState([]);

    // Search & Pagination (pagination added)
    const [searchValue, setSearchValue] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // --- Initialization (100% preserved) ---
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
        } catch (err) { console.error("Error fetching masters", err); }
    };

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await transactionsAPI.directInvoices.getAll();
            setList(res.data.data || []);
        } catch (err) { console.error("Fetch error:", err); }
        finally { setLoading(false); }
    };

    // --- Totals (100% preserved) ---
    const totalQty = useMemo(() => 
        gridRows.reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0), 
    [gridRows]);

    // --- Action Handlers (100% preserved) ---
    const handleAddNew = () => {
        const nextId = list.length > 0 
            ? Math.max(...list.map(o => parseInt(o.order_no) || 0)) + 1 
            : 1;
        setFormData({ ...emptyHeader, order_no: String(nextId) });
        setGridRows([{ ...emptyRow }]);
        setActiveTab("head");
        setIsModalOpen(true);
    };

    const handleRowClick = (item) => {
        setFormData(item);
        setGridRows(
            item.DirectInvoiceDetails?.length > 0 
                ? item.DirectInvoiceDetails.map(d => ({...d})) 
                : [{ ...emptyRow }]
        );
        setActiveTab("head");
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
                rate_per: 0,
            };
        } else {
            updated[index][field] = value;
        }
        setGridRows(updated);
    };

    const handleSave = async () => {
        if (!formData.party_id) return alert("Required: Please select a Customer");
        const validDetails = gridRows.filter(r => r.product_id !== '');
        if (validDetails.length === 0) return alert("Required: Add at least one item");
        
        setSubmitLoading(true);
        const payload = { ...formData, Details: validDetails };
        try {
            if (formData.id) await transactionsAPI.directInvoices.update(formData.id, payload);
            else await transactionsAPI.directInvoices.create(payload);
            setIsModalOpen(false);
            fetchRecords();
        } catch (err) { alert("Save failed"); }
        finally { setSubmitLoading(false); }
    };

    // --- Dynamic Filtering Logic (100% preserved + pagination ready) ---
    const filteredData = useMemo(() => {
        let result = Array.isArray(list) ? [...list] : [];
        if (searchValue.trim()) {
            result = result.filter(item => 
                item.order_no.includes(searchValue) || 
                item.Party?.account_name?.toLowerCase().includes(searchValue.toLowerCase())
            );
        }
        return result.sort((a, b) => b.id - a.id);
    }, [list, searchValue]);

    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
    const currentItems = filteredData.slice(
        (currentPage - 1) * itemsPerPage, 
        currentPage * itemsPerPage
    );

    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
            
            {/* HEADER (modern blue UI) */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        <Zap className="text-blue-600" size={32} /> 
                        Direct Billing
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Instant Sales Registry (Non-Booked)</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleAddNew} 
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-semibold shadow-md transition-all active:scale-95 text-sm"
                    >
                        <Plus size={18} /> New Direct Bill
                    </button>
                    <button 
                        onClick={fetchRecords} 
                        className="p-3 border border-slate-200 rounded-2xl bg-white text-slate-400 hover:text-blue-600 transition-colors"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* FILTER BAR (modern blue UI) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Quick Search</label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                className="w-full border border-slate-200 pl-12 py-3 rounded-xl text-sm font-medium bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Order # or Customer name..."
                            />
                        </div>
                    </div>
                    <div className="bg-blue-50 text-blue-600 border border-blue-100 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2">
                        <Filter size={16}/> {filteredData.length} Records Found
                    </div>
                </div>
            </div>

            {/* REGISTRY TABLE (modern blue UI + pagination) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-blue-600 text-white font-mono">
                                <th className="p-5 text-sm font-semibold uppercase tracking-wider">Ref #</th>
                                <th className="p-5 text-sm font-semibold uppercase tracking-wider">Date</th>
                                <th className="p-5 text-sm font-semibold uppercase tracking-wider">Customer Party</th>
                                <th className="p-5 text-sm font-semibold uppercase tracking-wider text-center">Agent</th>
                                <th className="p-5 w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-24">
                                        <div className="flex flex-col items-center justify-center">
                                            <Loader2 size={48} className="animate-spin text-blue-500 mb-4" />
                                            <p className="text-slate-500 font-medium">Loading direct bills...</p>
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
                                        <td className="p-5 text-center">
                                            <span className="inline-block px-5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
                                                {item.Broker?.broker_name || 'DIRECT'}
                                            </span>
                                        </td>
                                        <td className="p-5">
                                            <ArrowRightCircle size={20} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="py-28 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <Zap size={56} className="text-slate-300 mb-6" />
                                            <h3 className="text-2xl font-semibold text-slate-800">No direct bills yet</h3>
                                            <p className="text-slate-500 mt-2">Click New Direct Bill to create your first entry</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination (added - modern blue UI) */}
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

            {/* FULL SCREEN MODAL (modern blue UI - exact match to SalesWithOrder) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[94vh]">
                        
                        {/* Modal Header */}
                        <div className="bg-blue-600 px-8 py-6 text-white flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 p-3 rounded-2xl">
                                    <Zap size={26} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold tracking-tight">Direct Billing Engine</h2>
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
                                01. CLIENT DETAILS
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

                        {/* Modal Body - Split Layout */}
                        <div className="flex-1 overflow-auto p-8 bg-slate-50 flex flex-col lg:flex-row gap-8">
                            
                            {activeTab === 'head' ? (
                                <>
                                    {/* LEFT: Form */}
                                    <div className="flex-1 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <InputField 
                                                label="Reference ID" 
                                                value={formData.order_no} 
                                                readOnly 
                                                className="bg-blue-50 border-blue-100 text-blue-600" 
                                            />
                                            <InputField 
                                                label="Billing Date" 
                                                type="date" 
                                                value={formData.date} 
                                                onChange={e => setFormData({...formData, date: e.target.value})} 
                                            />

                                            <div className="md:col-span-2">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Customer Party</label>
                                                <select 
                                                    value={formData.party_id} 
                                                    onChange={e => setFormData({...formData, party_id: e.target.value})}
                                                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="">-- Choose Party --</option>
                                                    {parties.map(p => (
                                                        <option key={p.id} value={p.id}>{p.account_name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <InputField 
                                                label="Dispatch Hub" 
                                                value={formData.place} 
                                                onChange={e => setFormData({...formData, place: e.target.value.toUpperCase()})} 
                                            />

                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Assigned Agent</label>
                                                <select 
                                                    value={formData.broker_id} 
                                                    onChange={e => setFormData({...formData, broker_id: e.target.value})}
                                                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="">DIRECT BILLING</option>
                                                    {brokers.map(b => (
                                                        <option key={b.id} value={b.id}>{b.broker_name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="md:col-span-2 pt-4 border-t flex items-center gap-3">
                                                <input 
                                                    type="checkbox" 
                                                    checked={formData.is_cancelled} 
                                                    onChange={e => setFormData({...formData, is_cancelled: e.target.checked})} 
                                                    className="w-5 h-5 accent-red-600 rounded" 
                                                />
                                                <span className="text-[10px] font-black text-slate-400 uppercase">Cancel This Bill</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* RIGHT: Metadata Sidebar */}
                                    <div className="w-full lg:w-96 bg-slate-900 rounded-3xl p-8 text-white flex flex-col gap-6 shadow-2xl">
                                        <div className="text-center pb-6 border-b border-slate-800">
                                            <Database size={48} className="text-blue-500 mx-auto mb-3" />
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Transaction Control</p>
                                        </div>
                                        <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-800">
                                            <label className="text-[9px] font-black text-slate-400 uppercase block mb-2 tracking-widest">Status</label>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full ${formData.is_cancelled ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                                <span className="text-sm font-black uppercase tracking-widest">
                                                    {formData.is_cancelled ? 'Cancelled' : 'Active'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* LEFT: Itemization Table */}
                                    <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-slate-900 text-white text-xs font-black uppercase tracking-widest">
                                                <tr>
                                                    <th className="p-6 text-left">SKU Product Selection</th>
                                                    <th className="p-6 text-center w-28">Packing</th>
                                                    <th className="p-6 text-center w-24">Bag Wt</th>
                                                    <th className="p-6 text-center w-28">Rate (CR)</th>
                                                    <th className="p-6 text-center w-28">Rate (IMM)</th>
                                                    <th className="p-6 text-center w-20">Per</th>
                                                    <th className="p-6 text-center w-32">Qty (KG)</th>
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
                                                                <option value="">-- Choose Item --</option>
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

                                    {/* RIGHT: Summary Cockpit */}
                                    <div className="w-full lg:w-96 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl p-8 text-white flex flex-col justify-between shadow-2xl">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-white/20 p-4 rounded-2xl">
                                                <Activity size={32} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-blue-200 uppercase tracking-widest">Billing Weight</p>
                                                <h3 className="text-5xl font-black font-mono tracking-tighter mt-1">
                                                    {totalQty.toLocaleString()} <span className="text-2xl opacity-80">KG</span>
                                                </h3>
                                            </div>
                                        </div>
                                        <div className="text-right mt-auto">
                                            <p className="text-xs font-black text-blue-200 uppercase tracking-widest">Active Lines</p>
                                            <h3 className="text-5xl font-black font-mono tracking-tighter">
                                                {gridRows.filter(r => r.product_id).length}
                                            </h3>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 bg-white border-t flex justify-between items-center">
                            <div className="flex items-center gap-3 text-slate-400 text-xs font-medium">
                                <Info size={18} />
                                All rates must be validated before posting
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
                                    {submitLoading ? 'Processing...' : 'Finalize & Post'}
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

// Reusable InputField (identical to SalesWithOrder blue UI)
const InputField = ({ label, className = "", ...props }) => (
    <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 block">{label}</label>
        <input 
            {...props} 
            className={`w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 transition-all ${className}`} 
        />
    </div>
);

export default SalesWithoutOrder;