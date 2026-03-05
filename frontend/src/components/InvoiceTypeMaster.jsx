import React, { useState, useEffect, useMemo } from 'react';
import { mastersAPI } from '../service/api';
import { 
    Plus, Edit, Trash2, X, ChevronLeft, 
    ChevronRight, Loader2, CheckSquare, Square, RefreshCw, 
    Save, CheckCircle2, Calculator, Search, Filter, Info, Hash, Database,
    Settings, BookOpen
} from 'lucide-react';

// --- Helper: List of tax components following the original structure ---
const TAX_COMPONENTS = [
    { id: 'charity', label: 'Charity / Bale', valLabel: 'Value' },
    { id: 'vat', label: 'Tax [ VAT ]', valLabel: '%' },
    { id: 'duty', label: 'Duty', valLabel: '%' },
    { id: 'cess', label: 'Cess', valLabel: '%' },
    { id: 'hr_sec_cess', label: 'Hr.Sec.Cess', valLabel: '%' },
    { id: 'tcs', label: 'T.C.S', valLabel: '%' },
    { id: 'cst', label: 'CST', valLabel: '%' },
    { id: 'cenvat', label: 'CENVAT', valLabel: '%' },
];

const InvoiceTypeMaster = () => {
    // --- State Management ---
    const [list, setList] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    
    // Selection & Bulk Actions
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    
    // Success Animation
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    
    // Dynamic Filtering
    const [searchField, setSearchField] = useState('type_name');
    const [searchCondition, setSearchCondition] = useState('Like');
    const [searchValue, setSearchValue] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    const emptyState = {
        id: null,
        code: '', 
        type_name: '', 
        sales_type: 'GST SALES', 
        group_name: 'OTHERS', 
        is_option_ii: false,
        round_off_digits: 0,
        account_posting: true,
        assess_checked: true,
        assess_formula: '[H]',
        assess_account: '',
        rows: TAX_COMPONENTS.map(c => ({
            id: c.id, label: c.label, checked: false, val: 0, formula: '', account: ''
        })),
        gst_checked: false,
        sgst_percentage: 0,
        cgst_percentage: 0,
        sgst_formula: '',
        cgst_formula: '',
        sgst_account: '',
        cgst_account: '',
        igst_checked: false,
        igst_percentage: 0,
        igst_formula: '',
        igst_account: '',
        sub_total_formula: '[I]',
        total_value_formula: '[Rate / Kg] * [Total Kgs]',
        round_off_formula: '',
        round_off_direction: 'Reverse', 
        round_off_account: 'ROUND OFF', 
        lorry_freight_account: 'FREIGHT OUTWARD', 
    };

    const [formData, setFormData] = useState(emptyState);

    // --- API & Data Mapping ---
    useEffect(() => { fetchRecords(); }, []);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await mastersAPI.invoiceTypes.getAll();
            const rawData = res?.data?.data || res?.data || [];
            setList(Array.isArray(rawData) ? rawData : []);
        } catch (err) { 
            console.error("Fetch Error:", err);
            setList([]); 
        } finally { setLoading(false); }
    };

    const mapDbToState = (db) => {
        const rows = TAX_COMPONENTS.map(c => ({
            id: c.id,
            label: c.label,
            checked: db[`${c.id}_checked`],
            val: db[`${c.id}_percentage`] || db[`${c.id}_value`] || 0,
            formula: db[`${c.id}_formula`] || '',
            account: db[`${c.id}_account`] || ''
        }));
        return { ...db, rows };
    };

    const mapStateToDb = (state) => {
        const flat = { ...state };
        state.rows.forEach(r => {
            flat[`${r.id}_checked`] = r.checked;
            flat[`${r.id}_formula`] = r.formula;
            flat[`${r.id}_account`] = r.account;
            if (r.id === 'charity') flat[`charity_value`] = r.val;
            else flat[`${r.id}_percentage`] = r.val;
        });
        delete flat.rows;
        return flat;
    };

    const triggerSuccess = (msg) => {
        setSuccessMessage(msg);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
    };

    // --- Filtering Logic ---
    const filteredData = useMemo(() => {
        let result = Array.isArray(list) ? [...list] : [];
        if (searchValue.trim()) {
            result = result.filter(item => {
                const itemValue = String(item[searchField] || '').toLowerCase();
                const filterValue = searchValue.toLowerCase().trim();
                return searchCondition === 'Equal' ? itemValue === filterValue : itemValue.includes(filterValue);
            });
        }
        return result;
    }, [list, searchValue, searchField, searchCondition]);

    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
    const currentItems = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // --- Actions ---
    const handleEdit = (item) => {
        if (isSelectionMode) {
            setSelectedIds(prev => prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id]);
            return;
        }
        setFormData(mapDbToState(item));
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        if(e) e.preventDefault();
        setSubmitLoading(true);
        try {
            const payload = mapStateToDb(formData);
            if (formData.id) await mastersAPI.invoiceTypes.update(formData.id, payload);
            else await mastersAPI.invoiceTypes.create(payload);
            fetchRecords();
            setIsModalOpen(false);
            triggerSuccess("Configuration Saved!");
        } catch (err) { alert("Save Failed"); } 
        finally { setSubmitLoading(false); }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
            {/* SUCCESS OVERLAY */}
            {showSuccess && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/20 backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-3 animate-in zoom-in duration-300">
                        <CheckCircle2 size={60} className="text-emerald-500" />
                        <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">{successMessage}</h3>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Calculator className="text-blue-600" /> Invoice Type Master
                    </h1>
                    <p className="text-sm text-slate-500">Manage tax calculation logic and ledger account mapping</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => {setIsSelectionMode(!isSelectionMode); setSelectedIds([]);}} 
                        className={`px-5 py-2 border rounded-lg font-semibold transition-all ${isSelectionMode ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-blue-600 hover:bg-slate-50'}`}
                    >
                        {isSelectionMode ? 'Cancel' : 'Select'}
                    </button>
                    <button onClick={() => {setFormData(emptyState); setIsModalOpen(true);}} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold shadow-sm">
                        <Plus size={18} /> New Type
                    </button>
                    <button onClick={fetchRecords} className="p-2 border border-slate-200 rounded-lg bg-white text-slate-400 hover:text-blue-600">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* FILTER BAR */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Search Field</label>
                        <select value={searchField} onChange={(e) => setSearchField(e.target.value)} className="w-full border border-slate-200 p-2 rounded-lg text-sm">
                            <option value="type_name">Invoice Type Name</option>
                            <option value="code">Code</option>
                            <option value="sales_type">Sales Type</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Condition</label>
                        <select value={searchCondition} onChange={(e) => setSearchCondition(e.target.value)} className="w-full border border-slate-200 p-2 rounded-lg text-sm">
                            <option value="Like">Like</option>
                            <option value="Equal">Equal</option>
                        </select>
                    </div>
                    <div className="relative">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Value</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input type="text" value={searchValue} onChange={(e) => setSearchValue(e.target.value)} className="w-full border border-slate-200 pl-10 pr-4 py-2 rounded-lg text-sm" placeholder="Search..." />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setSearchValue('')} className="flex-1 border border-slate-200 py-2 rounded-lg text-sm font-bold hover:bg-slate-50">Show All</button>
                        <div className="flex-1 bg-blue-50 text-blue-600 border border-blue-100 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                            <Filter size={14}/> {filteredData.length} Matches
                        </div>
                    </div>
                </div>
            </div>

            {/* DATA TABLE */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-blue-600 text-white">
                            {isSelectionMode && <th className="p-4 w-12 text-center"><Square size={18} /></th>}
                            <th className="p-4 text-sm font-semibold">Code</th>
                            <th className="p-4 text-sm font-semibold">Invoice Type Name</th>
                            <th className="p-4 text-sm font-semibold">Sales Type</th>
                            <th className="p-4 text-sm font-semibold text-center">Posting</th>
                            {!isSelectionMode && <th className="p-4 w-10"></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="6" className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" size={40} /></td></tr>
                        ) : currentItems.map((item) => (
                            <tr key={item.id} onClick={() => handleEdit(item)} className="transition-all group cursor-pointer hover:bg-blue-50">
                                {isSelectionMode && (
                                    <td className="p-4 text-center">
                                        {selectedIds.includes(item.id) ? <CheckSquare size={18} className="text-blue-600 mx-auto"/> : <Square size={18} className="text-slate-200 mx-auto"/>}
                                    </td>
                                )}
                                <td className="p-4 text-sm font-bold text-blue-600">{item.code}</td>
                                <td className="p-4 text-sm font-bold text-slate-700 uppercase">{item.type_name}</td>
                                <td className="p-4 text-sm text-slate-500">{item.sales_type}</td>
                                <td className="p-4 text-center">{item.account_posting ? '✅' : '❌'}</td>
                                {!isSelectionMode && <td className="p-4 text-right"><Edit size={16} className="text-slate-200 group-hover:text-blue-600" /></td>}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* PAGINATION FOOTER */}
                <div className="p-4 bg-slate-50 border-t flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-semibold uppercase">Count: {filteredData.length} entries</span>
                    <div className="flex gap-2">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 border rounded bg-white"><ChevronLeft size={16}/></button>
                        <div className="px-3 flex items-center text-xs font-bold">Page {currentPage} of {totalPages}</div>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 border rounded bg-white"><ChevronRight size={16}/></button>
                    </div>
                </div>
            </div>

            {/* FULL SCREEN FORM MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        
                        {/* Modal Header */}
                        <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
                            <h2 className="font-black uppercase tracking-tight flex items-center gap-2">
                                <Settings size={20}/> {formData.id ? 'Modify Invoice Logic' : 'Create New Invoice Type'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="hover:bg-blue-500 p-1 rounded-full"><X size={24}/></button>
                        </div>

                        {/* Modal Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                            
                            {/* TOP CONFIGURATION CARD */}
                            <div className="grid grid-cols-12 gap-4 mb-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Type Code</label>
                                    <div className="flex gap-2 items-center">
                                        <input className="w-full border border-slate-200 p-2 rounded-lg text-sm font-bold focus:ring-1 focus:ring-blue-500 outline-none" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} />
                                        <label className="flex items-center gap-1 text-[10px] font-bold whitespace-nowrap text-blue-600">
                                            <input type="checkbox" checked={formData.is_option_ii} onChange={e => setFormData({...formData, is_option_ii: e.target.checked})} /> Opt II
                                        </label>
                                    </div>
                                </div>
                                <div className="col-span-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Invoice Type Description</label>
                                    <input className="w-full border border-slate-200 p-2 rounded-lg text-sm font-bold uppercase focus:ring-1 focus:ring-blue-500 outline-none" value={formData.type_name} onChange={e => setFormData({...formData, type_name: e.target.value})} />
                                </div>
                                <div className="col-span-3">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Sales Category</label>
                                    <select className="w-full border border-slate-200 p-2 rounded-lg text-sm font-bold" value={formData.sales_type} onChange={e => setFormData({...formData, sales_type: e.target.value})}>
                                        <option value="GST SALES">GST SALES</option>
                                        <option value="CST SALES">CST SALES</option>
                                        <option value="DEPOT SALES">DEPOT SALES</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Round Off Digits</label>
                                    <input type="number" className="w-full border border-slate-200 p-2 rounded-lg text-sm font-bold" value={formData.round_off_digits} onChange={e => setFormData({...formData, round_off_digits: e.target.value})} />
                                </div>
                                <div className="col-span-1 flex items-end pb-1">
                                    <label className="flex items-center gap-2 text-[10px] font-black text-blue-600 cursor-pointer">
                                        <input type="checkbox" className="w-4 h-4" checked={formData.account_posting} onChange={e => setFormData({...formData, account_posting: e.target.checked})} /> POSTING
                                    </label>
                                </div>
                            </div>

                            {/* MATH ENGINE GRID */}
                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-6">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-900 text-[10px] font-black uppercase text-slate-400">
                                        <tr>
                                            <th className="p-4 w-44">Tax Component</th>
                                            <th className="p-4 w-16 text-center">Use</th>
                                            <th className="p-4 w-24 text-center">Rate / %</th>
                                            <th className="p-4">Calculation Formula Logic</th>
                                            <th className="p-4 w-72">Ledger Account Mapping</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs font-mono">
                                        {/* Assess Value Row */}
                                        <tr className="border-b bg-blue-50/50">
                                            <td className="p-4 font-bold text-blue-800">Assess Value [A]</td>
                                            <td className="p-4 text-center"><input type="checkbox" checked={formData.assess_checked} onChange={e => setFormData({...formData, assess_checked: e.target.checked})} /></td>
                                            <td className="p-4 text-center text-slate-300">-</td>
                                            <td className="p-2"><input className="w-full border border-blue-100 p-2 rounded-lg bg-white text-blue-600 font-bold" value={formData.assess_formula} onChange={e => setFormData({...formData, assess_formula: e.target.value})} /></td>
                                            <td className="p-2"><input className="w-full border border-blue-100 p-2 rounded-lg uppercase bg-white font-bold" value={formData.assess_account} onChange={e => setFormData({...formData, assess_account: e.target.value})} placeholder="LEDGER ACCOUNT" /></td>
                                        </tr>

                                        {/* Dynamic Tax Rows */}
                                        {formData.rows.map((row, idx) => (
                                            <tr key={row.id} className="border-b hover:bg-slate-50 transition-colors">
                                                <td className="p-4 font-bold text-slate-700">{row.label}</td>
                                                <td className="p-4 text-center">
                                                    <input type="checkbox" checked={row.checked} onChange={e => {
                                                        const newRows = [...formData.rows];
                                                        newRows[idx].checked = e.target.checked;
                                                        setFormData({...formData, rows: newRows});
                                                    }} />
                                                </td>
                                                <td className="p-2">
                                                    <input type="number" className="w-full border border-slate-100 p-2 rounded-lg text-center" value={row.val} onChange={e => {
                                                        const newRows = [...formData.rows];
                                                        newRows[idx].val = e.target.value;
                                                        setFormData({...formData, rows: newRows});
                                                    }} />
                                                </td>
                                                <td className="p-2">
                                                    <input className="w-full border border-slate-100 p-2 rounded-lg" value={row.formula} onChange={e => {
                                                        const newRows = [...formData.rows];
                                                        newRows[idx].formula = e.target.value;
                                                        setFormData({...formData, rows: newRows});
                                                    }} placeholder="e.g., [A] * 0.05" />
                                                </td>
                                                <td className="p-2">
                                                    <input className="w-full border border-slate-100 p-2 rounded-lg uppercase" value={row.account} onChange={e => {
                                                        const newRows = [...formData.rows];
                                                        newRows[idx].account = e.target.value;
                                                        setFormData({...formData, rows: newRows});
                                                    }} placeholder="ACCOUNT NAME" />
                                                </td>
                                            </tr>
                                        ))}

                                        {/* GST Split Section */}
                                        <tr className="border-b bg-emerald-50/30">
                                            <td className="p-4 font-bold text-emerald-700">GST (SGST + CGST)</td>
                                            <td className="p-4 text-center"><input type="checkbox" checked={formData.gst_checked} onChange={e => setFormData({...formData, gst_checked: e.target.checked})} /></td>
                                            <td className="p-2 flex gap-1">
                                                <input className="w-1/2 border border-emerald-100 p-2 rounded-lg text-center" placeholder="SGST%" value={formData.sgst_percentage} onChange={e => setFormData({...formData, sgst_percentage: e.target.value})} />
                                                <input className="w-1/2 border border-emerald-100 p-2 rounded-lg text-center" placeholder="CGST%" value={formData.cgst_percentage} onChange={e => setFormData({...formData, cgst_percentage: e.target.value})} />
                                            </td>
                                            <td className="p-2">
                                                <div className="flex gap-1">
                                                    <input className="w-1/2 border border-emerald-100 p-2 rounded-lg" placeholder="SGST Formula" value={formData.sgst_formula} onChange={e => setFormData({...formData, sgst_formula: e.target.value})} />
                                                    <input className="w-1/2 border border-emerald-100 p-2 rounded-lg" placeholder="CGST Formula" value={formData.cgst_formula} onChange={e => setFormData({...formData, cgst_formula: e.target.value})} />
                                                </div>
                                            </td>
                                            <td className="p-2">
                                                <div className="flex gap-1">
                                                    <input className="w-1/2 border border-emerald-100 p-2 rounded-lg uppercase" placeholder="SGST A/C" value={formData.sgst_account} onChange={e => setFormData({...formData, sgst_account: e.target.value})} />
                                                    <input className="w-1/2 border border-emerald-100 p-2 rounded-lg uppercase" placeholder="CGST A/C" value={formData.cgst_account} onChange={e => setFormData({...formData, cgst_account: e.target.value})} />
                                                </div>
                                            </td>
                                        </tr>

                                        {/* IGST Section */}
                                        <tr className="bg-emerald-50/50">
                                            <td className="p-4 font-bold text-emerald-800">IGST</td>
                                            <td className="p-4 text-center"><input type="checkbox" checked={formData.igst_checked} onChange={e => setFormData({...formData, igst_checked: e.target.checked})} /></td>
                                            <td className="p-2"><input type="number" className="w-full border border-emerald-200 p-2 rounded-lg text-center font-bold text-emerald-700" value={formData.igst_percentage} onChange={e => setFormData({...formData, igst_percentage: e.target.value})} /></td>
                                            <td className="p-2"><input className="w-full border border-emerald-200 p-2 rounded-lg font-bold text-emerald-700" value={formData.igst_formula} onChange={e => setFormData({...formData, igst_formula: e.target.value})} /></td>
                                            <td className="p-2"><input className="w-full border border-emerald-200 p-2 rounded-lg uppercase bg-white text-emerald-800 font-bold" value={formData.igst_account} onChange={e => setFormData({...formData, igst_account: e.target.value})} placeholder="IGST OUTPUT A/C" /></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* FOOTER CONFIGURATION */}
                            <div className="grid grid-cols-2 gap-6 mb-4">
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                    <h4 className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2"><Database size={14}/> Calculation Footers</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Sub Total Formula [I]</label>
                                            <input className="w-full border border-slate-200 p-3 rounded-xl text-sm font-mono text-blue-600 bg-slate-50 focus:bg-white transition-all" value={formData.sub_total_formula} onChange={e => setFormData({...formData, sub_total_formula: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Total Invoice Value</label>
                                            <input className="w-full border border-slate-200 p-3 rounded-xl text-sm font-mono text-blue-600 bg-slate-50 focus:bg-white transition-all" value={formData.total_value_formula} onChange={e => setFormData({...formData, total_value_formula: e.target.value})} />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-xl space-y-4">
                                    <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><Hash size={14}/> Adjustments & Round Off</h4>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Round Off Account</label>
                                            <input className="w-full bg-slate-800 border border-slate-700 p-3 rounded-xl text-sm uppercase text-blue-300 outline-none" value={formData.round_off_account} onChange={e => setFormData({...formData, round_off_account: e.target.value})} />
                                        </div>
                                        <div className="flex flex-col justify-center gap-2 pt-4">
                                            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer hover:text-blue-400">
                                                <input type="radio" name="ro" value="Forward" checked={formData.round_off_direction === 'Forward'} onChange={e => setFormData({...formData, round_off_direction: e.target.value})} /> Forward
                                            </label>
                                            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer hover:text-blue-400">
                                                <input type="radio" name="ro" value="Reverse" checked={formData.round_off_direction === 'Reverse'} onChange={e => setFormData({...formData, round_off_direction: e.target.value})} /> Reverse
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Lorry Freight Account</label>
                                        <input className="w-full bg-slate-800 border border-slate-700 p-3 rounded-xl text-sm uppercase text-blue-300 outline-none" value={formData.lorry_freight_account} onChange={e => setFormData({...formData, lorry_freight_account: e.target.value})} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-white border-t flex justify-between items-center px-8">
                            <button className="flex items-center gap-2 text-slate-400 font-bold text-xs hover:text-blue-600 uppercase tracking-widest">
                                <BookOpen size={16}/> Formula Help
                            </button>
                            <div className="flex gap-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase text-xs tracking-widest">Cancel</button>
                                <button onClick={handleSave} disabled={submitLoading} className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-3 rounded-xl font-black shadow-xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                                    <Save size={18}/> {submitLoading ? 'SAVING...' : 'UPDATE CONFIGURATION'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoiceTypeMaster;