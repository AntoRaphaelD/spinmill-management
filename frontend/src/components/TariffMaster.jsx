import React, { useState, useEffect, useMemo } from 'react';
import { mastersAPI } from '../service/api';
import { 
    Plus, Edit, Trash2, X, ChevronLeft, 
    ChevronRight, RefreshCw, Save, BookOpen, Search, Filter, 
    Square, CheckSquare
} from 'lucide-react';

const TariffMaster = () => {
    const [list, setList] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    
    const [searchField, setSearchField] = useState('tariff_name');
    const [searchCondition, setSearchCondition] = useState('Like');
    const [searchValue, setSearchValue] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const initialState = {
        id: null,
        tariff_code: '', 
        tariff_name: '', 
        tariff_no: '', 
        product_type: 'CONE', 
        commodity: 'COTTON', 
        fibre: 'COTTON', 
        yarn_type: 'SINGLE' 
    };

    const [formData, setFormData] = useState(initialState);

    useEffect(() => { fetchRecords(); }, []);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await mastersAPI.tariffs.getAll();
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
            const num = parseInt(item.tariff_code, 10);
            return !isNaN(num) ? Math.max(max, num) : max;
        }, 0);
        setFormData({ ...initialState, tariff_code: (maxCode + 1).toString() });
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
        if (window.confirm(`Permanently delete ${selectedIds.length} records?`)) {
            setLoading(true);
            try {
                await Promise.all(selectedIds.map(id => mastersAPI.tariffs.delete(id)));
                setSelectedIds([]);
                setIsSelectionMode(false);
                fetchRecords();
            } catch (err) { alert("Bulk delete failed."); } finally { setLoading(false); }
        }
    };

    const handleDeleteSingle = async () => {
        if (!formData.id) return;
        if (window.confirm("Delete this tariff record permanently?")) {
            setSubmitLoading(true);
            try {
                await mastersAPI.tariffs.delete(formData.id);
                setIsModalOpen(false);
                fetchRecords();
            } catch (err) { alert("Delete failed."); } finally { setSubmitLoading(false); }
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);
        try {
            if (formData.id) await mastersAPI.tariffs.update(formData.id, formData);
            else await mastersAPI.tariffs.create(formData);
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
                    <BookOpen className="text-blue-700" /> Tariff Sub Head Master
                </h1>
                <div className="flex gap-2">
                    <button 
                        onClick={handleAddNew} 
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-xs uppercase shadow-md transition-all flex items-center gap-1"
                    >
                        <Plus size={16} /> New Tariff
                    </button>
                    <button 
                        onClick={fetchRecords} 
                        className="p-2 border border-slate-200 rounded-lg bg-white"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Search Bar – matched to other masters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[180px]">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Search Field</label>
                    <select 
                        value={searchField} 
                        onChange={e => setSearchField(e.target.value)} 
                        className="w-full border border-slate-200 p-2 rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-blue-500"
                    >
                        <option value="tariff_name">Tariff Name</option>
                        <option value="tariff_no">Tariff No.</option>
                        <option value="tariff_code">Code</option>
                    </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Condition</label>
                    <select 
                        value={searchCondition} 
                        onChange={e => setSearchCondition(e.target.value)} 
                        className="w-full border p-2 rounded-xl text-[13px] outline-none"
                    >
                        <option value="Like">Like</option>
                        <option value="Equal">Equal</option>
                    </select>
                </div>
                <div className="flex-[2] min-w-[280px]">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Value</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input 
                            type="text" 
                            value={searchValue} 
                            onChange={e => setSearchValue(e.target.value)} 
                            className="w-full border pl-9 pr-4 py-2 rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-blue-500" 
                            placeholder="Live search..." 
                        />
                    </div>
                </div>

                {!isSelectionMode ? (
                    <button 
                        onClick={() => setIsSelectionMode(true)} 
                        className="border border-blue-200 bg-blue-50 text-blue-600 px-8 py-2 rounded-xl text-base font-bold hover:bg-blue-100 shadow-sm transition-all"
                    >
                        Select
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button 
                            onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} 
                            className="border border-slate-200 px-6 py-2 rounded-xl text-base font-bold text-slate-600 hover:bg-slate-50"
                        >
                            Clear
                        </button>
                        <button 
                            onClick={handleBulkDelete}
                            disabled={selectedIds.length === 0}
                            className="bg-red-500 text-white px-6 py-2 rounded-xl text-base font-bold shadow-md disabled:opacity-50 flex items-center gap-1"
                        >
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
                            <th className="p-4">Tariff Code</th>
                            <th className="p-4">Tariff Name</th>
                            <th className="p-4">Tariff No.</th>
                            <th className="p-4">Yarn Type</th>
                            <th className="p-4">Product Type</th>
                            {!isSelectionMode && <th className="p-4 w-10"></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={6} className="p-12 text-center text-slate-400">Loading...</td></tr>
                        ) : currentItems.length > 0 ? (
                            currentItems.map(item => (
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
                                    <td className="p-4 text-base font-bold text-blue-600 font-mono">{item.tariff_code}</td>
                                    <td className="p-4 text-base font-semibold text-slate-700 uppercase">{item.tariff_name}</td>
                                    <td className="p-4 text-base text-slate-600 font-mono">{item.tariff_no || '—'}</td>
                                    <td className="p-4 text-base font-bold text-amber-700 uppercase">{item.yarn_type}</td>
                                    <td className="p-4 text-base font-bold text-slate-600 uppercase">{item.product_type}</td>
                                    {!isSelectionMode && <td className="p-4 text-slate-300"><Edit size={16} /></td>}
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={6} className="p-12 text-center text-slate-400">No matching tariffs found</td></tr>
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

            {/* Modal – font sizes aligned */}
           {isModalOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
        <div className="bg-white w-full max-w-[680px] rounded-xl shadow-2xl border border-slate-300 flex flex-col max-h-[90vh] overflow-hidden">
            
            {/* Header */}
            <div className="bg-blue-700 text-white px-5 py-3.5 flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold uppercase tracking-wide">Tariff Sub Head Master</h2>
                    <p className="text-blue-100 text-xs mt-0.5">Add / Modify Tariff</p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-1.5 hover:bg-red-600 rounded transition-colors"
                >
                    <X size={22} strokeWidth={3} />
                </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1">
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-12 gap-x-4 gap-y-3 text-sm">

                        {/* Tariff Code */}
                        <div className="col-span-4 flex justify-end items-center">
                            <FormLabel>Tariff Code</FormLabel>
                        </div>
                        <div className="col-span-8">
                            <input 
                                readOnly 
                                className="w-44 p-2 bg-gray-800 text-white font-bold font-mono rounded border border-gray-600 outline-none cursor-default text-sm"
                                value={formData.tariff_code} 
                            />
                        </div>

                        {/* Tariff Name */}
                        <div className="col-span-4 flex justify-end items-center">
                            <FormLabel>Tariff Name</FormLabel>
                        </div>
                        <div className="col-span-8">
                            <input 
                                required 
                                className="w-full p-2 border border-gray-400 rounded text-sm font-semibold uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-400"
                                value={formData.tariff_name} 
                                onChange={e => setFormData({...formData, tariff_name: e.target.value.toUpperCase()})} 
                            />
                        </div>

                        {/* Tariff No */}
                        <div className="col-span-4 flex justify-end items-center">
                            <FormLabel>Tariff No.</FormLabel>
                        </div>
                        <div className="col-span-8">
                            <input 
                                required 
                                className="w-full p-2 border border-gray-400 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-400"
                                value={formData.tariff_no} 
                                onChange={e => setFormData({...formData, tariff_no: e.target.value})} 
                            />
                        </div>

                        {/* Product Type */}
                        <div className="col-span-4 flex justify-end items-center">
                            <FormLabel>Product Type</FormLabel>
                        </div>
                        <div className="col-span-8">
                            <select 
                                className="w-52 p-2 border border-gray-400 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-400 bg-white"
                                value={formData.product_type} 
                                onChange={e => setFormData({...formData, product_type: e.target.value})}
                            >
                                <option value="CONE">CONE</option>
                                <option value="HANK">HANK</option>
                                <option value="CHEESE">CHEESE</option>
                            </select>
                        </div>

                        {/* Commodity */}
                        <div className="col-span-4 flex justify-end items-center">
                            <FormLabel>Commodity</FormLabel>
                        </div>
                        <div className="col-span-8">
                            <select 
                                className="w-52 p-2 border border-gray-400 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-400 bg-white"
                                value={formData.commodity} 
                                onChange={e => setFormData({...formData, commodity: e.target.value})}
                            >
                                <option value="COTTON">COTTON</option>
                                <option value="POLYESTER">POLYESTER</option>
                                <option value="VISCOSE">VISCOSE</option>
                            </select>
                        </div>

                        {/* Fibre */}
                        <div className="col-span-4 flex justify-end items-center">
                            <FormLabel>Fibre</FormLabel>
                        </div>
                        <div className="col-span-8">
                            <select 
                                className="w-52 p-2 border border-gray-400 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-400 bg-white"
                                value={formData.fibre} 
                                onChange={e => setFormData({...formData, fibre: e.target.value})}
                            >
                                <option value="COTTON">COTTON</option>
                                <option value="WASTE COTTON">WASTE COTTON</option>
                                <option value="YARN">YARN</option>
                            </select>
                        </div>

                        {/* Yarn Type */}
                        <div className="col-span-4 flex justify-end items-center">
                            <FormLabel>Yarn Type</FormLabel>
                        </div>
                        <div className="col-span-8">
                            <select 
                                className="w-52 p-2 border border-gray-400 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-400 bg-white"
                                value={formData.yarn_type} 
                                onChange={e => setFormData({...formData, yarn_type: e.target.value})}
                            >
                                <option value="SINGLE">SINGLE</option>
                                <option value="DOUBLE">DOUBLE</option>
                            </select>
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-6 border-t mt-4">
                        <div>
                            {formData.id && (
                                <button
                                    type="button"
                                    onClick={handleDeleteSingle}
                                    className="text-red-600 hover:text-red-700 text-sm font-medium underline hover:no-underline px-3 py-1.5 rounded hover:bg-red-50 transition-colors"
                                >
                                    Purge Record
                                </button>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="submit"
                                disabled={submitLoading}
                                className={`px-8 py-2 rounded text-sm font-bold flex items-center gap-2 min-w-[110px] justify-center ${
                                    submitLoading
                                        ? 'bg-gray-400 text-gray-100 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                            >
                                {submitLoading ? (
                                    <RefreshCw className="animate-spin" size={16} />
                                ) : (
                                    <Save size={16} />
                                )}
                                {submitLoading ? 'Saving...' : formData.id ? 'Update' : 'Save'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-8 py-2 border border-slate-500 rounded text-sm font-bold hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    </div>
)}
        </div>
    );
};

export default TariffMaster;