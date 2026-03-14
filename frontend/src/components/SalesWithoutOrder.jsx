import React, { useState, useEffect, useMemo } from 'react';
import { mastersAPI, transactionsAPI } from '../service/api';
import { 
    Plus, Edit, Trash2, X, ChevronLeft, 
    ChevronRight, RefreshCw, Save, Zap, Search, Filter, 
    Square, CheckSquare, MinusCircle
} from 'lucide-react';

const SalesWithoutOrder = () => {
    const [list, setList] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    
    const [searchField, setSearchField] = useState('order_no');
    const [searchCondition, setSearchCondition] = useState('Like');
    const [searchValue, setSearchValue] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [activeTab, setActiveTab] = useState('head');

    const [parties, setParties] = useState([]);
    const [brokers, setBrokers] = useState([]);
    const [products, setProducts] = useState([]);

    const emptyHeader = {
        id: null,
        order_no: '',
        date: new Date().toISOString().split('T')[0],
        party_id: '',
        broker_id: '',
        place: '',
        is_cancelled: false,
        status: 'OPEN'
    };

    const emptyRow = {
        product_id: '',
        packing_type: '', 
        rate_cr: 0,          
        rate_imm: 0,      
        rate_per: 0,
        qty: 0,
        bag_wt: 0         
    };

    const [formData, setFormData] = useState(emptyHeader);
    const [gridRows, setGridRows] = useState([]);

    useEffect(() => {
        fetchMasters();
        fetchRecords();
    }, []);

    const fetchMasters = async () => {
        try {
            const [p, b, pr] = await Promise.all([
                mastersAPI.accounts.getAll(),
                mastersAPI.brokers.getAll(),
                mastersAPI.products.getAll()
            ]);
            setParties(p?.data?.data || []);
            setBrokers(b?.data?.data || []);
            setProducts(pr?.data?.data || []);
        } catch (err) { console.error(err); }
    };

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await transactionsAPI.directInvoices.getAll();
            setList(res?.data?.data || []);
        } catch (err) { setList([]); } 
        finally { setLoading(false); }
    };

    const handleAddNew = () => {
        const nextOrderNo = (list.length + 1).toString();
        setFormData({ ...emptyHeader, order_no: nextOrderNo });
        setGridRows([{ ...emptyRow }]);
        setActiveTab('head');
        setIsModalOpen(true);
    };

    const handleRowClick = (item) => {
        if (isSelectionMode) {
            setSelectedIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]);
        } else {
            setFormData({ ...item });
            setGridRows(item.DirectInvoiceDetails?.length > 0 ? item.DirectInvoiceDetails.map(d => ({ ...d })) : [{ ...emptyRow }]);
            setActiveTab('head');
            setIsModalOpen(true);
        }
    };

    const updateGrid = (index, field, value) => {
        const updated = [...gridRows];
        if (field === 'product_id') {
            const product = products.find(p => String(p.id) === String(value));
            updated[index] = {
                ...updated[index],
                product_id: value,
                packing_type: product?.packing_type || '',
                bag_wt: product?.pack_nett_wt || 0,
            };
        } else {
            updated[index][field] = value;
        }
        setGridRows(updated);
    };

    const addNewRow = () => {
        setGridRows([...gridRows, { ...emptyRow }]);
    };

    const removeRow = (index) => {
        if (gridRows.length === 1) return;
        setGridRows(gridRows.filter((_, i) => i !== index));
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (window.confirm(`Permanently delete ${selectedIds.length} bills?`)) {
            try {
                await Promise.all(selectedIds.map(id => transactionsAPI.directInvoices.delete(id)));
                setSelectedIds([]);
                setIsSelectionMode(false);
                fetchRecords();
            } catch (err) { alert("Delete failed."); }
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.party_id) return alert("Please select a Customer");
        if (gridRows.every(r => !r.product_id)) return alert("At least one product is required");
        
        setSubmitLoading(true);
        try {
            const payload = { 
                ...formData, 
                Details: gridRows.filter(r => r.product_id) 
            };
            if (formData.id) {
                await transactionsAPI.directInvoices.update(formData.id, payload);
            } else {
                await transactionsAPI.directInvoices.create(payload);
            }
            fetchRecords();
            setIsModalOpen(false);
        } catch (err) { 
            alert("Error saving bill."); 
        } finally { 
            setSubmitLoading(false); 
        }
    };

    const filteredData = useMemo(() => {
        let result = Array.isArray(list) ? [...list] : [];
        if (searchValue.trim()) {
            result = result.filter(item => {
                let val = searchField === 'party' ? (item.Party?.account_name || '') : (item[searchField] || '');
                const term = searchValue.toLowerCase().trim();
                return searchCondition === 'Equal' 
                    ? String(val).toLowerCase() === term 
                    : String(val).toLowerCase().includes(term);
            });
        }
        return result.sort((a, b) => b.id - a.id);
    }, [list, searchValue, searchField, searchCondition]);

    const currentItems = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;

    const FormLabel = ({ children }) => (
        <label className="text-right text-base text-black pr-4 font-semibold self-center whitespace-nowrap">
            {children}
        </label>
    );

    return (
        <div className="min-h-screen bg-slate-100 p-6 font-sans">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-black flex items-center gap-2">
                    <Zap className="text-blue-700" /> Direct Billing (Sales Without Order)
                </h1>
                <div className="flex gap-2">
                    <button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-sm uppercase shadow-md transition-all flex items-center gap-1">
                        <Plus size={18} /> New Bill
                    </button>
                    <button onClick={fetchRecords} className="p-2 border border-slate-300 rounded-lg bg-white">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[180px]">
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Search Field</label>
                    <select value={searchField} onChange={e => setSearchField(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-400">
                        <option value="order_no">Bill No</option>
                        <option value="party">Customer Name</option>
                    </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Condition</label>
                    <select value={searchCondition} onChange={e => setSearchCondition(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-400">
                        <option value="Like">Like</option>
                        <option value="Equal">Equal</option>
                    </select>
                </div>
                <div className="flex-[2] min-w-[280px]">
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Value</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            value={searchValue} 
                            onChange={e => setSearchValue(e.target.value)} 
                            className="w-full border border-slate-300 pl-10 pr-4 py-2.5 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-400" 
                            placeholder="Search..." 
                        />
                    </div>
                </div>

                {!isSelectionMode ? (
                    <button onClick={() => setIsSelectionMode(true)} className="border border-blue-300 bg-blue-50 text-blue-700 px-8 py-2.5 rounded-lg text-base font-semibold hover:bg-blue-100 transition-all shadow-sm">
                        Select
                    </button>
                ) : (
                    <div className="flex gap-3">
                        <button onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} className="border border-slate-300 px-6 py-2.5 rounded-lg text-base font-semibold text-slate-700 hover:bg-slate-50 shadow-sm">
                            Clear
                        </button>
                        <button onClick={handleBulkDelete} disabled={selectedIds.length === 0} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg text-base font-semibold shadow-md disabled:opacity-50 flex items-center gap-2">
                            <Trash2 size={18} /> Delete ({selectedIds.length})
                        </button>
                    </div>
                )}
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-blue-700 border-b text-white text-base font-bold uppercase tracking-wider">
                        <tr>
                            {isSelectionMode && <th className="p-4 w-12 text-center">#</th>}
                            <th className="p-4">Ref No</th>
                            <th className="p-4">Billing Date</th>
                            <th className="p-4">Customer Name</th>
                            <th className="p-4">Agent</th>
                            {!isSelectionMode && <th className="p-4 w-10"></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {loading ? (
                            <tr><td colSpan={5} className="p-12 text-center text-black font-medium">Loading bills...</td></tr>
                        ) : currentItems.length > 0 ? currentItems.map(item => (
                            <tr 
                                key={item.id} 
                                className={`hover:bg-blue-50 cursor-pointer ${selectedIds.includes(item.id) ? 'bg-blue-100/50' : ''}`} 
                                onClick={() => handleRowClick(item)}
                            >
                                {isSelectionMode && (
                                    <td className="p-4 text-center">
                                        {selectedIds.includes(item.id) ? <CheckSquare size={20} className="text-blue-600 mx-auto"/> : <Square size={20} className="text-slate-300 mx-auto"/>}
                                    </td>
                                )}
                                <td className="p-4 text-base font-bold text-black font-mono">{item.order_no}</td>
                                <td className="p-4 text-base text-black">{item.date || '—'}</td>
                                <td className="p-4 text-base font-semibold text-black uppercase">{item.Party?.account_name || '—'}</td>
                                <td className="p-4 text-base text-black uppercase">{item.Broker?.broker_name || 'DIRECT'}</td>
                                {!isSelectionMode && <td className="p-4 text-slate-400"><Edit size={18} /></td>}
                            </tr>
                        )) : (
                            <tr><td colSpan={5} className="p-12 text-center text-black font-medium">No bills found</td></tr>
                        )}
                    </tbody>
                </table>

                <div className="p-4 bg-slate-50 border-t flex items-center justify-between text-base">
                    <span className="text-black font-medium">Page {currentPage} of {totalPages}</span>
                    <div className="flex gap-2">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 border rounded bg-white disabled:opacity-50"><ChevronLeft size={20}/></button>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 border rounded bg-white disabled:opacity-50"><ChevronRight size={20}/></button>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-[#cfe2ff] w-full max-w-[1100px] rounded-xl shadow-2xl overflow-hidden border border-white animate-in zoom-in duration-200">
                        <div className="bg-[#6495ed] p-6 flex justify-between items-center text-white border-b border-white/20">
                            <div>
                                <h2 className="text-2xl font-bold tracking-wide">Direct Billing Master</h2>
                                <p className="text-blue-100 text-base mt-1">Create / Edit Sales Bill (Without Order)</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/20 p-2 rounded-full transition-colors">
                                <X size={28} />
                            </button>
                        </div>

                        <div className="flex bg-[#e8f1ff] border-b border-blue-200">
                            <button 
                                onClick={() => setActiveTab('head')} 
                                className={`flex-1 py-4 text-lg font-semibold transition-all ${activeTab === 'head' ? 'bg-[#cfe2ff] text-black border-b-4 border-blue-600' : 'text-gray-700 hover:bg-white/60'}`}
                            >
                                Bill Header
                            </button>
                            <button 
                                onClick={() => setActiveTab('detail')} 
                                className={`flex-1 py-4 text-lg font-semibold transition-all ${activeTab === 'detail' ? 'bg-[#cfe2ff] text-black border-b-4 border-blue-600' : 'text-gray-700 hover:bg-white/60'}`}
                            >
                                Items / Products
                            </button>
                        </div>

                        <div className="p-8 bg-[#cfe2ff]">
                            {activeTab === 'head' ? (
                                <div className="space-y-6 max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-md">
                                    <div className="grid grid-cols-12 items-center gap-6">
                                        <div className="col-span-3 flex justify-end"><FormLabel>Reference No.</FormLabel></div>
                                        <div className="col-span-4">
                                            <input 
                                                type="text" 
                                                readOnly 
                                                className="w-full p-3 border border-gray-400 bg-black text-white font-bold font-mono text-lg outline-none cursor-default" 
                                                value={formData.order_no} 
                                            />
                                        </div>
                                        <div className="col-span-5 flex items-center gap-6">
                                            <FormLabel>Billing Date</FormLabel>
                                            <input 
                                                type="date" 
                                                className="w-56 p-3 border border-gray-400 bg-white text-lg outline-none focus:border-blue-500 rounded" 
                                                value={formData.date} 
                                                onChange={e => setFormData({...formData, date: e.target.value})} 
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-12 items-center gap-6">
                                        <div className="col-span-3 flex justify-end"><FormLabel>Customer Name</FormLabel></div>
                                        <div className="col-span-9">
                                            <select 
                                                className="w-full p-3 border border-gray-400 bg-white uppercase text-lg outline-none focus:border-blue-500 rounded" 
                                                value={formData.party_id} 
                                                onChange={e => setFormData({...formData, party_id: e.target.value})}
                                            >
                                                <option value="">— Select Customer —</option>
                                                {parties.map(p => (
                                                    <option key={p.id} value={p.id}>{p.account_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-12 items-center gap-6">
                                        <div className="col-span-3 flex justify-end"><FormLabel>Agent / Broker</FormLabel></div>
                                        <div className="col-span-5">
                                            <select 
                                                className="w-full p-3 border border-gray-400 bg-white uppercase text-lg outline-none focus:border-blue-500 rounded" 
                                                value={formData.broker_id} 
                                                onChange={e => setFormData({...formData, broker_id: e.target.value})}
                                            >
                                                <option value="">— Direct (No Agent) —</option>
                                                {brokers.map(b => (
                                                    <option key={b.id} value={b.id}>{b.broker_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-span-4 flex items-center gap-6 justify-end">
                                            <input 
                                                type="checkbox" 
                                                id="cancelled" 
                                                checked={formData.is_cancelled} 
                                                onChange={e => setFormData({...formData, is_cancelled: e.target.checked})} 
                                                className="w-6 h-6 accent-red-600" 
                                            />
                                            <label htmlFor="cancelled" className="text-lg font-semibold text-red-700">Cancelled</label>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-12 items-center gap-6">
                                        <div className="col-span-3 flex justify-end"><FormLabel>Dispatch Place</FormLabel></div>
                                        <div className="col-span-9">
                                            <input 
                                                type="text" 
                                                className="w-full p-3 border border-gray-400 bg-white uppercase text-lg outline-none focus:border-blue-500 rounded" 
                                                value={formData.place} 
                                                onChange={e => setFormData({...formData, place: e.target.value.toUpperCase()})} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
                                    <div className="overflow-x-auto max-h-[520px]">
                                        <table className="w-full border-collapse">
                                            <thead className="bg-blue-700 text-white sticky top-0 z-10">
                                                <tr>
                                                    <th className="p-4 text-left w-12 font-bold text-base">#</th>
                                                    <th className="p-4 text-left min-w-[340px] font-bold text-base">Product / SKU</th>
                                                    <th className="p-4 text-center w-32 font-bold text-base">Packing</th>
                                                    <th className="p-4 text-right w-32 font-bold text-base">Rate (Cr)</th>
                                                    <th className="p-4 text-right w-32 font-bold text-base">Rate (Imm.)</th>
                                                    <th className="p-4 text-center w-24 font-bold text-base">Per</th>
                                                    <th className="p-4 text-right w-32 font-bold text-base">Qty (KG)</th>
                                                    <th className="p-4 text-right w-32 font-bold text-base">Bag Wt</th>
                                                    <th className="p-4 text-center w-16"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {gridRows.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-blue-50/30">
                                                        <td className="p-4 text-center text-black font-bold text-lg">{idx + 1}</td>
                                                        <td className="p-3">
                                                            <select 
                                                                value={row.product_id} 
                                                                onChange={e => updateGrid(idx, 'product_id', e.target.value)} 
                                                                className="w-full p-3 border border-gray-400 rounded text-base outline-none focus:border-blue-500"
                                                            >
                                                                <option value="">— Select Product —</option>
                                                                {products.map(p => (
                                                                    <option key={p.id} value={p.id}>{p.product_name}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="p-4 text-center text-lg font-medium text-black">
                                                            {row.packing_type || '—'}
                                                        </td>
                                                        <td className="p-3">
                                                            <input 
                                                                type="number" 
                                                                step="0.01" 
                                                                value={row.rate_cr} 
                                                                onChange={e => updateGrid(idx, 'rate_cr', e.target.value)} 
                                                                className="w-full p-3 text-right border border-gray-400 rounded text-lg focus:border-blue-500" 
                                                            />
                                                        </td>
                                                        <td className="p-3">
                                                            <input 
                                                                type="number" 
                                                                step="0.01" 
                                                                value={row.rate_imm} 
                                                                onChange={e => updateGrid(idx, 'rate_imm', e.target.value)} 
                                                                className="w-full p-3 text-right border border-gray-400 rounded text-lg focus:border-blue-500" 
                                                            />
                                                        </td>
                                                        <td className="p-3">
                                                            <input 
                                                                type="text" 
                                                                value={row.rate_per} 
                                                                onChange={e => updateGrid(idx, 'rate_per', e.target.value)} 
                                                                className="w-full p-3 text-center border border-gray-400 rounded text-lg uppercase focus:border-blue-500" 
                                                            />
                                                        </td>
                                                        <td className="p-3">
                                                            <input 
                                                                type="number" 
                                                                value={row.qty} 
                                                                onChange={e => updateGrid(idx, 'qty', e.target.value)} 
                                                                className="w-full p-3 text-right border border-gray-400 rounded text-lg font-bold text-black focus:border-blue-500" 
                                                            />
                                                        </td>
                                                        <td className="p-4 text-right text-lg font-medium text-black">
                                                            {row.bag_wt || '0.000'}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <button 
                                                                onClick={() => removeRow(idx)} 
                                                                disabled={gridRows.length === 1}
                                                                className="text-red-600 hover:text-red-800 disabled:opacity-40 transition-colors"
                                                            >
                                                                <MinusCircle size={24} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <button 
                                        onClick={addNewRow} 
                                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Plus size={20} /> Add New Item
                                    </button>
                                </div>
                            )}

                            <div className="flex justify-end gap-6 mt-10">
                                <button 
                                    type="submit" 
                                    onClick={handleSave} 
                                    disabled={submitLoading} 
                                    className="flex items-center gap-3 bg-white border-2 border-blue-600 px-12 py-3 text-lg font-bold text-blue-700 rounded-lg shadow-md hover:bg-blue-50 active:scale-95 transition-all"
                                >
                                    <Save size={20} /> {formData.id ? 'Update Bill' : 'Post Bill'}
                                </button>
                                <button 
                                    onClick={() => setIsModalOpen(false)} 
                                    className="flex items-center gap-3 bg-white border-2 border-red-600 px-12 py-3 text-lg font-bold text-red-700 rounded-lg shadow-md hover:bg-red-50 active:scale-95 transition-all"
                                >
                                    <X size={20} className="font-black" /> Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesWithoutOrder;