import React, { useState, useEffect, useMemo } from 'react';
import { mastersAPI, transactionsAPI } from '../service/api';
import { 
    Download, Save, Search, Hash, 
    Calendar, Warehouse, FileText, 
    Plus, X, RefreshCw, Edit,
    PackageCheck, ArrowRightCircle, Box, Activity, Check, 
    AlertCircle, Filter, Database, ChevronLeft, ChevronRight,
    Square, CheckSquare, Clock
} from 'lucide-react';

const DepotStockReceived = () => {
    // --- Initial States (Preserved) ---
    const emptyState = { 
        id: null,
        date: new Date().toISOString().split('T')[0], 
        depot_id: '', 
        invoice_no: '', 
    };

    // --- Main States ---
    const [list, setList] = useState([]);
    const [depots, setDepots] = useState([]);
    const [formData, setFormData] = useState(emptyState);
    const [previewItems, setPreviewItems] = useState([]); 
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [isFetchingInvoice, setIsFetchingInvoice] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Search & Selection
    const [searchField, setSearchField] = useState('invoice_no');
    const [searchCondition, setSearchCondition] = useState('Like');
    const [searchValue, setSearchValue] = useState('');
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // --- Initialization ---
    useEffect(() => {
        fetchMasters();
        fetchRecords();
    }, []);

    const fetchMasters = async () => {
        try {
            const res = await mastersAPI.accounts.getAll();
            const all = res.data.data || res.data || [];
            const filtered = all.filter(a => {
                const group = (a.account_group || a.group_name || "").toUpperCase().trim();
                return group === 'DEBTORS - DEPOT - SALES';
            });
            setDepots(filtered);
        } catch (err) { console.error("Master fetch error", err); }
    };

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await transactionsAPI.depotReceived.getAll();
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setList(data);
        } catch (err) { console.error("Records fetch error", err); }
        finally { setLoading(false); }
    };

    // --- Logic Handlers (Preserved Integrity) ---
    const handleLookupInvoice = async () => {

    if (!formData.invoice_no) 
        return alert("Please enter an Invoice Number");

    setIsFetchingInvoice(true);

    try {

        const res = await transactionsAPI.invoices.getAll();
        const allInvoices = res.data.data || res.data || [];

        const target = allInvoices.find(inv =>
            String(inv.invoice_no).trim() === String(formData.invoice_no).trim()
        );

        if (!target) {
            alert(`Invoice "${formData.invoice_no}" not found.`);
            setPreviewItems([]);
            return;
        }

        if (target.is_depot_inwarded) {
            alert("❌ This invoice already inwarded to depot.");
            return;
        }

        const items = target.InvoiceDetails || [];

        if (!items.length) {
            alert("Invoice found but no items.");
            return;
        }

        setPreviewItems(items);

    } catch (err) {
        console.error(err);
        alert("Error fetching invoice");
    } finally {
        setIsFetchingInvoice(false);
    }
};

    const handleSave = async () => {
        if (!formData.depot_id) return alert("Select a Depot");
        setSubmitLoading(true);
        try {
            const payload = { 
                invoice_no: formData.invoice_no,
                depot_id: formData.depot_id,
                date: formData.date 
            };
            await transactionsAPI.depotInward.create(payload);
            window.dispatchEvent(new Event("depotStockUpdated"));
            setIsModalOpen(false);
            fetchRecords(); 
            alert("Stock Inwarded Successfully!");
        } catch (err) { 
            alert("Error: " + (err.response?.data?.error || "Check Connection")); 
        } finally { 
            setSubmitLoading(false); 
        }
    };

    const handleRowClick = (item) => {
        if (isSelectionMode) {
            setSelectedIds(prev =>
                prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
            );
            return;
        }
        // View logic if needed (Read Only usually for Inward)
    };

    // --- Dynamic Filtering Logic ---
    const filteredData = useMemo(() => {
        let result = Array.isArray(list) ? [...list] : [];
        if (searchValue.trim()) {
            result = result.filter(item => {
                let itemValue = "";
                if (searchField === 'depot_name') itemValue = item.Depot?.account_name || "";
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
                        <Download className="text-blue-600" /> Depot Inward Sync
                    </h1>
                    <p className="text-sm text-slate-500">Mill-to-depot stock reconciliation and sales registry sync</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds([]); }}
                        className={`px-5 py-2 border rounded-lg font-semibold transition-all ${isSelectionMode ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-blue-600 hover:bg-slate-50'}`}>
                        {isSelectionMode ? 'Cancel' : 'Select'}
                    </button>
                    <button onClick={() => { setFormData(emptyState); setPreviewItems([]); setIsModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold shadow-sm transition-all active:scale-95">
                        <Plus size={18} /> New Inward Entry
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
                            <option value="invoice_no">Invoice No</option>
                            <option value="depot_name">Depot Name</option>
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
                            <input type="text" placeholder="Search entries..." value={searchValue} onChange={(e) => setSearchValue(e.target.value)} className="w-full border border-slate-200 pl-10 pr-4 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
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
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider">Receiving Depot</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider">Mill Invoice Ref</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-24 text-center">
                                        <RefreshCw size={48} className="animate-spin text-blue-500 mx-auto mb-4" />
                                        <p className="text-slate-500 font-medium">Loading sync history...</p>
                                    </td>
                                </tr>
                            ) : currentItems.length > 0 ? (
                                currentItems.map((item) => (
                                    <tr 
                                        key={item.id} 
                                        onClick={() => handleRowClick(item)} 
                                        className={`transition-all cursor-pointer hover:bg-blue-50/50 ${selectedIds.includes(item.id) ? 'bg-blue-50' : ''}`}
                                    >
                                        {isSelectionMode && (
                                            <td className="p-4 text-center" onClick={(e) => {e.stopPropagation(); handleRowClick(item);}}>
                                                {selectedIds.includes(item.id) ? <CheckSquare size={18} className="text-blue-600 mx-auto"/> : <Square size={18} className="text-slate-200 mx-auto"/>}
                                            </td>
                                        )}
                                        <td className="p-4 text-sm text-slate-500 font-sans">{item.date}</td>
                                        <td className="p-4 text-sm font-bold text-slate-700 uppercase font-sans">{item.Depot?.account_name}</td>
                                        <td className="p-4 text-sm font-black text-blue-600">#{item.invoice_no}</td>
                                        <td className="p-4 text-center">
                                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-black uppercase border border-emerald-200 flex items-center justify-center gap-1 w-fit mx-auto">
                                                <Check size={12}/> Synced
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="py-28 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-24 h-24 bg-slate-100 rounded-3xl flex items-center justify-center mb-8 shadow-inner">
                                                {searchValue.trim() ? <Search size={56} className="text-amber-400" /> : <Warehouse size={56} className="text-slate-300" />}
                                            </div>
                                            <h3 className="text-2xl font-semibold text-slate-800 mb-3 tracking-tight">
                                                {searchValue.trim() ? "No matching sync records" : "Depot inward empty"}
                                            </h3>
                                            <p className="text-slate-500 max-w-md text-[15px]">Received stock dispatches from the mill will appear in this registry.</p>
                                        </div>
                                    </td>
                                </tr>
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
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                        
                        {/* Modal Header */}
                        <div className="bg-blue-600 p-4 flex justify-between items-center text-white shadow-lg shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-white/20 rounded-lg"><Download size={20} /></div>
                                <div>
                                    <h2 className="font-bold uppercase tracking-tight">Stock Inbound Sync Engine</h2>
                                    <p className="text-[10px] font-bold text-blue-100 uppercase">Registry Code: {formData.invoice_no || 'NEW_SYNC'}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="hover:bg-blue-500 p-1 rounded-full transition-all"><X size={24}/></button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-6 bg-slate-50/50">
                            
                            {/* LEFT SIDE: Entry Form */}
                            <div className="flex-1 space-y-6">
                                <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
                                    <div className="flex items-center gap-2 mb-2 text-slate-400"><Database size={14}/><span className="text-[9px] font-black uppercase">Sync Parameters</span></div>
                                    
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Receiving Depot</label>
                                        <select 
                                            value={formData.depot_id} 
                                            onChange={e => setFormData({...formData, depot_id: e.target.value})}
                                            className="w-full bg-white border border-slate-200 p-3 rounded-xl font-bold text-sm outline-none focus:ring-1 focus:ring-blue-500 shadow-inner"
                                        >
                                            <option value="">-- Choose Target Depot ({depots.length}) --</option>
                                            {depots.map(d => <option key={d.id} value={d.id}>{d.account_name}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mill Invoice Number</label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                                                <input 
                                                    type="text"
                                                    value={formData.invoice_no}
                                                    onChange={e => setFormData({...formData, invoice_no: e.target.value})}
                                                    className="w-full bg-white border border-slate-200 pl-10 p-3 rounded-xl font-mono text-sm font-black text-blue-600 outline-none focus:ring-1 focus:ring-blue-500 shadow-inner"
                                                    placeholder="ENTER DOC REF..."
                                                />
                                            </div>
                                            <button 
                                                onClick={handleLookupInvoice}
                                                className="bg-blue-600 text-white px-6 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg active:scale-95"
                                                disabled={isFetchingInvoice}
                                            >
                                                {isFetchingInvoice ? <RefreshCw className="animate-spin" size={16}/> : <Search size={16}/>}
                                                Fetch
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Inward Date</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                                            <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-white border border-slate-200 pl-10 p-3 rounded-xl font-bold text-sm outline-none focus:ring-1 focus:ring-blue-500 shadow-inner" />
                                        </div>
                                    </div>

                                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                                        <AlertCircle className="text-amber-500 shrink-0" size={20} />
                                        <p className="text-[10px] font-bold text-amber-800 leading-tight uppercase">Ensure the Invoice Number matches exactly as recorded in the Sales Registry. This action cannot be undone.</p>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT SIDE: Content Sidebar (Cockpit Style) */}
                            <div className="w-full lg:w-[400px] bg-slate-900 rounded-2xl p-6 text-white flex flex-col justify-between shadow-2xl">
                                <div className="space-y-4 flex-1 flex flex-col h-full">
                                    <div className="text-center mb-4">
                                        <Activity size={32} className="text-blue-400 mx-auto mb-1" />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice Content Preview</p>
                                    </div>

                                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                                        {previewItems.length > 0 ? previewItems.map((item, idx) => (
                                            <div key={idx} className="bg-white/5 p-3 rounded-xl border border-white/5 flex justify-between items-center transition-all hover:bg-white/10">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center text-blue-400">
                                                        <Box size={16}/>
                                                    </div>
                                                    <div>
                                                        <p className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">SKU Detail</p>
                                                        <p className="text-xs font-bold uppercase truncate max-w-[150px]">{item.Product?.product_name || `ID: ${item.product_id}`}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">Net Qty</p>
                                                    <p className="text-sm font-black text-emerald-400 font-mono">{item.qty || item.total_kgs} <small className="text-[8px] text-slate-400">KG</small></p>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="h-full flex flex-col items-center justify-center opacity-10 py-10 border-2 border-dashed border-white/20 rounded-2xl">
                                                <PackageCheck size={60} className="mb-2"/>
                                                <p className="text-xs font-bold uppercase tracking-[0.2em]">Pending Doc Fetch</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-8 p-6 bg-blue-600/10 rounded-3xl border border-blue-500/20 text-center relative overflow-hidden group">
                                    <PackageCheck className="absolute -right-2 -bottom-2 text-white/5 group-hover:scale-110 transition-transform" size={80} />
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 relative z-10">Total Items Found</p>
                                    <h3 className="text-3xl font-black text-white font-mono relative z-10">{previewItems.length}</h3>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 bg-slate-50 border-t flex justify-end items-center gap-4 shrink-0">
                            <button onClick={() => setIsModalOpen(false)} className="px-8 py-3 font-bold text-slate-400 hover:text-slate-600 text-xs tracking-widest uppercase transition-colors">Discard</button>
                            <button 
                                onClick={handleSave} 
                                disabled={previewItems.length === 0 || submitLoading} 
                                className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3 rounded-xl font-black shadow-xl flex items-center gap-2 active:scale-95 transition-all text-xs tracking-widest uppercase disabled:opacity-30 disabled:pointer-events-none"
                            >
                                <Save size={18}/> {submitLoading ? 'SYNCING...' : 'COMMIT INWARD'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                input[type='number']::-webkit-inner-spin-button, 
                input[type='number']::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                ::-webkit-scrollbar { width: 5px; height: 5px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
            `}</style>
        </div>
    );
};

export default DepotStockReceived;