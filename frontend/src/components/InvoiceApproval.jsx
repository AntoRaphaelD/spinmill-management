import React, { useState, useEffect, useMemo } from 'react';
import { transactionsAPI } from '../service/api';
import { 
    ShieldCheck, Clock, CheckCircle, Search, 
    AlertCircle, Eye, X, RefreshCw, ChevronLeft, 
    ChevronRight, Square, CheckSquare, Trash2, 
    UserCheck, Calculator, Filter, Hash, FileText, 
    Activity, Database, Truck, User, Info, Lock, MapPin
} from 'lucide-react';

// --- SAFE NUMBER HELPER ---
const num = (v) => {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
};

const InvoiceApproval = () => {
    // --- Main States ---
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    // --- Dynamic Filtering State ---
    const [searchField, setSearchField] = useState('party_name');
    const [searchCondition, setSearchCondition] = useState('Like');
    const [searchValue, setSearchValue] = useState('');
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // --- Initialization ---
    useEffect(() => {
        fetchPending();
    }, []);

    const fetchPending = async () => {
        setLoading(true);
        try {
            const res = await transactionsAPI.invoices.getAll();
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            // Filter only pending (unapproved) invoices
            setList(data.filter(inv => !inv.is_approved));
        } catch (err) { 
            console.error("Fetch error:", err); 
        } finally { 
            setLoading(false); 
        }
    };

    // --- Dynamic Filtering Logic ---
    const filteredData = useMemo(() => {
        let result = Array.isArray(list) ? [...list] : [];
        if (searchValue.trim()) {
            result = result.filter(item => {
                let itemValue = "";
                if (searchField === 'party_name') itemValue = item.Party?.account_name || "";
                else if (searchField === 'invoice_no') itemValue = item.invoice_no || "";
                else itemValue = String(item[searchField] || "");

                const term = searchValue.toLowerCase().trim();
                return searchCondition === 'Equal' 
                    ? itemValue.toLowerCase() === term 
                    : itemValue.toLowerCase().includes(term);
            });
        }
        return result.sort((a, b) => b.id - a.id);
    }, [list, searchValue, searchField, searchCondition]);

    const currentItems = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;

    useEffect(() => { setCurrentPage(1); }, [searchValue, searchField, searchCondition]);

    // --- Action Handlers ---
    const handleApprove = async (id) => {
        if (!window.confirm("Authorize this transaction for Ledger Posting?")) return;
        setLoading(true);
        try {
            await transactionsAPI.invoices.approve(id);
            fetchPending();
            if (selectedInvoice?.id === id) setSelectedInvoice(null);
        } catch (err) { alert("Authorization Error"); }
        finally { setLoading(false); }
    };

    const handleReject = async (id) => {
        if (!window.confirm("Rejecting will DELETE this invoice and REVERT Mill Stock. Proceed?")) return;
        setLoading(true);
        try {
            await transactionsAPI.invoices.reject(id);
            fetchPending();
            if (selectedInvoice?.id === id) setSelectedInvoice(null);
        } catch (err) { alert("Rejection Error"); }
        finally { setLoading(false); }
    };

    const handleBulkApprove = async () => {
        if (selectedIds.length === 0) return;
        if (window.confirm(`Authorize ${selectedIds.length} invoices for posting?`)) {
            setLoading(true);
            try {
                await Promise.all(selectedIds.map(id => transactionsAPI.invoices.approve(id)));
                setSelectedIds([]);
                setIsSelectionMode(false);
                fetchPending();
            } catch (err) { alert("Bulk Action Error"); }
            finally { setLoading(false); }
        }
    };
    // exact DB value from tbl_InvoiceDetails
const orderType =
    selectedInvoice?.InvoiceDetails?.[0]?.order_type || 'N/A';
    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
            
            {/* 1. TOP HEADER */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <ShieldCheck className="text-amber-500" /> Post-Transaction Audit
                    </h1>
                    <p className="text-sm text-slate-500 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                        {list.length} Invoices Awaiting Authorization
                    </p>
                </div>
                
                <div className="flex gap-2">
                    <button 
                        onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds([]); }}
                        className={`px-5 py-2 border rounded-lg font-semibold transition-all ${isSelectionMode ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-blue-600 hover:bg-slate-50'}`}
                    >
                        {isSelectionMode ? 'Exit Selection' : 'Bulk Select'}
                    </button>

                    {isSelectionMode ? (
                        <button 
                            onClick={handleBulkApprove}
                            disabled={selectedIds.length === 0}
                            className={`px-5 py-2 border rounded-lg flex items-center gap-2 transition-all ${selectedIds.length > 0 ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-300 cursor-not-allowed'}`}
                        >
                            <UserCheck size={18} /> Authorize Selected ({selectedIds.length})
                        </button>
                    ) : (
                        <div className="flex items-center bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-xs font-bold gap-2">
                            <Activity size={14}/> Queue Active
                        </div>
                    )}

                    <button onClick={fetchPending} className="p-2 border border-slate-200 rounded-lg bg-white text-slate-400 hover:text-blue-600 transition-colors">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* 2. DYNAMIC FILTER BAR */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block ml-1">Search Field</label>
                        <select value={searchField} onChange={(e) => setSearchField(e.target.value)} className="w-full border border-slate-200 p-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="party_name">Customer Name</option>
                            <option value="invoice_no">Invoice Ref</option>
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
                            <input type="text" placeholder="Filter queue..." value={searchValue} onChange={(e) => setSearchValue(e.target.value)} className="w-full border border-slate-200 pl-10 pr-4 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
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
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-blue-600 text-white">
                                {isSelectionMode && (
                                    <th className="p-4 w-12 text-center">
                                        <button onClick={() => setSelectedIds(selectedIds.length === currentItems.length ? [] : currentItems.map(i => i.id))}>
                                            {selectedIds.length === currentItems.length && currentItems.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                                        </button>
                                    </th>
                                )}
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider">Inv #</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider">Date</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider">Party / Ledger Name</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider text-right">Value (₹)</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider text-center">Status</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider text-center w-32">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                            {currentItems.length > 0 ? currentItems.map((item) => (
                                <tr key={item.id} className={`transition-colors cursor-pointer group ${selectedIds.includes(item.id) ? 'bg-amber-50' : 'hover:bg-blue-50/50'}`}>
                                    {isSelectionMode && (
                                        <td className="p-4 text-center" onClick={() => setSelectedIds(prev => prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id])}>
                                            {selectedIds.includes(item.id) ? <CheckSquare size={18} className="text-amber-600 mx-auto"/> : <Square size={18} className="text-slate-300 mx-auto"/>}
                                        </td>
                                    )}
                                    <td className="p-4 text-sm font-bold text-blue-600">#{item.invoice_no}</td>
                                    <td className="p-4 text-sm text-slate-500 font-sans">{item.date}</td>
                                    <td className="p-4 text-sm font-bold text-slate-700 uppercase font-sans">{item.Party?.account_name}</td>
                                    <td className="p-4 text-sm font-black text-right text-slate-900 font-mono">
                                        ₹{num(item.net_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-4 text-center font-sans">
                                        <span className="text-[10px] font-black bg-amber-50 text-amber-600 px-2 py-1 rounded uppercase tracking-tighter flex items-center justify-center gap-1">
                                            <Clock size={12}/> Awaiting
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => setSelectedInvoice(item)} className="p-1.5 text-slate-300 hover:text-blue-600 transition-colors" title="View Detail"><Eye size={18}/></button>
                                            <button onClick={() => handleApprove(item.id)} className="p-1.5 text-slate-300 hover:text-emerald-600 transition-colors" title="Authorize"><UserCheck size={18}/></button>
                                            <button onClick={() => handleReject(item.id)} className="p-1.5 text-slate-300 hover:text-red-600 transition-colors" title="Reject"><Trash2 size={18}/></button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={7} className="p-24 text-center opacity-20">
                                        <CheckCircle size={64} className="mx-auto mb-2 text-emerald-500" />
                                        <p className="font-bold text-xl uppercase tracking-widest">Queue Cleared</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 bg-slate-50 border-t flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                        Pending Items: {filteredData.length} entries
                    </span>
                    <div className="flex gap-2">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="p-2 border rounded bg-white hover:bg-blue-50 disabled:opacity-30 transition-all shadow-sm">
                            <ChevronLeft size={16}/>
                        </button>
                        <div className="px-3 flex items-center text-xs font-bold text-slate-600">Page {currentPage} of {totalPages}</div>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="p-2 border rounded bg-white disabled:opacity-30 hover:bg-blue-50 transition-all shadow-sm">
                            <ChevronRight size={16}/>
                        </button>
                    </div>
                </div>
            </div>

            {/* 5. AUDIT COCKPIT MODAL */}
            {selectedInvoice && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedInvoice(null)} />
                    
                    <div className="relative bg-white w-full max-w-6xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in duration-200">
                        
                        {/* Modal Header */}
                        <div className="p-4 bg-blue-600 text-white flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-amber-500 rounded-lg shadow-lg">
                                    <ShieldCheck size={24} />
                                </div>
                                <div>
                                    <h3 className="font-black uppercase tracking-tight text-lg">Transaction Authorization Cockpit</h3>
                                    <p className="text-[10px] text-blue-100 font-bold uppercase tracking-widest">
                                        Audit REF: #{selectedInvoice.invoice_no} | {selectedInvoice.sales_type} | {selectedInvoice.pay_mode}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedInvoice(null)} className="p-2 hover:bg-blue-500 rounded-full transition-colors text-white"><X size={24}/></button>
                        </div>
                        
                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row">
                            
                            {/* LEFT SIDE: Core Document Data */}
                            <div className="flex-1 p-6 space-y-6">
                                
                                {/* 1. PARTY & LOGISTICS */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                                            <User size={14} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Billing Entity</span>
                                        </div>
                                        <h4 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{selectedInvoice.Party?.account_name}</h4>
                                        <p className="text-[11px] text-slate-500 mt-1 font-medium">{selectedInvoice.address || 'Address not linked'}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="block text-[9px] font-bold text-slate-400 uppercase">Transport</span>
                                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1"><Truck size={12}/> {selectedInvoice.Transport?.transport_name || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[9px] font-bold text-slate-400 uppercase">Vehicle No</span>
                                            <span className="text-xs font-bold text-blue-600 flex items-center gap-1 font-mono">{selectedInvoice.vehicle_no || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. SHIPPING & COMPLIANCE BAR */}
                                <div className="grid grid-cols-4 gap-4 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                                    <div>
                                        <label className="text-[9px] font-black text-blue-400 uppercase">LR Number</label>
                                        <div className="text-xs font-bold text-slate-700"># {selectedInvoice.lr_no || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-blue-400 uppercase">LR Date</label>
                                        <div className="text-xs font-bold text-slate-700">{selectedInvoice.lr_date || '-'}</div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-blue-400 uppercase">E-Way Bill</label>
                                        <div className="text-xs font-bold text-emerald-600 font-mono">{selectedInvoice.ebill_no || 'Pending'}</div>
                                    </div>
                                    {/* UPDATED: FETCHING SALES TYPE FROM HEADER */}
                                    <div>
  <label className="text-[9px] font-black text-blue-400 uppercase">
     Sales Category
  </label>
  <div className="text-xs font-bold text-slate-700 uppercase">
     {orderType}
  </div>
</div>
                                </div>

                                {/* 3. PRODUCT MATRIX */}
                                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-900 text-white text-[9px] uppercase font-bold tracking-widest">
                                            <tr>
                                                <th className="p-4">Composition SKU</th>
                                                <th className="p-4 text-center">Type</th> {/* ADDED ORDER TYPE COLUMN */}
                                                <th className="p-4 text-center">Packing</th>
                                                <th className="p-4 text-center">Net Kgs</th>
                                                <th className="p-4 text-right">Audit Rate</th>
                                                <th className="p-4 text-right">Row Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-mono">
                                            {selectedInvoice.InvoiceDetails?.map((item, idx) => (
                                                <tr key={idx} className="text-xs">
                                                    <td className="p-4">
                                                        <div className="font-bold text-slate-800 uppercase font-sans">{item.Product?.product_name}</div>
                                                        <div className="text-[10px] text-slate-400 font-sans">Mark: {item.identification_mark || '-'}</div>
                                                    </td>
                                                    {/* DISPLAYING ORDER_TYPE FROM tbl_InvoiceDetails / tbl_OrderDetails context */}
                                                    <td className="p-4 text-center">
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded ${item.order_type === 'WITH_ORDER' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                            {item.order_type === 'WITH_ORDER' ? 'ORDER' : 'DIRECT'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className="font-bold">{item.packs}</span> 
                                                        <span className="text-[10px] text-slate-400 ml-1 uppercase">{item.packing_type}</span>
                                                    </td>
                                                    <td className="p-4 text-center text-amber-600 font-black">{item.total_kgs}</td>
                                                    <td className="p-4 text-right text-slate-600 font-black">₹{item.rate}</td>
                                                    <td className="p-4 text-right font-black text-blue-600">₹{parseFloat(item.final_value).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* 4. REMARKS & TIMES */}
                                <div className="flex gap-4">
                                    <div className="flex-1 bg-amber-50 border border-amber-100 p-3 rounded-xl">
                                        <label className="text-[9px] font-black text-amber-600 uppercase flex items-center gap-1"><Info size={12}/> Preparer's Remarks</label>
                                        <p className="text-xs font-medium text-amber-900 mt-1 italic">"{selectedInvoice.remarks || 'No remarks provided.'}"</p>
                                    </div>
                                    <div className="w-48 bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-col justify-center">
                                        <label className="text-[9px] font-black text-slate-400 uppercase text-center">Removal Time</label>
                                        <div className="text-center font-bold text-slate-700 flex items-center justify-center gap-2"><Clock size={14}/> {selectedInvoice.removal_time}</div>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT SIDE: FINANCIAL SUMMARY & ACTIONS */}
                            <div className="w-full lg:w-80 bg-slate-900 text-white p-8 flex flex-col justify-between shadow-xl">
                                <div className="space-y-6">
                                    <div className="text-center border-b border-white/10 pb-4">
                                        <Calculator size={32} className="text-blue-400 mx-auto mb-2" />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue Validation</p>
                                    </div>

                                    <div className="space-y-4">
                                        <FinancialRow label="Assessable Val" value={selectedInvoice.total_assessable} />
                                        <FinancialRow label="GST (SGST+CGST)" value={selectedInvoice.total_gst} />
                                        <FinancialRow label="IGST Value" value={selectedInvoice.total_igst} />
                                        <FinancialRow label="TCS Value" value={selectedInvoice.total_tcs} />
                                        <FinancialRow label="Freight/Other" value={num(selectedInvoice.freight_charges) + num(selectedInvoice.total_other)} />
                                        <FinancialRow label="Discounts" value={selectedInvoice.total_discount} color="text-red-400" />
                                        
                                        <div className="pt-4 border-t border-white/20">
                                            <label className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Document Net Value</label>
                                            <div className="text-3xl font-black text-emerald-400 font-mono tracking-tighter">
                                                ₹ {parseFloat(selectedInvoice.net_amount).toLocaleString()}
                                            </div>
                                            <p className="text-[9px] text-slate-500 font-bold mt-1">ROUND OFF: ₹{selectedInvoice.round_off}</p>
                                        </div>

                                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 mt-6">
                                            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-4 text-center">Post-Audit Action</p>
                                            <div className="flex flex-col gap-3">
                                                <button 
                                                    onClick={() => handleApprove(selectedInvoice.id)} 
                                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-emerald-900/50 flex items-center justify-center gap-2 transition-all active:scale-95"
                                                >
                                                    <UserCheck size={16}/> Post to Ledger
                                                </button>
                                                <button 
                                                    onClick={() => handleReject(selectedInvoice.id)} 
                                                    className="w-full bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-400 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest border border-white/5 transition-all active:scale-95"
                                                >
                                                    Reject Document
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center gap-2">
                                    <Lock size={14} className="text-blue-500" />
                                    <p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em]">Auth Level: ADMIN</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
`}</style>
        </div>
    );
};

// --- HELPER COMPONENTS ---

const FinancialRow = ({ label, value, color = "text-white" }) => (
    <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{label}</span>
        <span className={`font-mono text-sm font-bold ${color}`}>₹{parseFloat(value || 0).toLocaleString()}</span>
    </div>
);

export default InvoiceApproval;