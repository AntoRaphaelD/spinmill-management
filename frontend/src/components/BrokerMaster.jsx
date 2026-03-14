import React, { useState, useEffect, useMemo } from 'react';
import { mastersAPI } from '../service/api';
import { 
    Plus, Edit, Trash2, X, ChevronLeft, 
    ChevronRight, RefreshCw, Save, Briefcase, Search, Filter, 
    Square, CheckSquare ,User, MapPin, Hash, Percent, Scale, Loader2 } from 'lucide-react';

const BrokerMaster = () => {
    const [list, setList] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    
    const [searchField, setSearchField] = useState('broker_name');
    const [searchCondition, setSearchCondition] = useState('Like');
    const [searchValue, setSearchValue] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const initialState = {
        id: null,
        broker_code: '',
        broker_name: '',
        address: '',
        commission_pct: 0,
        is_comm_per_kg: false
    };

    const [formData, setFormData] = useState(initialState);

    useEffect(() => { fetchRecords(); }, []);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await mastersAPI.brokers.getAll();
            const rawData = res?.data?.data || res?.data || [];
            setList(Array.isArray(rawData) ? rawData : []);
        } catch (err) { setList([]); } finally { setLoading(false); }
    };

    const filteredData = useMemo(() => {
        let result = Array.isArray(list) ? [...list] : [];
        if (searchValue.trim()) {
            result = result.filter(item => {
                const itemValue = String(item[searchField] || '').toLowerCase();
                const term = searchValue.toLowerCase().trim();
                return searchCondition === 'Equal' ? itemValue === term : itemValue.includes(term);
            });
        }
        return result.sort((a, b) => b.id - a.id);
    }, [list, searchValue, searchField, searchCondition]);

    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
    const currentItems = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleAddNew = () => {
        const safeList = Array.isArray(list) ? list : [];
        const maxCode = safeList.reduce((max, item) => {
            const num = parseInt(item.broker_code, 10);
            return !isNaN(num) ? Math.max(max, num) : max;
        }, 0);
        setFormData({ ...initialState, broker_code: (maxCode + 1).toString() });
        setIsModalOpen(true);
    };

    const handleRowClick = (item) => {
        if (isSelectionMode) {
            setSelectedIds(prev => 
                prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
            );
        } else {
            setFormData({ ...item });
            setIsModalOpen(true);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (window.confirm(`Permanently delete ${selectedIds.length} brokers?`)) {
            setLoading(true);
            try {
                await Promise.all(selectedIds.map(id => mastersAPI.brokers.delete(id)));
                setSelectedIds([]);
                setIsSelectionMode(false);
                fetchRecords();
            } catch (err) { alert("Bulk delete failed."); } finally { setLoading(false); }
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.broker_name?.trim()) return alert("Broker name is required");
        setSubmitLoading(true);
        try {
            if (formData.id) await mastersAPI.brokers.update(formData.id, formData);
            else await mastersAPI.brokers.create(formData);
            fetchRecords();
            setIsModalOpen(false);
        } catch (err) { alert("Error saving."); } finally { setSubmitLoading(false); }
    };

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
                    <Briefcase className="text-blue-700" /> Broker Master
                </h1>
                <div className="flex gap-2">
                    <button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-xs uppercase shadow-md transition-all flex items-center gap-1">
                        <Plus size={16} /> New Broker
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
                        <option value="broker_name">Broker Name</option>
                        <option value="broker_code">Broker Code</option>
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
                            <th className="p-4">Broker Code</th>
                            <th className="p-4">Broker Name</th>
                            <th className="p-4 text-right">Commission</th>
                            <th className="p-4">Address</th>
                            {!isSelectionMode && <th className="p-4 w-10"></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={6} className="p-12 text-center text-slate-400">Loading...</td></tr>
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
                                <td className="p-4 text-base font-bold text-blue-600 font-mono">{item.broker_code}</td>
                                <td className="p-4 text-base font-semibold text-slate-700 uppercase">{item.broker_name}</td>
                                <td className="p-4 text-base font-bold text-right text-emerald-700">
                                    {item.commission_pct}{item.is_comm_per_kg ? '' : '%'}
                                </td>
                                <td className="p-4 text-base text-slate-600">{item.address || '—'}</td>
                                {!isSelectionMode && <td className="p-4 text-slate-300"><Edit size={16} /></td>}
                            </tr>
                        )) : (
                            <tr><td colSpan={6} className="p-12 text-center text-slate-400 font-medium">No brokers found</td></tr>
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

            {/* Modal – font sizes matched to AccountMaster */}
            

{isModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
    <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200/80 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 flex justify-between items-center text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/15 rounded-lg">
            <Briefcase size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Broker Master</h2>
            <p className="text-blue-100/90 text-xs font-medium mt-0.5 uppercase tracking-wide">
              {formData.id ? 'Edit Broker' : 'New Broker'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(false)}
          className="p-2 rounded-lg hover:bg-white/20 transition-colors active:scale-95"
        >
          <X size={20} strokeWidth={3} />
        </button>
      </div>

      {/* Body */}
      <div className="p-6 overflow-y-auto flex-1 bg-gradient-to-b from-slate-50 to-white">
        <form onSubmit={handleSave} className="space-y-4.5">

          {/* Broker Code */}
          <div className="grid grid-cols-12 items-center gap-4">
            <label className="col-span-4 text-right text-sm font-semibold text-slate-600 uppercase tracking-wide">
              Broker Code
            </label>
            <div className="col-span-8">
              <div className="relative">
                <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  readOnly
                  className="w-40 pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-300 rounded-lg font-mono font-bold text-slate-700 cursor-not-allowed shadow-inner"
                  value={formData.broker_code}
                />
              </div>
            </div>
          </div>

          {/* Broker Name */}
          <div className="grid grid-cols-12 items-center gap-4">
            <label className="col-span-4 text-right text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Name <span className="text-red-500">*</span>
            </label>
            <div className="col-span-8 relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                required
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-slate-800 font-semibold uppercase focus:border-blue-500 focus:ring-2 focus:ring-blue-400/30 outline-none transition-all"
                value={formData.broker_name}
                onChange={e => setFormData({ ...formData, broker_name: e.target.value.toUpperCase() })}
                placeholder="Broker full name"
              />
            </div>
          </div>

          {/* Address */}
          <div className="grid grid-cols-12 gap-4">
            <label className="col-span-4 text-right pt-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Address
            </label>
            <div className="col-span-8 relative">
              <MapPin size={18} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
              <textarea
                rows={3}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-slate-700 resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/30 outline-none transition-all"
                value={formData.address || ''}
                onChange={e => setFormData({ ...formData, address: e.target.value.toUpperCase() })}
                placeholder="Street, city, pincode..."
              />
            </div>
          </div>

          {/* Commission */}
          <div className="grid grid-cols-12 items-start gap-4">
            <label className="col-span-4 text-right pt-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Commission
            </label>
            <div className="col-span-8 space-y-3">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  {formData.is_comm_per_kg ? <Scale size={18} /> : <Percent size={18} />}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-right font-bold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-400/30 outline-none transition-all"
                  value={formData.commission_pct}
                  onChange={e => setFormData({ ...formData, commission_pct: Number(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>

              <label className="flex items-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.is_comm_per_kg}
                  onChange={e => setFormData({ ...formData, is_comm_per_kg: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-slate-700">Per Kg (instead of %)</span>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-5 border-t border-slate-200 mt-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-2.5 text-slate-600 font-medium rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-2"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitLoading}
              className={`
                min-w-[140px] px-7 py-2.5 rounded-xl font-semibold shadow-md flex items-center justify-center gap-2 transition-all
                ${submitLoading
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-blue-300 active:scale-[0.98]'
                }
              `}
            >
              {submitLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  {formData.id ? 'Update' : 'Save'}
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

export default BrokerMaster;