import React, { useState, useEffect, useMemo } from 'react';
import { mastersAPI } from '../service/api';
import { 
    Plus, Search, Edit, Trash2, X, ChevronLeft, 
    ChevronRight, Package, Settings, Box, 
    CheckSquare, Square, RefreshCw, Info, Save, Zap,
    Activity, Layers, Database, Warehouse, BarChart3,
    Filter, LayoutGrid, Scale, FileText, Beaker, Truck,
    AlertCircle, Tag
} from 'lucide-react';

const ProductMaster = () => {
    // --- Initial States (Zero deletions - all original fields preserved) ---
    const emptyState = { 
        id: null,
        product_code: '', 
        product_name: '', 
        short_description: '', 
        commodity: '', 
        commodity_code: '', 
        packing_type: '', 
        fibre: '', 
        wt_per_cone: 0, 
        charity_rs: 0, 
        no_of_cones_per_pack: 0, 
        other_receipt: 0, 
        pack_nett_wt: 0, 
        tariff_sub_head: '', 
        printing_tariff_sub_head_no: '', 
        product_type: '', 
        spinning_count_name: '', 
        converted_factor_40s: 0, 
        actual_count: '', 
        roundoff: false,
        mill_stock: 0
    };

    // --- Main States ---
    const [list, setList] = useState([]);
    const [tariffs, setTariffs] = useState([]); 
    const [packingTypes, setPackingTypes] = useState([]); 
    const [formData, setFormData] = useState(emptyState);
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('identity');

    // Search & Selection
    const [searchField, setSearchField] = useState('product_name');
    const [searchCondition, setSearchCondition] = useState('Like');
    const [searchValue, setSearchValue] = useState('');
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    // Auto calculate Pack Nett Weight
useEffect(() => {
    const wt = parseFloat(formData.wt_per_cone) || 0;
    const cones = parseFloat(formData.no_of_cones_per_pack) || 0;

    const total = wt * cones;

    setFormData(prev => ({
        ...prev,
        pack_nett_wt: total
    }));
}, [formData.wt_per_cone, formData.no_of_cones_per_pack]);
    // --- Initialization ---
    useEffect(() => { 
        fetchRecords(); 
        fetchLookups();
    }, []);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await mastersAPI.products.getAll();
            const data = res?.data?.data || res?.data || [];
            setList(Array.isArray(data) ? data : []);
        } catch (err) { setList([]); } 
        finally { setLoading(false); }
    };

    const fetchLookups = async () => {
        try {
            const [tariffRes, packingRes] = await Promise.all([
                mastersAPI.tariffs.getAll(),
                mastersAPI.packingTypes.getAll()
            ]);
            setTariffs(tariffRes?.data?.data || tariffRes?.data || []);
            setPackingTypes(packingRes?.data?.data || packingRes?.data || []);
        } catch (err) { console.error(err); }
    };

    // --- Logic Handlers ---
    const handleTariffChange = (tariffCode) => {
        const selected = tariffs.find(t => t.tariff_code === tariffCode);
        if (selected) {
            setFormData(prev => ({
                ...prev,
                tariff_sub_head: selected.tariff_code,
                printing_tariff_sub_head_no: selected.tariff_no, 
                product_type: selected.product_type,
                fibre: selected.fibre,
                commodity: selected.commodity || prev.commodity
            }));
        } else {
            setFormData(prev => ({ ...prev, tariff_sub_head: tariffName }));
        }
    };

    const handleAddNew = () => {
        const maxCode = list.reduce((max, item) => {
            const num = parseInt(item.product_code, 10);
            return !isNaN(num) ? Math.max(max, num) : max;
        }, 0);
        setFormData({ ...emptyState, product_code: (maxCode + 1).toString() });
        setActiveTab('identity');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.product_name) return alert("Product Name is required");
        setSubmitLoading(true);
        try {
            if (formData.id) await mastersAPI.products.update(formData.id, formData);
            else await mastersAPI.products.create(formData);
            setIsModalOpen(false);
            fetchRecords();
        } catch (err) { alert("Error saving."); }
        finally { setSubmitLoading(false); }
    };

    const handleRowClick = (item) => {
        if (isSelectionMode) {
            setSelectedIds(prev =>
                prev.includes(item.id)
                    ? prev.filter(id => id !== item.id)
                    : [...prev, item.id]
            );
            return;
        }
        setFormData({ ...item });
        setActiveTab('identity');
        setIsModalOpen(true);
    };

    // --- Dynamic Filtering ---
    const filteredData = useMemo(() => {
        let result = Array.isArray(list) ? [...list] : [];
        if (searchValue.trim()) {
            result = result.filter(item => {
                const itemValue = String(item[searchField] || "").toLowerCase();
                const term = searchValue.toLowerCase().trim();
                return searchCondition === 'Equal' ? itemValue === term : itemValue.includes(term);
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
                        <Package className="text-blue-600" /> Product Master
                    </h1>
                    <p className="text-sm text-slate-500">Technical SKU registry and yarn specifications</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds([]); }}
                        className={`px-5 py-2 border rounded-lg font-semibold transition-all ${isSelectionMode ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-blue-600 hover:bg-slate-50'}`}>
                        {isSelectionMode ? 'Cancel' : 'Select'}
                    </button>
                    <button onClick={handleAddNew} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold shadow-sm transition-all active:scale-95">
                        <Plus size={18} /> New Product
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
                            <option value="product_name">Product Description</option>
                            <option value="product_code">Product Code</option>
                            <option value="commodity">Commodity</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block ml-1">Condition</label>
                        <select value={searchCondition} onChange={(e) => setSearchCondition(e.target.value)} className="w-full border border-slate-200 p-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="Like">Contains</option>
                            <option value="Equal">Exact</option>
                        </select>
                    </div>
                    <div className="md:col-span-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block ml-1">Value</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input type="text" placeholder="Search..." value={searchValue} onChange={(e) => setSearchValue(e.target.value)} className="w-full border border-slate-200 pl-10 pr-4 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
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

            {/* 3. DATA TABLE - Displaying specific columns requested */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-blue-600 text-white">
                                {isSelectionMode && <th className="p-4 w-12 text-center"><Square size={18} className="mx-auto" /></th>}
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider">Code</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider">Product Description</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider">Short Description</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider">Spinning Count</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider">Commodity</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider">Packing Type</th>
                                {!isSelectionMode && <th className="p-4 w-10"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-24">
                                        <div className="flex flex-col items-center justify-center">
                                            <RefreshCw size={48} className="animate-spin text-blue-500 mb-4" />
                                            <p className="text-slate-500 font-medium">Accessing SKU Registry...</p>
                                        </div>
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
                                        <td className="p-4 text-sm font-black text-blue-600">{item.product_code}</td>
                                        <td className="p-4 text-sm font-bold text-slate-700 uppercase font-sans">{item.product_name}</td>
                                        <td className="p-4 text-xs text-slate-400 font-sans">{item.short_description || '---'}</td>
                                        <td className="p-4 text-xs font-bold text-amber-600 uppercase font-sans">{item.spinning_count_name}</td>
                                        <td className="p-4 text-xs font-bold text-slate-500 uppercase font-sans">{item.commodity}</td>
                                        <td className="p-4">
                                            <span className="bg-slate-100 px-3 py-1 rounded-lg text-[10px] font-black uppercase text-slate-500 border">
                                                {item.packing_type || 'N/A'}
                                            </span>
                                        </td>
                                        {!isSelectionMode && <td className="p-4"><Edit size={16} className="text-slate-300" /></td>}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={8} className="py-28 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <Package size={56} className="text-slate-200 mb-4" />
                                            <h3 className="text-xl font-bold text-slate-400 uppercase">No Products Found</h3>
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
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in duration-200">
                        
                        {/* Modal Header */}
                        <div className="bg-blue-600 p-4 flex justify-between items-center text-white shadow-lg">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-white/20 rounded-lg"><Zap size={20} /></div>
                                <div>
                                    <h2 className="font-bold uppercase tracking-tight">Technical SKU Registry</h2>
                                    <p className="text-[10px] font-bold text-blue-100 uppercase">Registry Code: {formData.product_code}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="hover:bg-blue-500 p-1 rounded-full"><X size={24}/></button>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex bg-slate-50 border-b px-6">
                            <button onClick={() => setActiveTab('identity')} className={`py-4 px-6 text-[10px] font-bold uppercase tracking-widest relative ${activeTab === 'identity' ? 'text-blue-600' : 'text-slate-400'}`}>
                                01. Core Identity & Class {activeTab === 'identity' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"/>}
                            </button>
                            <button onClick={() => setActiveTab('technical')} className={`py-4 px-6 text-[10px] font-bold uppercase tracking-widest relative ${activeTab === 'technical' ? 'text-blue-600' : 'text-slate-400'}`}>
                                02. Spinning & Technicals {activeTab === 'technical' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"/>}
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-6">
                            
                            {/* LEFT SIDE: Entry Form (All original fields preserved) */}
                            <div className="flex-1 space-y-6">
                                {activeTab === 'identity' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-slate-50 p-5 rounded-xl space-y-4 border">
                                            <div className="flex items-center gap-2 mb-2 text-slate-400"><Database size={14}/><span className="text-[9px] font-black uppercase">Core Metadata</span></div>
                                            <InputField label="Product Code" value={formData.product_code} readOnly className="font-mono text-blue-600" />
                                            <InputField label="Product Description *" value={formData.product_name} onChange={e => setFormData({...formData, product_name: e.target.value.toUpperCase()})} />
                                            <InputField label="Short Description" value={formData.short_description} onChange={e => setFormData({...formData, short_description: e.target.value.toUpperCase()})} />
                                        </div>

                                        <div className="bg-slate-50 p-5 rounded-xl space-y-4 border">
                                            <div className="flex items-center gap-2 mb-2 text-slate-400"><Tag size={14}/><span className="text-[9px] font-black uppercase">Commodity Logic</span></div>
                                            <InputField label="Commodity Name" value={formData.commodity} onChange={e => setFormData({...formData, commodity: e.target.value.toUpperCase()})} />
                                            <InputField label="Commodity Code" value={formData.commodity_code} onChange={e => setFormData({...formData, commodity_code: e.target.value})} />
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Tariff Sub Head (Master)</label>
                                                <select value={formData.tariff_sub_head} onChange={e => handleTariffChange(e.target.value)} className="w-full bg-white border border-slate-200 p-2 rounded-lg text-sm font-bold">
                                                    <option value="">-- Choose Tariff --</option>
                                                    {tariffs.map(t => <option key={t.id} value={t.tariff_code}>{t.tariff_name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-slate-50 p-5 rounded-xl space-y-4 border">
                                            <div className="flex items-center gap-2 mb-2 text-slate-400"><Settings size={14}/><span className="text-[9px] font-black uppercase">Spinning Params</span></div>
                                            <InputField label="Spinning Count Name" value={formData.spinning_count_name} onChange={e => setFormData({...formData, spinning_count_name: e.target.value.toUpperCase()})} />
                                            <InputField label="Actual Count" value={formData.actual_count} onChange={e => setFormData({...formData, actual_count: e.target.value})} />
                                            <InputField label="Converted Factor 40s" type="number" step="0.001" value={formData.converted_factor_40s} onChange={e => setFormData({...formData, converted_factor_40s: e.target.value})} />
                                        </div>

                                        <div className="bg-slate-50 p-5 rounded-xl space-y-4 border">
                                            <div className="flex items-center gap-2 mb-2 text-slate-400"><Info size={14}/><span className="text-[9px] font-black uppercase">Compliance Info</span></div>
                                            <InputField label="HSN / Tariff No" value={formData.printing_tariff_sub_head_no} readOnly className="bg-white/50" />
                                            <InputField label="Product Type" value={formData.product_type} readOnly className="bg-white/50" />
                                            <InputField label="Fibre" value={formData.fibre} readOnly className="bg-white/50 uppercase" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* RIGHT SIDE: Logistics Cockpit (Financial-style Dashboard) */}
                            <div className="w-full lg:w-96 bg-slate-900 rounded-2xl p-6 text-white flex flex-col justify-between shadow-2xl">
                                <div className="space-y-4">
                                    <div className="text-center mb-6">
                                        <Activity size={32} className="text-blue-400 mx-auto mb-1" />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory & Packaging Logic</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Packing Configuration</label>
                                            <select value={formData.packing_type} onChange={e => setFormData({...formData, packing_type: e.target.value})} className="w-full bg-slate-800 border-none p-2 rounded-lg text-sm font-bold text-blue-300 outline-none">
                                                <option value="">-- SELECT PACKING --</option>
                                                {packingTypes.map(p => <option key={p.id} value={p.packing_type}>{p.packing_type}</option>)}
                                            </select>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <LedgerInput label="Wt Per Cone" value={formData.wt_per_cone} onChange={val => setFormData({...formData, wt_per_cone: val})} />
                                            <LedgerInput label="Cones / Pack" value={formData.no_of_cones_per_pack} onChange={val => setFormData({...formData, no_of_cones_per_pack: val})} />
                                        </div>

                                        <LedgerInput label="Pack Nett Wt (KG)" color="text-amber-400" value={formData.pack_nett_wt} readOnly/>
                                        <LedgerInput label="Charity Amount (₹)" value={formData.charity_rs} onChange={val => setFormData({...formData, charity_rs: val})} />
                                        <LedgerInput label="Other Receipt (₹)" value={formData.other_receipt} onChange={val => setFormData({...formData, other_receipt: val})} />

                                        <div className="flex items-center gap-3 pt-2">
                                            <button type="button" onClick={() => setFormData({...formData, roundoff: !formData.roundoff})}>
                                                {formData.roundoff ? <CheckSquare className="text-blue-400" size={20}/> : <Square className="text-slate-600" size={20}/>}
                                            </button>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Apply Round-Off Logic</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 p-6 bg-blue-600/10 rounded-3xl border border-blue-500/20 text-center relative overflow-hidden group">
                                    <Warehouse className="absolute -right-2 -bottom-2 text-white/5 group-hover:scale-110 transition-transform" size={80} />
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 relative z-10">Current Mill Stock</p>
                                    <div className="flex items-baseline justify-center gap-2 relative z-10">
                                        <input 
                                            type="number" 
                                            className="bg-transparent text-3xl font-black text-white font-mono text-center w-24 outline-none"
                                            value={formData.mill_stock}
                                            onChange={e => setFormData({...formData, mill_stock: e.target.value})}
                                        />
                                        <span className="text-xs font-bold text-slate-500 uppercase">KG</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 bg-slate-50 border-t flex justify-end items-center gap-4">
                            {formData.id && (
                                <button onClick={() => {if(window.confirm("Purge SKU?")) mastersAPI.products.delete(formData.id).then(() => {setIsModalOpen(false); fetchRecords();});}} className="mr-auto text-rose-500 text-[10px] font-bold uppercase tracking-widest hover:bg-rose-50 px-4 py-2 rounded-lg transition-all">
                                    Purge Record
                                </button>
                            )}
                            <button onClick={() => setIsModalOpen(false)} className="px-8 py-3 font-bold text-slate-400 hover:text-slate-600 text-xs tracking-widest uppercase transition-colors">Discard</button>
                            <button onClick={handleSave} disabled={submitLoading} className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3 rounded-xl font-black shadow-xl flex items-center gap-2 active:scale-95 transition-all text-xs tracking-widest uppercase">
                                <Save size={18}/> {submitLoading ? 'COMMITTING...' : 'COMMIT SKU REGISTRY'}
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

// HELPER COMPONENTS
const InputField = ({ label, className = "", ...props }) => (
    <div className={`space-y-1 ${className}`}>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{label}</label>
        <input {...props} className="w-full bg-white border border-slate-200 p-2 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500 uppercase" />
    </div>
);

const LedgerInput = ({ label, value, color = "text-white", onChange, readOnly=false }) => (
    <div className="space-y-1">
        <label className="text-[8px] font-black text-slate-500 uppercase block tracking-tighter">{label}</label>
        <input
            type="number"
            step="0.001"
            readOnly={readOnly}
            className={`w-full bg-white/5 border border-white/5 rounded-lg p-2 text-right text-xs font-bold font-mono outline-none focus:border-blue-500 ${color}`}
            value={value}
            onChange={readOnly ? undefined : e => onChange(e.target.value)}
        />
    </div>
);

export default ProductMaster;