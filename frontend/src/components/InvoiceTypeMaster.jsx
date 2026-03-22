import React, { useState, useEffect, useMemo } from 'react';
import { mastersAPI } from '../service/api';
import { 
    Plus, Edit, Trash2, X, ChevronLeft, 
    ChevronRight, RefreshCw, Save, Calculator, Search, Filter, 
    Square, CheckSquare, FileText, Loader2
} from 'lucide-react';

const TAX_ROWS_CONFIG = [
    { id: 'charity', label: 'Charity / Bale' },
    { id: 'vat',     label: 'Tax [ VAT ]' },
    { id: 'duty',    label: 'Duty' },
    { id: 'cess',    label: 'Cess' },
    { id: 'hr_sec_cess', label: 'Hr.Sec.Cess' },
    { id: 'tcs',     label: 'T.C.S' },
    { id: 'cst',     label: 'CST' },
    { id: 'cenvat',  label: 'CENVAT' },
];
const TaxRow = ({ label, checked, onCheck, val, onVal, formula, onFormula, debit, onDebit, credit, onCredit, color = "" }) => (
  <div className={`grid grid-cols-12 gap-3 px-5 py-2.5 border-b hover:bg-slate-50 items-center ${color}`}>
    <div className="col-span-2 font-bold text-slate-700">{label}</div>
    <div className="col-span-1 flex justify-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onCheck(e.target.checked)}
        className="w-6 h-6 accent-blue-600 cursor-pointer"
      />
    </div>
    <div className="col-span-1">
      <input
        type="number"
        className="w-full p-2 border border-slate-300 rounded-lg text-center font-bold"
        // FIX: If value is 0, show empty string so screen stays clean
        value={val === 0 ? '' : val} 
        onChange={e => onVal(e.target.value)}
      />
    </div>
    <div className="col-span-4">
      <input
        className="w-full p-2 border border-slate-300 rounded-lg font-mono text-sm text-blue-700 bg-blue-50/30"
        value={formula || ''}
        onChange={e => onFormula(e.target.value)}
        placeholder="Formula"
      />
    </div>
    <div className="col-span-2">
      <input
        className="w-full p-2 border border-slate-300 rounded-lg uppercase text-xs font-bold"
        value={debit || ''}
        onChange={e => onDebit(e.target.value.toUpperCase())}
        placeholder="DEBIT A/C"
      />
    </div>
    <div className="col-span-2">
      <input
        className="w-full p-2 border border-slate-300 rounded-lg uppercase text-xs font-bold"
        value={credit || ''}
        onChange={e => onCredit(e.target.value.toUpperCase())}
        placeholder="CREDIT A/C"
      />
    </div>
  </div>
);
const InvoiceTypeMaster = () => {
    const [list, setList] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    
    const [searchField, setSearchField] = useState('type_name');
    const [searchCondition, setSearchCondition] = useState('Like');
    const [searchValue, setSearchValue] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const getEmptyInitialState = () => ({
        id: null,
        code: '', 
        type_name: '', 
        sales_type: 'DIRECT SALES', 
        group_name: 'OTHERS', 
        is_option_ii: false,
        round_off_digits: 0,
        account_posting: true,
        assess_checked: true,
        assess_formula: '',
        assess_account: '',
        assess_credit: '',
        rows: TAX_ROWS_CONFIG.map(c => ({
            id: c.id, label: c.label, checked: false, val: 0, formula: '', debit: '', credit: ''
        })),
        gst_checked: false,
        gst_percentage: 0,
        gst_formula: '',
        gst_account: '',

        sgst_checked: false,
        sgst_percentage: 0,
        sgst_formula: '',
        sgst_account: '',

        cgst_checked: false,
        cgst_percentage: 0,
        cgst_formula: '',
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
    });

    const [formData, setFormData] = useState(getEmptyInitialState());

    // DB ↔ UI mapping (unchanged – already good)
    const mapDbToUi = (dbItem) => {
        const state = { ...getEmptyInitialState(), ...dbItem };
        state.rows = TAX_ROWS_CONFIG.map(c => ({
            id: c.id,
            label: c.label,
            checked: dbItem[`${c.id}_checked`] || false,
            val: dbItem[`${c.id}_percentage`] || dbItem[`${c.id}_value`] || 0,
            formula: dbItem[`${c.id}_formula`] || '',
            debit: dbItem[`${c.id}_account`] || '',
            credit: dbItem[`${c.id}_credit`] || ''  // if you add credit in future
        }));
        return state;
    };

    const mapUiToDb = (uiState) => {
        const db = { ...uiState };
        uiState.rows.forEach(r => {
            db[`${r.id}_checked`]  = r.checked;
            db[`${r.id}_formula`]  = r.formula;
            db[`${r.id}_account`]  = r.debit;
            db[`${r.id}_credit`]   = r.credit;   // optional
            if (r.id === 'charity') db[`charity_value`] = r.val;
            else db[`${r.id}_percentage`] = r.val;
        });
        delete db.rows;
        return db;
    };

    useEffect(() => { fetchRecords(); }, []);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await mastersAPI.invoiceTypes.getAll();
            const rawData = res?.data?.data || res?.data || [];
            setList(Array.isArray(rawData) ? rawData : []);
        } catch (err) { setList([]); } finally { setLoading(false); }
    };

    const handleAddNew = () => {
        const safeList = Array.isArray(list) ? list : [];
        const maxCode = safeList.reduce((max, item) => {
            const num = parseInt(item.code, 10);
            return !isNaN(num) ? Math.max(max, num) : max;
        }, 0);
        setFormData({ 
            ...getEmptyInitialState(), 
            code: (maxCode + 1).toString() 
        });
        setIsModalOpen(true);
    };

    const handleRowClick = (item) => {
        if (isSelectionMode) {
            setSelectedIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]);
        } else {
            setFormData(mapDbToUi(item));
            setIsModalOpen(true);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (window.confirm(`Permanently delete ${selectedIds.length} invoice types?`)) {
            try {
                await Promise.all(selectedIds.map(id => mastersAPI.invoiceTypes.delete(id)));
                setSelectedIds([]);
                setIsSelectionMode(false);
                fetchRecords();
            } catch (err) { alert("Delete failed"); }
        }
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!formData.type_name?.trim()) return alert("Invoice Type name is required");
        setSubmitLoading(true);
        try {
            const payload = mapUiToDb(formData);
            if (formData.id) await mastersAPI.invoiceTypes.update(formData.id, payload);
            else await mastersAPI.invoiceTypes.create(payload);
            fetchRecords();
            setIsModalOpen(false);
        } catch (err) { alert("Error saving."); } finally { setSubmitLoading(false); }
    };

    const filteredData = useMemo(() => {
        let result = Array.isArray(list) ? [...list] : [];
        if (searchValue.trim()) {
            result = result.filter(item => {
                const val = String(item[searchField] || '').toLowerCase();
                const term = searchValue.toLowerCase().trim();
                return searchCondition === 'Equal' ? val === term : val.includes(term);
            });
        }
        return result.sort((a, b) => b.id - a.id);
    }, [list, searchValue, searchField, searchCondition]);

    const currentItems = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;

    const FormLabel = ({ children }) => (
        <label className="text-right text-base text-slate-700 pr-3 font-semibold self-center whitespace-nowrap">
            {children}
        </label>
    );
    // 1. THIS MUST BE OUTSIDE THE MAIN COMPONENT TO FIX CURSOR FOCUS


    return (
        <div className="min-h-screen bg-slate-100 p-6 font-sans">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Calculator className="text-blue-700" /> Invoice Type Master
                </h1>
                <div className="flex gap-2">
                    <button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-xs uppercase shadow-md transition-all flex items-center gap-1">
                        <Plus size={16} /> New Type
                    </button>
                    <button onClick={fetchRecords} className="p-2 border border-slate-200 rounded-lg bg-white">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[180px]">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Search Field</label>
                    <select value={searchField} onChange={e => setSearchField(e.target.value)} className="w-full border border-slate-200 p-2 rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="type_name">Type Description</option>
                        <option value="code">Code</option>
                    </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Condition</label>
                    <select value={searchCondition} onChange={e => setSearchCondition(e.target.value)} className="w-full border p-2 rounded-xl text-[13px] outline-none">
                        <option value="Like">Like</option>
                        <option value="Equal">Equal</option>
                    </select>
                </div>
                <div className="flex-[2] min-w-[280px]">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Value</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input type="text" value={searchValue} onChange={e => setSearchValue(e.target.value)} className="w-full border pl-9 pr-4 py-2 rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-blue-500" placeholder="Live search..." />
                    </div>
                </div>

                {!isSelectionMode ? (
                    <button onClick={() => setIsSelectionMode(true)} className="border border-blue-200 bg-blue-50 text-blue-600 px-8 py-2 rounded-xl text-base font-bold hover:bg-blue-100 shadow-sm transition-all">
                        Select
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} className="border border-slate-200 px-6 py-2 rounded-xl text-base font-bold text-slate-600 hover:bg-slate-50">
                            Clear
                        </button>
                        <button onClick={handleBulkDelete} disabled={selectedIds.length === 0} className="bg-red-500 text-white px-6 py-2 rounded-xl text-base font-bold shadow-md disabled:opacity-50 flex items-center gap-1">
                            <Trash2 size={16} /> Delete ({selectedIds.length})
                        </button>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-blue-700 border-b text-white text-sm font-bold uppercase tracking-wider">
                        <tr>
                            {isSelectionMode && <th className="p-4 w-12 text-center">#</th>}
                            <th className="p-4">Code</th>
                            <th className="p-4">Invoice Type Name</th>
                            <th className="p-4">Sales Type</th>
                            {!isSelectionMode && <th className="p-4 w-10"></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={4} className="p-12 text-center text-slate-400">Loading...</td></tr>
                        ) : currentItems.length > 0 ? currentItems.map(item => (
                            <tr 
                                key={item.id} 
                                className={`hover:bg-blue-50 cursor-pointer ${selectedIds.includes(item.id) ? 'bg-blue-100/50' : ''}`} 
                                onClick={() => handleRowClick(item)}
                            >
                                {isSelectionMode && (
                                    <td className="p-4 text-center">
                                        {selectedIds.includes(item.id) ? <CheckSquare size={18} className="text-blue-600 mx-auto"/> : <Square size={18} className="text-slate-200 mx-auto"/>}
                                    </td>
                                )}
                                <td className="p-4 text-base font-bold text-blue-600 font-mono">{item.code}</td>
                                <td className="p-4 text-base font-semibold text-slate-700 uppercase">{item.type_name}</td>
                                <td className="p-4 text-base text-slate-600 uppercase">{item.sales_type || '—'}</td>
                                {!isSelectionMode && <td className="p-4 text-slate-300"><Edit size={16} /></td>}
                            </tr>
                        )) : (
                            <tr><td colSpan={4} className="p-12 text-center text-slate-400">No invoice types found</td></tr>
                        )}
                    </tbody>
                </table>

                <div className="p-3 bg-slate-50 border-t flex items-center justify-between text-sm">
                    <span className="text-slate-500 font-medium">Page {currentPage} of {totalPages}</span>
                    <div className="flex gap-1">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1.5 border rounded bg-white disabled:opacity-40"><ChevronLeft size={16}/></button>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1.5 border rounded bg-white disabled:opacity-40"><ChevronRight size={16}/></button>
                    </div>
                </div>
            </div>

            {/* Modal – wider & cleaner fonts */}
           {isModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4">
    <div className="relative bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200/70 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-4 flex justify-between items-center text-white shadow-md">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-white/15 rounded-xl">
            <FileText size={26} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Invoice Type Master</h2>
            <p className="text-blue-100/90 text-sm font-medium mt-0.5 uppercase tracking-widest">
              {formData.id ? 'Edit Configuration' : 'Create New Configuration'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(false)}
          className="p-2 rounded-xl hover:bg-white/20 transition-colors active:scale-95"
        >
          <X size={28} strokeWidth={2.5} />
        </button>
      </div>

      {/* Body */}
      <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
        <form onSubmit={handleSave} className="space-y-5">
                {/* Top row - Code, Option II, Round off */}
          <div className="grid grid-cols-12 gap-4 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="col-span-1 flex justify-end">
              <FormLabel>Code</FormLabel>
            </div>
            <div className="col-span-2">
              <input
                readOnly
                className="w-full p-3 bg-slate-800 text-white font-mono font-bold rounded-xl border border-slate-600 cursor-not-allowed text-center"
                value={formData.code || 'NEW'}
              />
            </div>

            <div className="col-span-3 flex items-center justify-center gap-4 border-x border-slate-100 px-4">
              <input
                type="checkbox"
                id="opt2"
                checked={formData.is_option_ii}
                onChange={e => setFormData({...formData, is_option_ii: e.target.checked})}
                className="w-6 h-6 accent-blue-600 cursor-pointer"
              />
              <label htmlFor="opt2" className="text-base font-bold text-slate-700 cursor-pointer">Option II</label>
            </div>

            <div className="col-span-6 flex items-center gap-4 justify-end">
              <FormLabel>Round off digits</FormLabel>
              <input
                type="number"
                className="w-24 p-3 border border-slate-300 rounded-xl text-center text-lg font-bold focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                value={formData.round_off_digits ?? ''}
                onChange={e => setFormData({...formData, round_off_digits: Number(e.target.value)})}
              />
            </div>
          </div>

          {/* Basic info row */}
          <div className="grid grid-cols-12 gap-4 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="col-span-2 flex justify-end"><FormLabel>Invoice Type</FormLabel></div>
            <div className="col-span-4">
              <input
                required
                className="w-full p-3 border border-slate-300 rounded-xl uppercase font-bold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                value={formData.type_name || ''}
                onChange={e => setFormData({...formData, type_name: e.target.value.toUpperCase()})}
              />
            </div>

            <div className="col-span-2 flex justify-end"><FormLabel>Sales Type</FormLabel></div>
            <div className="col-span-4">
              <select
                className="w-full p-3 border border-slate-300 rounded-xl font-bold text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none appearance-none bg-white"
                value={formData.sales_type || ''}
                onChange={e => setFormData({...formData, sales_type: e.target.value})}
              >
                <option value="DIRECT SALES">DIRECT SALES</option>
                <option value="GST SALES">GST SALES</option>
                <option value="DEPOT SALES">DEPOT SALES</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="col-span-2 flex justify-end"><FormLabel>Group Name</FormLabel></div>
            <div className="col-span-4">
              <input
                className="w-full p-3 border border-slate-300 rounded-xl uppercase font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                value={formData.group_name || ''}
                onChange={e => setFormData({...formData, group_name: e.target.value.toUpperCase()})}
              />
            </div>

            <div className="col-span-6 flex items-center justify-center gap-6">
              <label className="flex items-center gap-3 text-base font-bold text-slate-700 cursor-pointer bg-blue-50 px-6 py-2.5 rounded-xl border border-blue-100">
                <input
                  type="checkbox"
                  checked={formData.account_posting}
                  onChange={e => setFormData({...formData, account_posting: e.target.checked})}
                  className="w-6 h-6 accent-blue-600"
                />
                Enable Account Posting
              </label>
            </div>
          </div>

          {/* Tax Mapping Table Container */}
<div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-md">
    {/* HEADER */}
    <div className="bg-slate-800 text-white grid grid-cols-12 py-4 px-6 font-bold text-sm uppercase tracking-widest sticky top-0 z-10">
        <div className="col-span-2">Description</div>
        <div className="col-span-1 text-center">Enable</div>
        <div className="col-span-1 text-center">% / Val</div>
        <div className="col-span-4 px-2 text-center">Calculation Formula</div>
        <div className="col-span-2 px-1 text-center">Debit Account</div>
        <div className="col-span-2 px-1 text-center">Credit Account</div>
    </div>

    {/* Assess Value Row */}
    <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b hover:bg-slate-50 items-center">
        <div className="col-span-2 font-bold text-slate-700">Assess Value</div>
        <div className="col-span-1 flex justify-center">
            <input
                type="checkbox"
                checked={formData.assess_checked}
                onChange={e => setFormData({...formData, assess_checked: e.target.checked})}
                className="w-6 h-6 accent-blue-600 cursor-pointer"
            />
        </div>
        <div className="col-span-1" />
        <div className="col-span-4">
            <input
                className="w-full p-2 border border-slate-300 rounded-lg font-mono text-sm text-blue-700 bg-blue-50/30"
                value={formData.assess_formula || ''}
                onChange={e => setFormData({...formData, assess_formula: e.target.value})}
                placeholder="[I]"
            />
        </div>
        <div className="col-span-2">
            <input
                className="w-full p-2 border border-slate-300 rounded-lg uppercase text-xs font-bold"
                value={formData.assess_account || ''}
                onChange={e => setFormData({...formData, assess_account: e.target.value.toUpperCase()})}
                placeholder="DEBIT A/C"
            />
        </div>
        <div className="col-span-2">
            <input
                className="w-full p-2 border border-slate-300 rounded-lg uppercase text-xs font-bold"
                value={formData.assess_credit || ''}
                onChange={e => setFormData({...formData, assess_credit: e.target.value.toUpperCase()})}
                placeholder="CREDIT A/C"
            />
        </div>
    </div>

    {/* Map through TAX_ROWS_CONFIG rows */}
    {formData.rows?.map((row, idx) => (
        <TaxRow
            key={row.id}
            label={row.label}
            checked={row.checked}
            onCheck={(val) => {
                const newRows = [...formData.rows];
                newRows[idx].checked = val;
                setFormData({...formData, rows: newRows});
            }}
            val={row.val}
            onVal={(val) => {
                const newRows = [...formData.rows];
                newRows[idx].val = val;
                setFormData({...formData, rows: newRows});
            }}
            formula={row.formula}
            onFormula={(val) => {
                const newRows = [...formData.rows];
                newRows[idx].formula = val;
                setFormData({...formData, rows: newRows});
            }}
            debit={row.debit}
            onDebit={(val) => {
                const newRows = [...formData.rows];
                newRows[idx].debit = val;
                setFormData({...formData, rows: newRows});
            }}
            credit={row.credit}
            onCredit={(val) => {
                const newRows = [...formData.rows];
                newRows[idx].credit = val;
                setFormData({...formData, rows: newRows});
            }}
        />
    ))}

    {/* Individual Tax Sections */}
    <TaxRow 
        label="GST (General)" 
        color="bg-slate-50"
        checked={formData.gst_checked} 
        onCheck={(v) => setFormData({...formData, gst_checked: v})}
        val={formData.gst_percentage}
        onVal={(v) => setFormData({...formData, gst_percentage: v})}
        formula={formData.gst_formula}
        onFormula={(v) => setFormData({...formData, gst_formula: v})}
        debit={formData.gst_account}
        onDebit={(v) => setFormData({...formData, gst_account: v})}
    />

    <TaxRow 
        label="SGST" 
        color="bg-orange-50/20"
        checked={formData.sgst_checked} 
        onCheck={(v) => setFormData({...formData, sgst_checked: v})}
        val={formData.sgst_percentage}
        onVal={(v) => setFormData({...formData, sgst_percentage: v})}
        formula={formData.sgst_formula}
        onFormula={(v) => setFormData({...formData, sgst_formula: v})}
        debit={formData.sgst_account}
        onDebit={(v) => setFormData({...formData, sgst_account: v})}
    />

    <TaxRow 
        label="CGST" 
        color="bg-blue-50/20"
        checked={formData.cgst_checked} 
        onCheck={(v) => setFormData({...formData, cgst_checked: v})}
        val={formData.cgst_percentage}
        onVal={(v) => setFormData({...formData, cgst_percentage: v})}
        formula={formData.cgst_formula}
        onFormula={(v) => setFormData({...formData, cgst_formula: v})}
        debit={formData.cgst_account}
        onDebit={(v) => setFormData({...formData, cgst_account: v})}
    />

    <TaxRow 
        label="IGST" 
        color="bg-indigo-50/40"
        checked={formData.igst_checked} 
        onCheck={(v) => setFormData({...formData, igst_checked: v})}
        val={formData.igst_percentage}
        onVal={(v) => setFormData({...formData, igst_percentage: v})}
        formula={formData.igst_formula}
        onFormula={(v) => setFormData({...formData, igst_formula: v})}
        debit={formData.igst_account}
        onDebit={(v) => setFormData({...formData, igst_account: v})}
        credit={formData.igst_credit}
        onCredit={(v) => setFormData({...formData, igst_credit: v})}
    />
            
          </div>

          {/* Footer formulas */}
          <div className="grid grid-cols-12 gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="col-span-2 flex justify-end items-center font-bold text-slate-700">Sub Total</div>
            <div className="col-span-10">
              <input
                className="w-full p-4 border border-slate-300 rounded-xl font-mono text-lg font-bold text-blue-800 bg-slate-50 focus:ring-2 focus:ring-blue-200 outline-none"
                value={formData.sub_total_formula || ''}
                onChange={e => setFormData({...formData, sub_total_formula: e.target.value})}
              />
            </div>

            <div className="col-span-2 flex justify-end items-center font-bold text-slate-700">Total Value</div>
            <div className="col-span-10">
              <input
                className="w-full p-4 border border-slate-300 rounded-xl font-mono text-lg font-bold text-emerald-800 bg-slate-50 focus:ring-2 focus:ring-emerald-200 outline-none"
                value={formData.total_value_formula || ''}
                onChange={e => setFormData({...formData, total_value_formula: e.target.value})}
              />
            </div>

            <div className="col-span-2 flex justify-end items-center font-bold text-slate-700">Round Off</div>
            <div className="col-span-10 flex flex-col md:flex-row gap-6 items-center">
              <div className="flex gap-8 bg-slate-100 p-3 px-6 rounded-xl border border-slate-200">
                <label className="flex items-center gap-3 text-base font-bold text-slate-600 cursor-pointer">
                  <input
                    type="radio"
                    value="Forward"
                    checked={formData.round_off_direction === 'Forward'}
                    onChange={e => setFormData({...formData, round_off_direction: e.target.value})}
                    className="w-5 h-5 accent-blue-600"
                  />
                  Forward
                </label>
                <label className="flex items-center gap-3 text-base font-bold text-slate-600 cursor-pointer">
                  <input
                    type="radio"
                    value="Reverse"
                    checked={formData.round_off_direction === 'Reverse'}
                    onChange={e => setFormData({...formData, round_off_direction: e.target.value})}
                    className="w-5 h-5 accent-blue-600"
                  />
                  Reverse
                </label>
              </div>
              <input
                className="flex-1 p-4 border border-slate-300 rounded-xl uppercase font-bold text-slate-700 focus:ring-2 focus:ring-blue-200 outline-none"
                value={formData.round_off_account || ''}
                onChange={e => setFormData({...formData, round_off_account: e.target.value.toUpperCase()})}
                placeholder="ROUND OFF LEDGER ACCOUNT"
              />
            </div>

            <div className="col-span-2 flex justify-end items-center font-bold text-slate-700">Lorry Freight</div>
            <div className="col-span-10">
              <input
                className="w-full p-4 border border-slate-300 rounded-xl uppercase font-bold text-slate-700 focus:ring-2 focus:ring-blue-200 outline-none"
                value={formData.lorry_freight_account || ''}
                onChange={e => setFormData({...formData, lorry_freight_account: e.target.value.toUpperCase()})}
                placeholder="FREIGHT OUTWARD LEDGER"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-6 pt-8 border-t border-slate-200 mt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-10 py-4 border-2 border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-all text-lg active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitLoading}
              className={`
                px-14 py-4 rounded-xl font-bold flex items-center gap-3 shadow-xl min-w-[220px] justify-center text-lg transition-all active:scale-95
                ${submitLoading
                  ? 'bg-slate-400 text-white cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-200'
                }
              `}
            >
              {submitLoading ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save size={24} />
                  {formData.id ? 'Update Record' : 'Save Record'}
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  </div>
)}
        </div>
    );
};

export default InvoiceTypeMaster;