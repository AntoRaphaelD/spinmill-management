import React, { useState, useEffect, useMemo } from 'react';
import { mastersAPI } from '../service/api';
import { 
    Plus, Edit, Trash2, X, ChevronLeft, 
    ChevronRight, RefreshCw, Save, Building2, Search, Filter, 
    Square, CheckSquare, Hash, Landmark, Phone, Mail, Globe, User, CreditCard, Loader2
} from 'lucide-react';

const AccountMaster = () => {
    // --- 1. State Management ---
    const [list, setList] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    
    const [searchField, setSearchField] = useState('account_name');
    const [searchCondition, setSearchCondition] = useState('Like');
    const [searchValue, setSearchValue] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10); 

    const emptyAccount = {
        id: null, 
        account_code: '', 
        account_name: '', 
        account_group: 'DEBTORS - YARN SALES', 
        place: '', 
        // 3-Line UI States
        addr1: '', addr2: '', addr3: '',
        del1: '', del2: '', del3: '',
        pincode: '', 
        state: '',
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

    const [formData, setFormData] = useState(emptyAccount);

    // --- 2. Split/Join Logic for 3-Line Address ---
    const mapDbToUi = (item) => item;
    const mapUiToDb = (data) => data;

    // --- 3. Lifecycle & API ---
    useEffect(() => { fetchRecords(); }, []);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await mastersAPI.accounts.getAll();
            const rawData = res?.data?.data || res?.data || [];
            setList(Array.isArray(rawData) ? rawData : []);
        } catch (err) { setList([]); } finally { setLoading(false); }
    };

    const handleAddNew = () => {
        const safeList = Array.isArray(list) ? list : [];
        const maxCode = safeList.reduce((max, item) => {
            const num = parseInt(item.account_code, 10);
            return !isNaN(num) ? Math.max(max, num) : max;
        }, 0);
        setFormData({ ...emptyAccount, account_code: (maxCode + 1).toString() });
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
        if (window.confirm(`Permanently delete ${selectedIds.length} accounts?`)) {
            try {
                await Promise.all(selectedIds.map(id => mastersAPI.accounts.delete(id)));
                setSelectedIds([]);
                setIsSelectionMode(false);
                fetchRecords();
            } catch (err) { alert("Delete failed."); }
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);
        try {
            const payload = mapUiToDb(formData);
            if (formData.id) await mastersAPI.accounts.update(formData.id, payload);
            else await mastersAPI.accounts.create(payload);
            fetchRecords();
            setIsModalOpen(false);
        } catch (err) { alert("Error saving."); } finally { setSubmitLoading(false); }
    };

    // --- 4. Filtering ---
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

    return (
        <div className="min-h-screen bg-slate-100 p-6 font-sans">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Building2 className="text-blue-700" /> Account Master
                </h1>
                <div className="flex gap-2">
                    <button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-xs uppercase shadow-md transition-all"><Plus size={16} /> New Account</button>
                    <button onClick={fetchRecords} className="p-2 border border-slate-200 rounded-lg bg-white"><RefreshCw size={20} className={loading ? 'animate-spin' : ''} /></button>
                </div>
            </div>

            {/* Dynamic Search Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[180px]">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Search Field</label>
                    <select value={searchField} onChange={(e) => setSearchField(e.target.value)} className="w-full border border-slate-200 p-2 rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="account_name">Account Name</option>
                        <option value="account_code">Account Code</option>
                        <option value="place">Place</option>
                    </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Condition</label>
                    <select value={searchCondition} onChange={(e) => setSearchCondition(e.target.value)} className="w-full border p-2 rounded-xl text-[13px] outline-none">
                        <option value="Like">Like</option>
                        <option value="Equal">Equal</option>
                    </select>
                </div>
                <div className="flex-[2] min-w-[280px]">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Value</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input type="text" value={searchValue} onChange={(e) => setSearchValue(e.target.value)} className="w-full border pl-9 pr-4 py-2 rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-blue-500" placeholder="Live search..." />
                    </div>
                </div>

                {!isSelectionMode ? (
                    <button onClick={() => setIsSelectionMode(true)} className="border border-blue-200 bg-blue-50 text-blue-600 px-8 py-2 rounded-xl text-base font-bold hover:bg-blue-100 shadow-sm transition-all">Select</button>
                ) : (
                    <div className="flex gap-2 animate-in slide-in-from-right-2">
                        <button onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} className="border border-slate-200 px-6 py-2 rounded-xl text-base font-bold text-slate-600">Clear</button>
                        <button onClick={handleBulkDelete} disabled={selectedIds.length === 0} className="bg-red-500 text-white px-6 py-2 rounded-xl text-base font-bold shadow-md disabled:opacity-50">Delete ({selectedIds.length})</button>
                    </div>
                )}
            </div>

            {/* List Table */}
            {/* List Table Container */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-blue-700 text-white text-sm font-bold uppercase tracking-wider sticky top-0">
                            <tr>
                                {isSelectionMode && <th className="p-4 w-12 text-center">#</th>}
                                <th className="p-4">Account Code</th>
                                <th className="p-4">Account Name</th>
                                <th className="p-4">Sub Group</th>
                                <th className="p-4">Group</th>
                                <th className="p-4">Main</th>
                                <th className="p-4">Place</th>
                                <th className="p-4">Phone No.</th>
                                <th className="p-4">Email Id</th>
                                {!isSelectionMode && <th className="p-4 w-10"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {currentItems.length > 0 ? (
                                currentItems.map(item => (
                                    <tr key={item.id} className={`hover:bg-blue-50 transition-colors cursor-pointer ${selectedIds.includes(item.id) ? 'bg-blue-100/50' : ''}`} onClick={() => handleRowClick(item)}>
                                        {isSelectionMode && (
                                            <td className="p-4 text-center">
                                                {selectedIds.includes(item.id) ? <CheckSquare size={18} className="text-blue-600 mx-auto"/> : <Square size={18} className="text-slate-200 mx-auto"/>}
                                            </td>
                                        )}
                                        <td className="p-4 font-bold text-blue-600 font-mono">{item.account_code}</td>
                                        <td className="p-4 font-semibold text-slate-700 uppercase">{item.account_name}</td>
                                        <td className="p-4 font-bold text-amber-600 uppercase text-xs">{item.account_group}</td>
                                        <td className="p-4 font-bold text-slate-600 uppercase text-xs">{item.primary_group || '-'}</td>
                                        <td className="p-4 font-bold text-slate-500 uppercase text-xs">{item.main_group || '-'}</td>
                                        <td className="p-4 text-slate-600 uppercase">{item.place}</td>
                                        <td className="p-4 text-xs text-slate-500">{item.phone_no || '-'}</td>
                                        <td className="p-4 text-xs text-slate-500 lowercase">{item.email || '-'}</td>
                                        {!isSelectionMode && <td className="p-4 text-slate-300"><Edit size={16} /></td>}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={10} className="p-20 text-center text-slate-400 font-medium">No records found matching your search.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* --- IMPROVED PAGINATION FOOTER --- */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        {/* Page Size Selector */}
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500 font-black uppercase tracking-widest">Rows per page</span>
                            <select 
                                value={itemsPerPage}
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1); 
                                }}
                                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm cursor-pointer"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        
                        {/* Total Count Display */}
                        <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>
                        <span className="text-slate-600 font-bold text-sm">
                            Showing <span className="text-blue-700">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-blue-700">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> of <span className="text-blue-700">{filteredData.length}</span> entries
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Previous Button */}
                        <button 
                            disabled={currentPage === 1} 
                            onClick={() => setCurrentPage(p => p - 1)} 
                            className="flex items-center gap-1 px-4 py-2 border border-slate-300 rounded-lg bg-white text-sm font-bold text-slate-700 hover:bg-blue-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm"
                        >
                            <ChevronLeft size={18}/>
                            <span>Prev</span>
                        </button>

                        {/* Page Indicators */}
                        <div className="flex items-center px-4 py-2 bg-blue-600 rounded-lg shadow-inner">
                            <span className="text-white text-sm font-black uppercase">Page {currentPage} of {totalPages}</span>
                        </div>

                        {/* Next Button */}
                        <button 
                            disabled={currentPage === totalPages || totalPages === 0} 
                            onClick={() => setCurrentPage(p => p + 1)} 
                            className="flex items-center gap-1 px-4 py-2 border border-slate-300 rounded-lg bg-white text-sm font-bold text-slate-700 hover:bg-blue-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm"
                        >
                            <span>Next</span>
                            <ChevronRight size={18}/>
                        </button>
                    </div>
                </div>
            </div>
            {/* POPUP MODAL (SPLIT TWO-COLUMN WITH 3-LINE ADDRESS) */}
            {/* POPUP MODAL ENHANCEMENT */}
{isModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
    <div className="bg-white w-full max-w-[1100px] rounded-xl shadow-2xl border border-slate-500 flex flex-col max-h-[94vh]">
      
      {/* Header - smaller */}
      <div className="bg-blue-700 text-white px-5 py-3 flex justify-between items-center rounded-t-xl">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-wide">Account Master</h2>
          <p className="text-blue-100 text-xs">Create / Edit Account</p>
        </div>
        <button
          onClick={() => setIsModalOpen(false)}
          className="p-2 hover:bg-red-600 rounded transition-colors"
        >
          <X size={24} strokeWidth={3} />
        </button>
      </div>

      {/* Body - tighter padding */}
      <div className="p-5 overflow-y-auto flex-1">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-4">

            {/* LEFT COLUMN */}
            <div className="space-y-4">
              <h3 className="text-base font-bold text-blue-800 border-b pb-1 uppercase">Primary Details</h3>

              <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-right text-sm font-semibold">Code</label>
                <input readOnly className="col-span-8 p-2 bg-gray-100 border rounded text-base font-mono" value={formData.account_code} />
              </div>

              {/* <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-right text-sm font-semibold">Main Group</label>
                <select className="col-span-8 p-2 border rounded text-base" value={formData.main_group} onChange={e => setFormData({...formData, main_group: e.target.value})}>
                  <option>ASSETS</option>
                  <option>LIABILITIES</option>
                  <option>INCOME</option>
                  <option>EXPENSE</option>
                </select>
              </div> */}

              {/* <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-right text-sm font-semibold">Primary Group</label>
                <input className="col-span-8 p-2 border rounded uppercase text-base" value={formData.primary_group} onChange={e => setFormData({...formData, primary_group: e.target.value.toUpperCase()})} />
              </div> */}

              <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-right text-sm font-semibold">Account Group</label>
                <select className="col-span-8 p-2 border rounded text-base" value={formData.account_group} onChange={e => setFormData({...formData, account_group: e.target.value})}>
                  <option>DEBTORS - YARN SALES</option>
                  <option>DEBTORS - DEPOT - SALES</option>
                  <option>DEBTORS - DEPOT - PARTIES</option>
                  <option>DEBTORS - OTHERS</option>
                </select>
              </div>

              <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-right text-sm font-semibold">Account Name</label>
                <input required className="col-span-8 p-2 border-2 border-slate-600 rounded font-bold text-base uppercase" value={formData.account_name} onChange={e => setFormData({...formData, account_name: e.target.value.toUpperCase()})} />
              </div>

              <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-right text-sm font-semibold">Place</label>
                <input className="col-span-8 p-2 border rounded uppercase text-base" value={formData.place} onChange={e => setFormData({...formData, place: e.target.value.toUpperCase()})} />
              </div>

              <div className="grid grid-cols-12 gap-2 items-start">
                <label className="col-span-4 text-right text-sm font-semibold pt-1">Address</label>
                <div className="col-span-8 space-y-1.5">
                  <input className="w-full p-2 border rounded text-sm uppercase" placeholder="Line 1" value={formData.addr1} onChange={e => setFormData({...formData, addr1: e.target.value.toUpperCase()})} />
                  <input className="w-full p-2 border rounded text-sm uppercase" placeholder="Line 2" value={formData.addr2} onChange={e => setFormData({...formData, addr2: e.target.value.toUpperCase()})} />
                  <input className="w-full p-2 border rounded text-sm uppercase" placeholder="Line 3" value={formData.addr3} onChange={e => setFormData({...formData, addr3: e.target.value.toUpperCase()})} />
                </div>
              </div>

              <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-right text-sm font-semibold">Pincode </label>
                <div className="col-span-8 flex gap-2">
                  <input className="w-full p-2 border rounded text-base" placeholder="PIN" value={formData.pincode} onChange={e => setFormData({...formData, pincode: e.target.value})} />
                  {/* <input className="w-2/3 p-2 border rounded uppercase text-base" placeholder="STATE" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value.toUpperCase()})} /> */}
                </div>
              </div>
              <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-right text-sm font-semibold">State</label>
                <div className="col-span-8 flex gap-2">
                  {/* <input className="w-1/3 p-2 border rounded text-base" placeholder="PIN" value={formData.pincode} onChange={e => setFormData({...formData, pincode: e.target.value})} /> */}
                  <input className="w-full p-2 border rounded uppercase text-base" placeholder="STATE" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value.toUpperCase()})} />
                </div>
              </div>
              <div className="grid grid-cols-12 gap-2 items-start">
                <label className="col-span-4 text-right text-sm font-semibold pt-1">Delivery Address</label>
                <div className="col-span-8 space-y-1.5">
                  <input className="w-full p-2 border rounded text-sm uppercase" placeholder="Line 1" value={formData.del1} onChange={e => setFormData({...formData, del1: e.target.value.toUpperCase()})} />
                  <input className="w-full p-2 border rounded text-sm uppercase" placeholder="Line 2" value={formData.del2} onChange={e => setFormData({...formData, del2: e.target.value.toUpperCase()})} />
                  <input className="w-full p-2 border rounded text-sm uppercase" placeholder="Line 3" value={formData.del3} onChange={e => setFormData({...formData, del3: e.target.value.toUpperCase()})} />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-4">
              <h3 className="text-base font-bold text-green-800 border-b pb-1 uppercase">Contact & Tax Info</h3>


              {[
                { label: 'TIN No.', key: 'tin_no' },
                { label: 'CST No.', key: 'cst_no' },
                { label: 'Phone No.', key: 'phone_no' },
                { label: 'Email', key: 'email' },
                { label: 'Fax ', key: 'fax' },
                { label: 'Website', key: 'website' },
                { label: 'Account No.', key: 'account_no' },
                { label: 'Contact', key: 'contact_person' },
                { label: 'Cell No.', key: 'cell_no' },
                { label: 'GST No.', key: 'gst_no', important: true },
              ].map(f => (
                <div key={f.key} className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-4 text-right text-sm font-semibold">{f.label}</label>
                  <input
                    className={`col-span-8 p-2 border rounded text-base ${f.important ? 'border-blue-600 font-semibold' : ''}`}
                    value={formData[f.key]}
                    onChange={e => setFormData({...formData, [f.key]: e.target.value})}
                  />
                </div>
              ))}

              {/* Opening balances - compact */}
              <div className="bg-gray-50 p-4 rounded border grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="block text-center text-xs font-semibold text-gray-700 mb-1">Opening Credit</label>
                  <input type="number" className="w-full p-2.5 text-right border rounded text-lg font-bold" value={formData.opening_credit} onChange={e => setFormData({...formData, opening_credit: e.target.value})} />
                </div>
                <div>
                  <label className="block text-center text-xs font-semibold text-gray-700 mb-1">Opening Debit</label>
                  <input type="number" className="w-full p-2.5 text-right border rounded text-lg font-bold" value={formData.opening_debit} onChange={e => setFormData({...formData, opening_debit: e.target.value})} />
                </div>
              </div>
            </div>
          </div>

          {/* Footer - smaller buttons */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-8 py-2.5 border border-slate-600 rounded font-semibold hover:bg-slate-50 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitLoading}
              className={`px-10 py-2.5 rounded font-semibold text-white flex items-center gap-2 min-w-[140px] justify-center text-sm ${
                submitLoading ? 'bg-gray-400' : 'bg-blue-700 hover:bg-blue-800'
              }`}
            >
              {submitLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {submitLoading ? 'Saving...' : formData.id ? 'Update' : 'Save'}
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

export default AccountMaster;