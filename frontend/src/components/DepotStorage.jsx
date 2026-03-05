import React, { useState, useEffect, useMemo } from 'react';
import { mastersAPI, transactionsAPI } from '../service/api';
import { 
    Warehouse, Search, Package, Layers, 
    AlertTriangle, ArrowUpDown, Download, 
    RefreshCw, Filter, Boxes, Activity, 
    Database, CheckCircle2, Square, CheckSquare,
    ChevronLeft, ChevronRight, Info, AlertCircle,
    ArrowRightCircle, FileText
} from 'lucide-react';

const DepotStorage = () => {
    // --- Main States ---
    const [depots, setDepots] = useState([]);
    const [selectedDepot, setSelectedDepot] = useState('');
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Selection & Search
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [searchField, setSearchField] = useState('product_name');
    const [searchCondition, setSearchCondition] = useState('Like');
    const [searchValue, setSearchValue] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // --- Initialization ---
    useEffect(() => {
        fetchDepots();
    }, []);

    useEffect(() => {
        if (selectedDepot) fetchInventory();
        else setInventory([]);
    }, [selectedDepot]);

    // --- Event Listener for Stock Updates (Preserved) ---
    useEffect(() => {
        const handleDepotUpdate = () => {
            if (selectedDepot) fetchInventory();
        };
        window.addEventListener("depotStockUpdated", handleDepotUpdate);
        return () => window.removeEventListener("depotStockUpdated", handleDepotUpdate);
    }, [selectedDepot]);

    const fetchDepots = async () => {
        try {
            const res = await mastersAPI.accounts.getAll();
            const all = res.data?.data || res.data || [];
            const filtered = all.filter(a => {
                const grp = String(a.account_group || "").toUpperCase();
                const name = String(a.account_name || "").toUpperCase();
                return grp.includes('DEPOT') || name.includes('DEPOT');
            });
            setDepots(filtered);
            if (filtered.length > 0) setSelectedDepot(filtered[0].id);
        } catch (err) { console.error("Depot fetch error", err); }
    };

    const fetchInventory = async () => {
        if (!selectedDepot) return;
        setLoading(true);
        try {
            const res = await transactionsAPI.depotStock.getInventory(selectedDepot);
            setInventory(res.data?.data || []);
        } catch (err) { alert("Could not load inventory database"); }
        finally { setLoading(false); }
    };

    // --- Selection Logic ---
    const handleRowClick = (id) => {
        if (!isSelectionMode) return;
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    // --- Dynamic Filtering Logic ---
    const filteredInventory = useMemo(() => {
        let result = Array.isArray(inventory) ? [...inventory] : [];
        if (searchValue.trim()) {
            result = result.filter(item => {
                const itemValue = String(item[searchField] || "").toLowerCase();
                const term = searchValue.toLowerCase().trim();
                return searchCondition === 'Equal' ? itemValue === term : itemValue.includes(term);
            });
        }
        return result;
    }, [inventory, searchValue, searchField, searchCondition]);

    const stats = useMemo(() => {
        const totalItems = filteredInventory.length;
        const totalWeight = filteredInventory.reduce((sum, item) => sum + parseFloat(item.depot_stock || 0), 0);
        const lowStock = filteredInventory.filter(item => parseFloat(item.depot_stock) < 100).length;
        return { totalItems, totalWeight, lowStock };
    }, [filteredInventory]);

    const currentItems = filteredInventory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredInventory.length / itemsPerPage) || 1;

    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
            
            {/* 1. HEADER SECTION */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Warehouse className="text-blue-600" /> Depot Storage Vault
                    </h1>
                    <p className="text-sm text-slate-500">Live inventory positioning and warehouse stock analysis</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds([]); }}
                        className={`px-5 py-2 border rounded-lg font-semibold transition-all ${isSelectionMode ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-blue-600 hover:bg-slate-50'}`}>
                        {isSelectionMode ? 'Cancel' : 'Select'}
                    </button>
                    <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 pl-3 rounded-lg shadow-sm">
                        <span className="text-[10px] font-black uppercase text-slate-400">Warehouse:</span>
                        <select 
                            value={selectedDepot}
                            onChange={(e) => setSelectedDepot(e.target.value)}
                            className="bg-transparent border-none text-sm font-bold text-blue-600 focus:ring-0 cursor-pointer pr-8"
                        >
                            {depots.map(d => (
                                <option key={d.id} value={d.id}>{d.account_name}</option>
                            ))}
                        </select>
                    </div>
                    <button onClick={fetchInventory} className="p-2 border border-slate-200 rounded-lg bg-white text-slate-400 hover:text-blue-600 transition-colors">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* 2. STATS DASHBOARD */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-slate-900 p-6 rounded-2xl shadow-xl flex items-center gap-5 border border-white/5 relative overflow-hidden group">
                    <Boxes className="absolute -right-2 -bottom-2 text-white/5 group-hover:scale-110 transition-transform" size={80} />
                    <div className="p-4 bg-blue-600/20 rounded-xl text-blue-400 relative z-10"><Boxes size={28}/></div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Unique SKUs</p>
                        <p className="text-2xl font-black text-white">{stats.totalItems}</p>
                    </div>
                </div>
                <div className="bg-slate-900 p-6 rounded-2xl shadow-xl flex items-center gap-5 border border-white/5 relative overflow-hidden group">
                    <Layers className="absolute -right-2 -bottom-2 text-white/5 group-hover:scale-110 transition-transform" size={80} />
                    <div className="p-4 bg-emerald-600/20 rounded-xl text-emerald-400 relative z-10"><Layers size={28}/></div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gross Weight (KG)</p>
                        <p className="text-2xl font-black text-white">{stats.totalWeight.toLocaleString()} <span className="text-xs font-bold text-slate-600">KG</span></p>
                    </div>
                </div>
                <div className="bg-slate-900 p-6 rounded-2xl shadow-xl flex items-center gap-5 border border-white/5 relative overflow-hidden group">
                    <AlertTriangle className="absolute -right-2 -bottom-2 text-white/5 group-hover:scale-110 transition-transform" size={80} />
                    <div className="p-4 bg-rose-600/20 rounded-xl text-rose-400 relative z-10"><AlertTriangle size={28}/></div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Critical Low Stock</p>
                        <p className="text-2xl font-black text-white">{stats.lowStock}</p>
                    </div>
                </div>
            </div>

            {/* 3. FILTER BAR */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block ml-1">Search Field</label>
                        <select value={searchField} onChange={(e) => setSearchField(e.target.value)} className="w-full border border-slate-200 p-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="product_name">Product Name</option>
                            <option value="product_code">SKU Code</option>
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
                            <input type="text" placeholder="Search inventory..." value={searchValue} onChange={(e) => setSearchValue(e.target.value)} className="w-full border border-slate-200 pl-10 pr-4 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setSearchValue('')} className="flex-1 border border-slate-200 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all">Clear</button>
                        <div className="flex-1 bg-blue-50 text-blue-600 border border-blue-100 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 uppercase">
                            <Filter size={14}/> {filteredInventory.length} Matches
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. DATA TABLE */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-blue-600 text-white font-mono">
                                {isSelectionMode && <th className="p-4 w-12 text-center"><Square size={18} className="mx-auto" /></th>}
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider">Product SKU</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider">HSN/Tariff</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider text-right">In-Stock Qty</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider text-center">Status</th>
                                <th className="p-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-24 text-center">
                                        <RefreshCw size={48} className="animate-spin text-blue-500 mx-auto mb-4" />
                                        <p className="text-slate-500 font-medium">Syncing with Depot Database...</p>
                                    </td>
                                </tr>
                            ) : currentItems.length > 0 ? (
                                currentItems.map((item) => {
                                    const stockVal = parseFloat(item.depot_stock || 0);
                                    return (
                                        <tr 
                                            key={item.id} 
                                            onClick={() => handleRowClick(item.id)} 
                                            className={`transition-all ${isSelectionMode ? 'cursor-pointer hover:bg-blue-50/50' : ''} ${selectedIds.includes(item.id) ? 'bg-blue-50' : ''}`}
                                        >
                                            {isSelectionMode && (
                                                <td className="p-4 text-center">
                                                    {selectedIds.includes(item.id) ? <CheckSquare size={18} className="text-blue-600 mx-auto"/> : <Square size={18} className="text-slate-200 mx-auto"/>}
                                                </td>
                                            )}
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                                                        <Package size={16}/>
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-700 uppercase font-sans">{item.product_name}</div>
                                                        <div className="text-[10px] text-blue-600 font-black">{item.product_code}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-black rounded border">
                                                    {item.TariffSubHead?.tariff_no || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="text-lg font-black text-slate-900 font-mono">{stockVal.toLocaleString()}</div>
                                                <div className="text-[9px] font-black text-slate-400 uppercase">Kilograms</div>
                                            </td>
                                            <td className="p-4 text-center">
                                                {stockVal <= 0 ? (
                                                    <span className="bg-rose-100 text-rose-700 text-[9px] px-3 py-1 rounded-full font-black uppercase border border-rose-200">Out of Stock</span>
                                                ) : stockVal < 100 ? (
                                                    <span className="bg-amber-100 text-amber-700 text-[9px] px-3 py-1 rounded-full font-black uppercase border border-amber-200">Low Stock</span>
                                                ) : (
                                                    <span className="bg-emerald-100 text-emerald-700 text-[9px] px-3 py-1 rounded-full font-black uppercase border border-emerald-200">In Stock</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <ArrowRightCircle size={18} className="text-slate-200" />
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={6} className="py-28 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-24 h-24 bg-slate-100 rounded-3xl flex items-center justify-center mb-8 shadow-inner">
                                                <Package size={56} className="text-slate-300" />
                                            </div>
                                            <h3 className="text-2xl font-semibold text-slate-800 mb-3 tracking-tight">
                                                {searchValue.trim() ? "No matching stock found" : "Warehouse is empty"}
                                            </h3>
                                            <p className="text-slate-500 max-w-md text-[15px]">The current depot inventory will appear here after inward sync.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination */}
                <div className="p-4 bg-slate-50 border-t flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Showing {currentItems.length} of {filteredInventory.length} Entries</span>
                    <div className="flex gap-1">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="p-2 border rounded-lg bg-white disabled:opacity-30"><ChevronLeft size={16}/></button>
                        <div className="px-4 flex items-center font-black text-xs">PAGE {currentPage} OF {totalPages}</div>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="p-2 border rounded-lg bg-white disabled:opacity-30"><ChevronRight size={16}/></button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                ::-webkit-scrollbar { width: 5px; height: 5px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
            `}</style>
        </div>
    );
};

export default DepotStorage;