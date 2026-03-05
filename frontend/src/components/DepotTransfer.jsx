import React, { useState, useEffect, useMemo } from 'react';
import { mastersAPI, transactionsAPI } from '../service/api';
import { 
    Truck, ArrowRightLeft, Warehouse, Send, AlertCircle, 
    Calendar, Plus, Trash2, X, Search, RefreshCw, 
    ChevronLeft, ChevronRight, Square, CheckSquare, 
    Edit, MapPin, Package, Clock, ShieldCheck,
    Percent, DollarSign, Info, Filter, Database, 
    Activity, ArrowRightCircle, Layers, ClipboardList, Box
} from 'lucide-react';

export const DepotTransfer = () => {
    // --- Initial States (Preserved) ---
    const emptyState = {
        id: null,
        from_depot_id: '',
        to_depot_id: '',
        vehicle_no: '',
        remarks: '',
        transfer_date: new Date().toISOString().split('T')[0],
        items: [] 
    };

    // --- Main States ---
    const [list, setList] = useState([]);
    const [depots, setDepots] = useState([]);
    const [sourceInventory, setSourceInventory] = useState([]); 
    const [formData, setFormData] = useState(emptyState);
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFetchingStock, setIsFetchingStock] = useState(false);
    const [activeTab, setActiveTab] = useState('route');

    // Search & Selection
    const [searchField, setSearchField] = useState('vehicle_no');
    const [searchCondition, setSearchCondition] = useState('Like');
    const [searchValue, setSearchValue] = useState('');
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // --- Aggregates ---
    const totalMovementKg = useMemo(() => {
        return formData.items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
    }, [formData.items]);

    // --- Initialization ---
    useEffect(() => {
        fetchDepots();
        fetchRecords();
    }, []);

    // Trigger: Fetch Source Stock when "From Depot" Changes
    useEffect(() => {
        if (formData.from_depot_id) fetchSourceStock(formData.from_depot_id);
        else setSourceInventory([]);
    }, [formData.from_depot_id]);

    const fetchDepots = async () => {
        try {
            const res = await mastersAPI.accounts.getAll();
            const all = res.data.data || res.data || [];
            setDepots(all.filter(acc => (acc.account_group?.includes('DEPOT') || (acc.account_name || '').toUpperCase().includes('DEPOT'))));
        } catch (err) { console.error("Error fetching depots:", err); }
    };

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await transactionsAPI.depotSales.getAll();
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setList(data.filter(inv => inv.sales_type === 'DEPOT TRANSFER'));
        } catch (err) { console.error("Fetch records error:", err); }
        finally { setLoading(false); }
    };

    const fetchSourceStock = async (depotId) => {
        setIsFetchingStock(true);
        try {
            const res = await transactionsAPI.depotStock.getInventory(depotId);
            setSourceInventory(res.data.data || []);
        } catch (err) { console.error("Source stock fetch error"); }
        finally { setIsFetchingStock(false); }
    };

    // --- Action Handlers ---
    const handleAddNew = () => {
        setFormData({ ...emptyState, items: [{ product_id: '', qty: '', available: 0, product_name: '' }] });
        setActiveTab('route');
        setIsModalOpen(true);
    };

    const updateProductRow = (index, field, value) => {
        const newItems = [...formData.items];
        if (field === 'product_id') {
            const selectedProd = sourceInventory.find(p => String(p.id) === String(value));
            newItems[index] = {
                ...newItems[index],
                product_id: value,
                product_name: selectedProd?.product_name || '',
                available: selectedProd?.depot_stock || 0
            };
        } else {
            newItems[index][field] = value;
        }
        setFormData({ ...formData, items: newItems });
    };

    const handleExecuteTransfer = async () => {
    if (!formData.from_depot_id || !formData.to_depot_id) return alert("Select Source and Destination Depots");
    if (formData.from_depot_id === formData.to_depot_id) return alert("Source and Destination cannot be the same");
    
    // Validation
    const hasError = formData.items.some(item => !item.product_id || parseFloat(item.qty || 0) <= 0);
    if (hasError) return alert("Ensure all rows have a product and valid quantity");

    setSubmitLoading(true);
    try {
        const payload = {
            sales_type: 'DEPOT TRANSFER',
            depot_id: formData.from_depot_id, // Giving Depot
            party_id: formData.to_depot_id,   // Receiving Depot (stored in party_id)
            vehicle_no: formData.vehicle_no,
            remarks: formData.remarks,
            date: formData.transfer_date,
            // Re-mapping items for the DB Details table
            Details: formData.items.map(item => ({
                product_id: item.product_id,
                total_kgs: parseFloat(item.qty), // Backend expects total_kgs
                rate: 0,                        // Transfers are usually 0 value
                order_type: 'TRANSFER'
            }))
        };

        await transactionsAPI.depotSales.create(payload);
        
        alert("Stock Transfer Authorized Successfully!");
        setIsModalOpen(false);
        fetchRecords();
        // Trigger a global refresh for inventory components
        window.dispatchEvent(new Event("depotStockUpdated"));
    } catch (err) { 
        alert("Transfer Failed: " + (err.response?.data?.error || err.message)); 
    } finally { setSubmitLoading(false); }
};

    const handleRowClick = (item) => {
        if (isSelectionMode) {
            setSelectedIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]);
            return;
        }
        // Logic for viewing historical transfer details
    };

    // --- Dynamic Filtering ---
    const filteredData = useMemo(() => {
        let result = Array.isArray(list) ? [...list] : [];
        if (searchValue.trim()) {
            result = result.filter(item => {
                let itemValue = "";
                if (searchField === 'from_depot') itemValue = item.Depot?.account_name || "";
                else if (searchField === 'to_depot') itemValue = item.Party?.account_name || "";
                else itemValue = String(item[searchField] || "");
                const term = searchValue.toLowerCase().trim();
                return searchCondition === 'Equal' ? itemValue.toLowerCase() === term : itemValue.toLowerCase().includes(term);
            });
        }
        return result.sort((a, b) => b.id - a.id);
    }, [list, searchValue, searchField, searchCondition]);

    const currentItems = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;

    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
            
            {/* 1. HEADER SECTION */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <ArrowRightLeft className="text-blue-600" /> Stock Movement Engine
                    </h1>
                    <p className="text-sm text-slate-500">Inter-depot stock transfer authorization and logistics registry</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds([]); }}
                        className={`px-5 py-2 border rounded-lg font-semibold transition-all ${isSelectionMode ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-blue-600 hover:bg-slate-50'}`}>
                        {isSelectionMode ? 'Cancel' : 'Select'}
                    </button>
                    <button onClick={handleAddNew} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold shadow-sm transition-all active:scale-95">
                        <Plus size={18} /> New Transfer
                    </button>
                    <button onClick={fetchRecords} className="p-2 border border-slate-200 rounded-lg bg-white text-slate-400 hover:text-blue-600 transition-colors">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* 2. FILTER BAR */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block ml-1">Search Field</label>
                        <select value={searchField} onChange={(e) => setSearchField(e.target.value)} className="w-full border border-slate-200 p-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="vehicle_no">Vehicle No</option>
                            <option value="from_depot">Source Depot</option>
                            <option value="to_depot">Target Depot</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block ml-1">Condition</label>
                        <select value={searchCondition} onChange={(e) => setSearchCondition(e.target.value)} className="w-full border border-slate-200 p-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="Like">Like</option>
                            <option value="Equal">Equal</option>
                        </select>
                    </div>
                    <div className="md:col-span-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block ml-1">Value</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input type="text" placeholder="Search movements..." value={searchValue} onChange={(e) => setSearchValue(e.target.value)} className="w-full border border-slate-200 pl-10 pr-4 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setSearchValue('')} className="flex-1 border border-slate-200 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all">Clear</button>
                        <div className="flex-1 bg-blue-50 text-blue-600 border border-blue-100 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                            <Filter size={14}/> {filteredData.length} Matches
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. DATA TABLE */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-blue-600 text-white font-mono">
                                {isSelectionMode && <th className="p-4 w-12 text-center"><Square size={18} className="mx-auto" /></th>}
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider">Date</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider">Source Depot</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider">Target Depot</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider text-center">Vehicle No</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider text-center">Status</th>
                                {!isSelectionMode && <th className="p-4 w-10"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                            {loading ? (
                                <tr><td colSpan={6} className="py-24 text-center"><RefreshCw size={48} className="animate-spin text-blue-500 mx-auto mb-4" /><p className="text-slate-500">Syncing movement registry...</p></td></tr>
                            ) : currentItems.length > 0 ? (
                                currentItems.map((item) => (
                                    <tr key={item.id} onClick={() => handleRowClick(item)} className={`transition-all cursor-pointer hover:bg-blue-50/50 ${selectedIds.includes(item.id) ? 'bg-blue-50' : ''}`}>
                                        {isSelectionMode && (
                                            <td className="p-4 text-center" onClick={(e) => {e.stopPropagation(); handleRowClick(item);}}>
                                                {selectedIds.includes(item.id) ? <CheckSquare size={18} className="text-blue-600 mx-auto"/> : <Square size={18} className="text-slate-200 mx-auto"/>}
                                            </td>
                                        )}
                                        <td className="p-4 text-sm text-slate-500 font-sans">{item.date}</td>
                                        <td className="p-4 text-sm font-bold text-slate-700 uppercase font-sans">{item.Depot?.account_name}</td>
                                        <td className="p-4 text-sm font-black text-blue-600 uppercase font-sans italic">→ {item.Party?.account_name}</td>
                                        <td className="p-4 text-sm font-bold text-center text-slate-400">{item.vehicle_no || 'N/A'}</td>
                                        <td className="p-4 text-center"><span className="bg-emerald-100 text-emerald-700 text-[10px] px-3 py-1 rounded-full font-black uppercase border border-emerald-200">Authorized</span></td>
                                        {!isSelectionMode && <td className="p-4 text-right"><ArrowRightCircle size={18} className="text-slate-300" /></td>}
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={6} className="py-28 text-center opacity-20"><Warehouse size={64} className="mx-auto mb-4"/><p className="font-black uppercase tracking-widest">No Movement Records Found</p></td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination */}
                <div className="p-4 bg-slate-50 border-t flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Page {currentPage} of {totalPages}</span>
                    <div className="flex gap-1">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="p-2 border rounded-lg bg-white disabled:opacity-30"><ChevronLeft size={16}/></button>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="p-2 border rounded-lg bg-white disabled:opacity-30"><ChevronRight size={16}/></button>
                    </div>
                </div>
            </div>

            {/* 4. MODAL COCKPIT */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in duration-200">
                        
                        {/* Modal Header */}
                        <div className="bg-blue-600 p-4 flex justify-between items-center text-white shadow-lg shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-white/20 rounded-lg"><ArrowRightLeft size={20} /></div>
                                <div>
                                    <h2 className="font-bold uppercase tracking-tight">Stock Movement Authorization</h2>
                                    <p className="text-[10px] font-bold text-blue-100 uppercase">Movement Protocol: {formData.vehicle_no || 'NEW_ENTRY'}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="hover:bg-blue-500 p-1 rounded-full transition-all"><X size={24}/></button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-6 bg-slate-50/50">
                            
                            {/* LEFT SIDE: Entry Grid */}
                            <div className="flex-1 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
                                        <div className="flex items-center gap-2 mb-2 text-slate-400"><MapPin size={14}/><span className="text-[9px] font-black uppercase">Routing</span></div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">From (Source)</label>
                                            <select 
                                                value={formData.from_depot_id}
                                                onChange={e => setFormData({...formData, from_depot_id: e.target.value, items: [{ product_id: '', qty: '', available: 0, product_name: '' }]})}
                                                className="w-full bg-white border border-slate-200 p-2 rounded-lg text-sm font-bold shadow-inner outline-none focus:ring-1 focus:ring-blue-500"
                                            >
                                                <option value="">-- Choose Origin Depot --</option>
                                                {depots.map(d => <option key={d.id} value={d.id}>{d.account_name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">To (Destination)</label>
                                            <select 
                                                value={formData.to_depot_id}
                                                onChange={e => setFormData({...formData, to_depot_id: e.target.value})}
                                                className="w-full bg-white border border-slate-200 p-2 rounded-lg text-sm font-bold shadow-inner outline-none focus:ring-1 focus:ring-blue-500"
                                            >
                                                <option value="">-- Choose Target Depot --</option>
                                                {depots.map(d => <option key={d.id} value={d.id}>{d.account_name}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
                                        <div className="flex items-center gap-2 mb-2 text-slate-400"><Truck size={14}/><span className="text-[9px] font-black uppercase">Logistics</span></div>
                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Vehicle No</label>
                                                <input value={formData.vehicle_no} onChange={e => setFormData({...formData, vehicle_no: e.target.value.toUpperCase()})} placeholder="TN-00-XX-0000" className="w-full bg-white border border-slate-200 p-2 rounded-lg text-sm font-bold shadow-inner outline-none focus:ring-1 focus:ring-blue-500 uppercase" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Transfer Date</label>
                                                <input type="date" value={formData.transfer_date} onChange={e => setFormData({...formData, transfer_date: e.target.value})} className="w-full bg-white border border-slate-200 p-2 rounded-lg text-sm font-bold shadow-inner outline-none focus:ring-1 focus:ring-blue-500" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ITEM GRID */}
                                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                                    <div className="bg-slate-900 p-4 flex justify-between items-center">
                                        <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2"><Layers size={14}/> Movement Payload</h3>
                                        <button 
                                            onClick={() => setFormData({...formData, items: [...formData.items, { product_id: '', qty: '', available: 0, product_name: '' }]})}
                                            disabled={!formData.from_depot_id}
                                            className="bg-blue-600 text-white px-4 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-blue-700 disabled:opacity-30 transition-all"
                                        >
                                            + Add Line
                                        </button>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        {!formData.from_depot_id ? (
                                            <div className="py-12 text-center opacity-30">
                                                <Info size={32} className="mx-auto mb-2"/>
                                                <p className="text-xs font-bold uppercase">Select Origin to Load Available Stock</p>
                                            </div>
                                        ) : formData.items.map((row, idx) => (
                                            <div key={idx} className="grid grid-cols-12 gap-4 p-3 bg-slate-50 border rounded-xl items-end relative group">
                                                <div className="col-span-6">
                                                    <label className="text-[8px] font-black text-slate-400 uppercase">Product SKU</label>
                                                    <select 
                                                        value={row.product_id}
                                                        onChange={e => updateProductRow(idx, 'product_id', e.target.value)}
                                                        className="w-full bg-transparent font-bold text-xs outline-none focus:text-blue-600"
                                                    >
                                                        <option value="">-- Choose Item --</option>
                                                        {sourceInventory.map(p => (
                                                            <option key={p.id} value={p.id}>{p.product_name} ({p.depot_stock} KG Available)</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-span-5">
                                                    <label className="text-[8px] font-black text-slate-400 uppercase">Qty to Move (KG)</label>
                                                    <input 
                                                        type="number"
                                                        value={row.qty}
                                                        onChange={e => updateProductRow(idx, 'qty', e.target.value)}
                                                        className={`w-full bg-transparent font-black text-base outline-none ${parseFloat(row.qty) > row.available ? 'text-rose-600' : 'text-blue-600'}`}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                <div className="col-span-1 text-right">
                                                    <button onClick={() => setFormData({...formData, items: formData.items.filter((_, i) => i !== idx)})} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                                                        <Trash2 size={16}/>
                                                    </button>
                                                </div>
                                                {parseFloat(row.qty) > row.available && (
                                                    <div className="absolute -top-2 left-4 bg-rose-600 text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase flex items-center gap-1">
                                                        <AlertCircle size={8}/> Exceeds Available Stock ({row.available} KG)
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT SIDE: Movement Cockpit */}
                            <div className="w-full lg:w-96 bg-slate-900 rounded-2xl p-6 text-white flex flex-col justify-between shadow-2xl shrink-0">
                                <div className="space-y-6">
                                    <div className="text-center mb-6">
                                        <Activity size={32} className="text-blue-400 mx-auto mb-1" />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Movement Assessment</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 shadow-inner">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Movement Weight</p>
                                            <div className="flex items-baseline gap-2">
                                                <h3 className="text-3xl font-black text-emerald-400 font-mono tracking-tighter">{totalMovementKg.toFixed(2)}</h3>
                                                <span className="text-[10px] font-bold text-slate-600 uppercase">KG</span>
                                            </div>
                                        </div>

                                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 shadow-inner">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Payload Details</p>
                                            <div className="flex items-center gap-3">
                                                <Package size={20} className="text-blue-400" />
                                                <span className="text-xl font-black">{formData.items.length}</span>
                                                <span className="text-[10px] font-bold text-slate-600 uppercase">Active Lines</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-blue-600/10 rounded-xl border border-blue-500/20">
                                        <textarea 
                                            value={formData.remarks} 
                                            onChange={e => setFormData({...formData, remarks: e.target.value.toUpperCase()})}
                                            className="w-full bg-transparent text-[10px] font-bold uppercase text-blue-100 placeholder:text-blue-800 outline-none h-20 resize-none" 
                                            placeholder="ENTER TRANSFER REMARKS / NOTES..."
                                        />
                                    </div>
                                </div>

                                <div className="mt-8 p-6 bg-blue-600/10 rounded-3xl border border-blue-500/20 text-center relative overflow-hidden group">
                                    <Send className="absolute -right-2 -bottom-2 text-white/5 group-hover:scale-150 transition-transform" size={80} />
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 relative z-10">Movement Status</p>
                                    <h3 className="text-xl font-black text-white uppercase relative z-10">{submitLoading ? 'PROCESSING' : 'PENDING EXECUTION'}</h3>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 bg-slate-50 border-t flex justify-end items-center gap-4 shrink-0">
                            <button onClick={() => setIsModalOpen(false)} className="px-8 py-3 font-bold text-slate-400 hover:text-slate-600 text-xs tracking-widest uppercase transition-colors">Discard</button>
                            <button 
                                onClick={handleExecuteTransfer} 
                                disabled={submitLoading || formData.items.length === 0} 
                                className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3 rounded-xl font-black shadow-xl flex items-center gap-2 active:scale-95 transition-all text-xs tracking-widest uppercase disabled:opacity-30"
                            >
                                <Send size={18}/> {submitLoading ? 'EXECUTING...' : 'EXECUTE MOVEMENT'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                input[type='number']::-webkit-inner-spin-button, 
                input[type='number']::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                ::-webkit-scrollbar { width: 5px; height: 5px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
            `}</style>
        </div>
    );
};

export default DepotTransfer;