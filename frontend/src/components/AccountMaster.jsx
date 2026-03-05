    import React, { useState, useEffect, useMemo } from 'react';
    import { mastersAPI } from '../service/api';
    import { 
        Save, Building2, Calculator, Search, 
        Plus, Trash2, X, RefreshCw,
        ChevronLeft, ChevronRight, Square, CheckSquare, 
        Edit, MapPin, Package, Clock, ShieldCheck,
        Percent, DollarSign, Info, Filter, Database, 
        Activity, ArrowRightCircle, AlertCircle,
        Phone, Mail, Globe, Landmark, Scale, FileText, 
        Layers, Smartphone, MessageSquare
    } from 'lucide-react';

    const AccountMaster = () => {
        // --- Initial States (Preserved all original fields) ---
        const emptyAccount = {
            id: null, 
            account_code: '', 
            account_name: '', 
            account_group: 'DEBTORS - OTHERS', 
            primary_group: 'DEBTORS',           
            main_group: 'ASSETS',              
            place: '', 
            address: '', 
            pincode: '', 
            state: '',
            delivery_address: '', 
            tin_no: '', 
            cst_no: '', 
            phone_no: '', 
            email: '',
            fax: '', 
            website: '', 
            account_no: '',                    
            contact_person: '', 
            cell_no: '', 
            gst_no: '',
            opening_credit: 0, 
            opening_debit: 0
        };

        // --- Main States ---
        const [list, setList] = useState([]);
        const [formData, setFormData] = useState(emptyAccount);
        const [loading, setLoading] = useState(false);
        const [submitLoading, setSubmitLoading] = useState(false);
        const [isModalOpen, setIsModalOpen] = useState(false);
        const [activeTab, setActiveTab] = useState('profile');

        // Search & Selection
        const [searchField, setSearchField] = useState('account_name');
        const [searchCondition, setSearchCondition] = useState('Like');
        const [searchValue, setSearchValue] = useState('');
        const [isSelectionMode, setIsSelectionMode] = useState(false);
        const [selectedIds, setSelectedIds] = useState([]);
        const [currentPage, setCurrentPage] = useState(1);
        const itemsPerPage = 10;

        // --- Initialization ---
        useEffect(() => {
            fetchRecords();
        }, []);

        const fetchRecords = async () => {
            setLoading(true);
            try {
                const res = await mastersAPI.accounts.getAll();
                const rawData = res?.data?.data || res?.data || [];
                setList(Array.isArray(rawData) ? rawData : []);
            } catch (err) { 
                console.error("Fetch Error", err); 
                setList([]);
            } finally { 
                setLoading(false); 
            }
        };

        // --- Action Handlers ---
        const handleAddNew = () => {
            const safeList = Array.isArray(list) ? list : [];
            const maxCode = safeList.reduce((max, item) => {
                const num = parseInt(item.account_code, 10);
                return !isNaN(num) ? Math.max(max, num) : max;
            }, 0);
            setFormData({ ...emptyAccount, account_code: (maxCode + 1).toString() });
            setActiveTab('profile');
            setIsModalOpen(true);
        };

        const handleSave = async () => {
            if (!formData.account_name) return alert("Account Name is required");
            setSubmitLoading(true);
            try {
                if (formData.id) await mastersAPI.accounts.update(formData.id, formData);
                else await mastersAPI.accounts.create(formData);
                setIsModalOpen(false);
                fetchRecords();
            } catch (err) { 
                alert("Save failed: " + (err.response?.data?.message || err.message)); 
            } finally { 
                setSubmitLoading(false); 
            }
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
            setActiveTab('profile');
            setIsModalOpen(true);
        };

        // --- Dynamic Filtering Logic ---
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
                            <Building2 className="text-blue-600" /> Account Master
                        </h1>
                        <p className="text-sm text-slate-500">Registry of Ledgers, Debtors, and Business Contacts</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds([]); }}
                            className={`px-5 py-2 border rounded-lg font-semibold transition-all ${isSelectionMode ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-blue-600 hover:bg-slate-50'}`}>
                            {isSelectionMode ? 'Cancel' : 'Select'}
                        </button>
                        <button onClick={handleAddNew} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold shadow-sm transition-all active:scale-95">
                            <Plus size={18} /> New Account
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
                                <option value="account_name">Account Name</option>
                                <option value="account_code">Account Code</option>
                                <option value="place">Place / Region</option>
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

                {/* 3. DATA TABLE - (Includes your exact columns) */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[1200px]">
                            <thead>
                                <tr className="bg-blue-600 text-white font-mono">
                                    {isSelectionMode && <th className="p-4 w-12 text-center"><Square size={18} className="mx-auto" /></th>}
                                    <th className="p-4 text-sm font-semibold uppercase tracking-wider">Code</th>
                                    <th className="p-4 text-sm font-semibold uppercase tracking-wider">Account Name</th>
                                    <th className="p-4 text-sm font-semibold uppercase tracking-wider">Sub Group</th>
                                    <th className="p-4 text-sm font-semibold uppercase tracking-wider">Group</th>
                                    <th className="p-4 text-sm font-semibold uppercase tracking-wider">Main</th>
                                    <th className="p-4 text-sm font-semibold uppercase tracking-wider">Place</th>
                                    <th className="p-4 text-sm font-semibold uppercase tracking-wider">Phone No</th>
                                    <th className="p-4 text-sm font-semibold uppercase tracking-wider">Email Address</th>
                                    {!isSelectionMode && <th className="p-4 w-10"></th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                                {loading ? (
                                    <tr>
                                        <td colSpan={10} className="py-24">
                                            <div className="flex flex-col items-center justify-center">
                                                <RefreshCw size={48} className="animate-spin text-blue-500 mb-4" />
                                                <p className="text-slate-500 font-medium">Loading ledger accounts...</p>
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
                                            <td className="p-4 text-sm font-black text-blue-600">{item.account_code}</td>
                                            <td className="p-4 text-sm font-bold text-slate-700 uppercase font-sans">
                                                {item.account_name}
                                                <div className="text-[10px] text-slate-400 font-normal">{item.gst_no || 'No GSTIN'}</div>
                                            </td>
                                            <td className="p-4 text-xs font-bold text-amber-600 uppercase font-sans">{item.account_group}</td>
                                            <td className="p-4 text-xs font-bold text-slate-500 uppercase font-sans">{item.primary_group}</td>
                                            <td className="p-4 text-xs font-bold text-slate-400 uppercase font-sans">{item.main_group}</td>
                                            <td className="p-4 text-sm font-bold text-slate-600 uppercase font-sans">
                                                <div className="flex items-center gap-1"><MapPin size={12} className="text-slate-300"/> {item.place || 'LOCAL'}</div>
                                            </td>
                                            <td className="p-4 text-xs font-bold text-slate-600">{item.phone_no || item.cell_no || 'N/A'}</td>
                                            <td className="p-4 text-xs text-slate-500 lowercase font-sans">{item.email || 'N/A'}</td>
                                            {!isSelectionMode && <td className="p-4"><Edit size={16} className="text-slate-300" /></td>}
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={10} className="py-28">
                                            <div className="flex flex-col items-center justify-center text-center">
                                                <div className="w-24 h-24 bg-slate-100 rounded-3xl flex items-center justify-center mb-8 shadow-inner">
                                                    {searchValue.trim() ? <Search size={56} className="text-amber-400" /> : <Building2 size={56} className="text-slate-300" />}
                                                </div>
                                                <h3 className="text-2xl font-semibold text-slate-800 mb-3 tracking-tight">
                                                    {searchValue.trim() ? "No matching accounts" : "Account Master is Empty"}
                                                </h3>
                                                <p className="text-slate-500 max-w-md text-[15px]">
                                                    {searchValue.trim() 
                                                        ? `We couldn't find any accounts matching "${searchValue}".`
                                                        : "Registry of business accounts and contact ledgers will appear here."
                                                    }
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination (Preserved from selection UI) */}
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
                                    <div className="p-2 bg-white/20 rounded-lg"><Building2 size={20} /></div>
                                    <div>
                                        <h2 className="font-bold uppercase tracking-tight">Account Registry Detail</h2>
                                        <p className="text-[10px] font-bold text-blue-100 uppercase">System Code: {formData.account_code}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="hover:bg-blue-500 p-1 rounded-full"><X size={24}/></button>
                            </div>

                            {/* Navigation Tabs */}
                            <div className="flex bg-slate-50 border-b px-6">
                                <button onClick={() => setActiveTab('profile')} className={`py-4 px-6 text-[10px] font-bold uppercase tracking-widest relative ${activeTab === 'profile' ? 'text-blue-600' : 'text-slate-400'}`}>
                                    01. Account Profile & Groups {activeTab === 'profile' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"/>}
                                </button>
                                <button onClick={() => setActiveTab('contact')} className={`py-4 px-6 text-[10px] font-bold uppercase tracking-widest relative ${activeTab === 'contact' ? 'text-blue-600' : 'text-slate-400'}`}>
                                    02. Communication & Address {activeTab === 'contact' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"/>}
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-6">
                                
                                {/* LEFT SIDE: Entry Form */}
                                <div className="flex-1 space-y-6">
                                    {activeTab === 'profile' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            
                                            {/* SECTION A: IDENTITY */}
                                            <div className="bg-slate-50 p-5 rounded-xl space-y-4 border">
                                                <div className="flex items-center gap-2 mb-2 text-slate-400"><Database size={14}/><span className="text-[9px] font-black uppercase">Core Identity</span></div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <InputField label="Account Code" value={formData.account_code} readOnly className="font-mono text-blue-600" />
                                                    <InputField label="GSTIN Number" value={formData.gst_no} onChange={e => setFormData({...formData, gst_no: e.target.value.toUpperCase()})} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Account Name *</label>
                                                    <input required className="w-full bg-white border border-slate-200 p-2 rounded-lg text-sm font-bold uppercase outline-none focus:ring-1 focus:ring-blue-500" value={formData.account_name} onChange={e => setFormData({...formData, account_name: e.target.value.toUpperCase()})} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Main Group</label>
                                                        <select value={formData.main_group} onChange={e => setFormData({...formData, main_group: e.target.value})} className="w-full bg-white border border-slate-200 p-2 rounded-lg text-sm font-bold">
                                                            <option value="ASSETS">ASSETS</option>
                                                            <option value="LIABILITIES">LIABILITIES</option>
                                                            <option value="INCOME">INCOME</option>
                                                            <option value="EXPENSE">EXPENSE</option>
                                                        </select>
                                                    </div>
                                                    <InputField label="Primary Group" value={formData.primary_group} onChange={e => setFormData({...formData, primary_group: e.target.value.toUpperCase()})} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Account Sub-Group</label>
                                                    <select value={formData.account_group} onChange={e => setFormData({...formData, account_group: e.target.value})} className="w-full bg-white border border-slate-200 p-2 rounded-lg text-sm font-bold">
                                                        <option value="DEBTORS - OTHERS">DEBTORS - OTHERS</option>
                                                        <option value="DEBTORS - DEPOT - SALES">DEBTORS - DEPOT - SALES</option>
                                                        <option value="DEBTOR - YARN - SALES">DEBTOR - YARN - SALES</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* SECTION B: GEOGRAPHY */}
                                            <div className="bg-slate-50 p-5 rounded-xl space-y-4 border">
                                                <div className="flex items-center gap-2 mb-2 text-slate-400"><MapPin size={14}/><span className="text-[9px] font-black uppercase">Location Metadata</span></div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <InputField label="Place / City" value={formData.place} onChange={e => setFormData({...formData, place: e.target.value.toUpperCase()})} />
                                                    <InputField label="State" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value.toUpperCase()})} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <InputField label="Pincode" value={formData.pincode} onChange={e => setFormData({...formData, pincode: e.target.value})} />
                                                    <InputField label="Website" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value.toLowerCase()})} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Billing Address</label>
                                                    <textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})} className="w-full bg-white border border-slate-200 p-2 rounded-lg text-xs font-bold h-16 outline-none focus:ring-1 focus:ring-blue-500" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Delivery / Godown Address</label>
                                                    <textarea value={formData.delivery_address} onChange={e => setFormData({...formData, delivery_address: e.target.value.toUpperCase()})} className="w-full bg-white border border-slate-200 p-2 rounded-lg text-xs font-bold h-16 outline-none focus:ring-1 focus:ring-blue-500" />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            
                                            {/* SECTION C: CONTACT DETAILS */}
                                            <div className="bg-slate-50 p-5 rounded-xl space-y-4 border">
                                                <div className="flex items-center gap-2 mb-2 text-slate-400"><Phone size={14}/><span className="text-[9px] font-black uppercase">Communication Deck</span></div>
                                                <InputField label="Contact Person" value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value.toUpperCase()})} />
                                                <div className="grid grid-cols-2 gap-4">
                                                    <InputField label="Mobile / Cell" value={formData.cell_no} onChange={e => setFormData({...formData, cell_no: e.target.value})} />
                                                    <InputField label="Office Phone" value={formData.phone_no} onChange={e => setFormData({...formData, phone_no: e.target.value})} />
                                                </div>
                                                <InputField label="Email Address" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value.toLowerCase()})} />
                                                <InputField label="Fax Number" value={formData.fax} onChange={e => setFormData({...formData, fax: e.target.value})} />
                                            </div>

                                            {/* SECTION D: STATUTORY & BANKING */}
                                            <div className="bg-slate-50 p-5 rounded-xl space-y-4 border">
                                                <div className="flex items-center gap-2 mb-2 text-slate-400"><ShieldCheck size={14}/><span className="text-[9px] font-black uppercase">Compliance & Banking</span></div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Bank Account No</label>
                                                    <div className="relative">
                                                        <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                        <input value={formData.account_no} onChange={e => setFormData({...formData, account_no: e.target.value})} className="w-full bg-white border border-slate-200 pl-10 p-2 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500 font-mono" />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <InputField label="TIN Number" value={formData.tin_no} onChange={e => setFormData({...formData, tin_no: e.target.value})} />
                                                    <InputField label="CST Number" value={formData.cst_no} onChange={e => setFormData({...formData, cst_no: e.target.value})} />
                                                </div>
                                                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-3">
                                                    <Info className="text-blue-500" size={20} />
                                                    <p className="text-[10px] font-bold text-blue-700 leading-tight">Ensure GSTIN and State match for accurate tax calculation in transactions.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* RIGHT SIDE: Financial Cockpit (Balances) */}
                                <div className="w-full lg:w-96 bg-slate-900 rounded-2xl p-6 text-white flex flex-col justify-between shadow-2xl">
                                    <div className="space-y-4">
                                        <div className="text-center mb-6">
                                            <Activity size={32} className="text-blue-400 mx-auto mb-1" />
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Opening Balances Cockpit</p>
                                        </div>

                                        <div className="space-y-6">
                                            <LedgerInput label="Opening Credit (₹)" color="text-emerald-400" value={formData.opening_credit} onChange={val => setFormData({...formData, opening_credit: val})} />
                                            <LedgerInput label="Opening Debit (₹)" color="text-rose-400" value={formData.opening_debit} onChange={val => setFormData({...formData, opening_debit: val})} />
                                        </div>
                                        
                                        <div className="pt-8 space-y-3 border-t border-white/5 mt-8">
                                            <div className="flex justify-between items-center text-xs font-bold">
                                                <span className="text-slate-500 uppercase">Effective Bal.</span>
                                                <span className={`font-mono tracking-tighter text-lg ${formData.opening_credit - formData.opening_debit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    ₹ {Math.abs(formData.opening_credit - formData.opening_debit).toLocaleString()}
                                                    <span className="text-[10px] ml-1">{formData.opening_credit - formData.opening_debit >= 0 ? 'CR' : 'DR'}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 p-6 bg-blue-600/10 rounded-3xl border border-blue-500/20 text-center relative overflow-hidden group">
                                        <Layers className="absolute -right-2 -bottom-2 text-white/5 group-hover:scale-110 transition-transform" size={80} />
                                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 relative z-10">Ledger Classification</p>
                                        <h3 className="text-xl font-black text-white uppercase relative z-10">{formData.account_group}</h3>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 bg-slate-50 border-t flex justify-end items-center gap-4">
                                {formData.id && (
                                    <button onClick={() => {if(window.confirm("Delete record?")) mastersAPI.accounts.delete(formData.id).then(() => {setIsModalOpen(false); fetchRecords();});}} className="mr-auto text-rose-500 text-[10px] font-bold uppercase tracking-widest hover:bg-rose-50 px-4 py-2 rounded-lg transition-all">
                                        Delete Record
                                    </button>
                                )}
                                <button onClick={() => setIsModalOpen(false)} className="px-8 py-3 font-bold text-slate-400 hover:text-slate-600 text-xs tracking-widest uppercase transition-colors">Discard</button>
                                <button onClick={handleSave} disabled={submitLoading} className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3 rounded-xl font-black shadow-xl flex items-center gap-2 active:scale-95 transition-all text-xs tracking-widest uppercase">
                                    <Save size={18}/> {submitLoading ? 'SAVING...' : 'FINALIZE ACCOUNT'}
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
            <input {...props} className="w-full bg-white border border-slate-200 p-2 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
    );

    const LedgerInput = ({ label, value, color = "text-white", onChange }) => (
        <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase block tracking-tighter mb-1">{label}</label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 font-bold text-xs">₹</span>
                <input type="number" step="0.01" className={`w-full bg-white/5 border border-white/10 rounded-xl p-4 pl-8 text-right text-xl font-black font-mono outline-none focus:border-blue-500 focus:bg-white/10 transition-all ${color}`} value={value} onChange={e => onChange(e.target.value)} />
            </div>
        </div>
    );

    export default AccountMaster;