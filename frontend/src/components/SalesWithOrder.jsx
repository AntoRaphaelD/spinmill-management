import React, { useState, useEffect, useMemo } from 'react';
import { mastersAPI, transactionsAPI } from '../service/api';
import { 
    Plus, Edit, Trash2, X, ChevronLeft, 
    ChevronRight, RefreshCw, Save, ShoppingCart, Search, Filter, 
    Square, CheckSquare, MinusCircle, FileSignature, Loader2    
} from 'lucide-react';

const SalesWithOrder = () => {
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
            const res = await transactionsAPI.orders.getAll();
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
            setGridRows(item.OrderDetails?.length > 0 ? item.OrderDetails.map(d => ({ ...d })) : [{ ...emptyRow }]);
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
        if (window.confirm(`Permanently delete ${selectedIds.length} orders?`)) {
            try {
                await Promise.all(selectedIds.map(id => transactionsAPI.orders.delete(id)));
                setSelectedIds([]);
                setIsSelectionMode(false);
                fetchRecords();
            } catch (err) { alert("Bulk delete failed."); }
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.party_id) return alert("Please select a Party");
        if (gridRows.every(r => !r.product_id)) return alert("At least one product row is required");
        
        setSubmitLoading(true);
        try {
            const payload = { 
                ...formData, 
                OrderDetails: gridRows.filter(r => r.product_id) 
            };
            if (formData.id) {
                await transactionsAPI.orders.update(formData.id, payload);
            } else {
                await transactionsAPI.orders.create(payload);
            }
            fetchRecords();
            setIsModalOpen(false);
        } catch (err) { 
            alert("Error saving order."); 
            console.error(err); 
        } finally { 
            setSubmitLoading(false); 
        }
    };

    const filteredData = useMemo(() => {
        let result = Array.isArray(list) ? [...list] : [];
        if (searchValue.trim()) {
            result = result.filter(item => {
                let val;
                if (searchField === 'party') {
                    val = item.Party?.account_name || '';
                } else {
                    val = item[searchField] || '';
                }
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
        <label className="text-right text-base text-black pr-3 font-semibold self-center whitespace-nowrap">
            {children}
        </label>
    );

    return (
        <div className="min-h-screen bg-slate-100 p-6 font-sans">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-black flex items-center gap-2">
                    <ShoppingCart className="text-blue-700" /> Sales Booking Master
                </h1>
                <div className="flex gap-2">
                    <button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-xs uppercase shadow-md transition-all flex items-center gap-1">
                        <Plus size={16} /> New Order
                    </button>
                    <button onClick={fetchRecords} className="p-2 border border-slate-200 rounded-lg bg-white">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[180px]">
                    <label className="text-[10px] font-bold text-black uppercase mb-1 block">Search Field</label>
                    <select value={searchField} onChange={e => setSearchField(e.target.value)} className="w-full border border-slate-200 p-2 rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="order_no">Order No</option>
                        <option value="party">Party Name</option>
                    </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="text-[10px] font-bold text-black uppercase mb-1 block">Condition</label>
                    <select value={searchCondition} onChange={e => setSearchCondition(e.target.value)} className="w-full border p-2 rounded-xl text-[13px] outline-none">
                        <option value="Like">Like</option>
                        <option value="Equal">Equal</option>
                    </select>
                </div>
                <div className="flex-[2] min-w-[280px]">
                    <label className="text-[10px] font-bold text-black uppercase mb-1 block">Value</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black" size={16} />
                        <input type="text" value={searchValue} onChange={e => setSearchValue(e.target.value)} className="w-full border pl-9 pr-4 py-2 rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-blue-500" placeholder="Live search..." />
                    </div>
                </div>

                {!isSelectionMode ? (
                    <button onClick={() => setIsSelectionMode(true)} className="border border-blue-200 bg-blue-50 text-blue-600 px-8 py-2 rounded-xl text-base font-bold hover:bg-blue-100 shadow-sm transition-all">
                        Select
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} className="border border-slate-200 px-6 py-2 rounded-xl text-base font-bold text-black hover:bg-slate-50">
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
                            <th className="p-4">Order No</th>
                            <th className="p-4">Order Date</th>
                            <th className="p-4">Party Name</th>
                            <th className="p-4">Broker</th>
                            {!isSelectionMode && <th className="p-4 w-10"></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={5} className="p-12 text-center text-black">Loading...</td></tr>
                        ) : currentItems.length > 0 ? currentItems.map(item => (
                            <tr 
                                key={item.id} 
                                className={`hover:bg-blue-50 cursor-pointer ${selectedIds.includes(item.id) ? 'bg-blue-100/50' : ''}`} 
                                onClick={() => handleRowClick(item)}
                            >
                                {isSelectionMode && (
                                    <td className="p-4 text-center">
                                        {selectedIds.includes(item.id) ? <CheckSquare size={18} className="text-blue-600 mx-auto"/> : <Square size={18} className="text-black mx-auto"/>}
                                    </td>
                                )}
                                <td className="p-4 text-base font-bold text-blue-600 font-mono">{item.order_no}</td>
                                <td className="p-4 text-base text-black">{item.date || '—'}</td>
                                <td className="p-4 text-base font-semibold text-black uppercase">{item.Party?.account_name || '—'}</td>
                                <td className="p-4 text-base text-black uppercase">{item.Broker?.broker_name || 'DIRECT'}</td>
                                {!isSelectionMode && <td className="p-4 text-black"><Edit size={16} /></td>}
                            </tr>
                        )) : (
                            <tr><td colSpan={5} className="p-12 text-center text-black">No orders found</td></tr>
                        )}
                    </tbody>
                </table>

                <div className="p-3 bg-slate-50 border-t flex items-center justify-between text-sm">
                    <span className="text-black font-medium">Page {currentPage} of {totalPages}</span>
                    <div className="flex gap-1">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1.5 border rounded bg-white disabled:opacity-40"><ChevronLeft size={16}/></button>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1.5 border rounded bg-white disabled:opacity-40"><ChevronRight size={16}/></button>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-md p-4">
    <div className="relative bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200/80 animate-in zoom-in-95 duration-200 flex flex-col max-h-[94vh]">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-5 flex justify-between items-center text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/20 rounded-lg">
            <FileSignature size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Sales Booking Master</h2>
            <p className="text-blue-100/90 text-sm font-medium mt-0.5 uppercase tracking-wide">
              {formData.id ? 'Edit Sales Order' : 'Create New Sales Order'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(false)}
          className="p-2.5 rounded-xl hover:bg-white/20 transition-all active:scale-95"
        >
          <X size={24} strokeWidth={3} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        <button
          onClick={() => setActiveTab('head')}
          className={`flex-1 py-3.5 px-6 text-base font-semibold transition-all ${
            activeTab === 'head'
              ? 'bg-white text-blue-700 border-b-4 border-blue-600 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Order Header
        </button>
        <button
          onClick={() => setActiveTab('detail')}
          className={`flex-1 py-3.5 px-6 text-base font-semibold transition-all ${
            activeTab === 'detail'
              ? 'bg-white text-blue-700 border-b-4 border-blue-600 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Order Details
        </button>
      </div>

      {/* Content */}
      <div className="p-6 overflow-y-auto flex-1 bg-slate-50/60">
        {activeTab === 'head' ? (
          <div className="space-y-5 max-w-4xl mx-auto">
            {/* Header fields - card style */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
              <div className="grid grid-cols-12 gap-5 items-center">
                <div className="col-span-3 flex justify-end">
                  <FormLabel>Order No.</FormLabel>
                </div>
                <div className="col-span-4">
                  <input
                    readOnly
                    className="w-full p-3 bg-slate-800 text-white font-mono font-bold rounded-lg border border-slate-700 cursor-not-allowed shadow-inner"
                    value={formData.order_no || 'New'}
                  />
                </div>
                <div className="col-span-5 flex items-center gap-5">
                  <FormLabel>Date</FormLabel>
                  <input
                    type="date"
                    className="p-3 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-400/30"
                    value={formData.date || ''}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 gap-5 items-center">
                <div className="col-span-3 flex justify-end">
                  <FormLabel>Party</FormLabel>
                </div>
                <div className="col-span-9">
                  <select
                    className="w-full p-3 border border-slate-300 rounded-lg uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-400/30"
                    value={formData.party_id || ''}
                    onChange={e => setFormData({ ...formData, party_id: e.target.value })}
                  >
                    <option value="">— Select Customer —</option>
                    {parties.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.account_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-5 items-center">
                <div className="col-span-3 flex justify-end">
                  <FormLabel>Broker</FormLabel>
                </div>
                <div className="col-span-5">
                  <select
                    className="w-full p-3 border border-slate-300 rounded-lg uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-400/30"
                    value={formData.broker_id || ''}
                    onChange={e => setFormData({ ...formData, broker_id: e.target.value })}
                  >
                    <option value="">— Direct / No Broker —</option>
                    {brokers.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.broker_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-4 flex items-center justify-end gap-4">
                  <input
                    type="checkbox"
                    id="cancelled"
                    checked={formData.is_cancelled}
                    onChange={e => setFormData({ ...formData, is_cancelled: e.target.checked })}
                    className="w-5 h-5 accent-red-600"
                  />
                  <label htmlFor="cancelled" className="text-base font-medium text-red-700">
                    Cancelled
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-5 items-center">
                <div className="col-span-3 flex justify-end">
                  <FormLabel>Place</FormLabel>
                </div>
                <div className="col-span-9">
                  <input
                    className="w-full p-3 border border-slate-300 rounded-lg uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-400/30"
                    value={formData.place || ''}
                    onChange={e => setFormData({ ...formData, place: e.target.value.toUpperCase() })}
                    placeholder="Delivery / Billing place"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-blue-700 text-white sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-4 text-left w-10 font-semibold">#</th>
                    <th className="p-4 text-left min-w-[340px] font-semibold">Product</th>
                    <th className="p-4 text-center w-32 font-semibold">Packing</th>
                    <th className="p-4 text-right w-32 font-semibold">Rate Cr</th>
                    <th className="p-4 text-right w-32 font-semibold">Rate Imm</th>
                    <th className="p-4 text-center w-24 font-semibold">Per</th>
                    <th className="p-4 text-right w-32 font-semibold">Qty</th>
                    <th className="p-4 text-right w-32 font-semibold">Bag Wt</th>
                    <th className="p-4 text-center w-14 font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gridRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                      <td className="p-4 text-center text-blue-600 font-bold">{idx + 1}</td>
                      <td className="p-3">
                        <select
                          value={row.product_id || ''}
                          onChange={e => updateGrid(idx, 'product_id', e.target.value)}
                          className="w-full p-2.5 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1"
                        >
                          <option value="">— Select Product —</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.product_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 text-center text-slate-700 font-medium">
                        {row.packing_type || '—'}
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          step="0.01"
                          value={row.rate_cr ?? ''}
                          onChange={e => updateGrid(idx, 'rate_cr', e.target.value)}
                          className="w-full p-2.5 text-right border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          step="0.01"
                          value={row.rate_imm ?? ''}
                          onChange={e => updateGrid(idx, 'rate_imm', e.target.value)}
                          className="w-full p-2.5 text-right border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={row.rate_per || ''}
                          onChange={e => updateGrid(idx, 'rate_per', e.target.value)}
                          className="w-full p-2.5 text-center border border-slate-300 rounded-lg uppercase focus:border-blue-500 focus:ring-1"
                          placeholder="Kg / Bag"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          value={row.qty ?? ''}
                          onChange={e => updateGrid(idx, 'qty', e.target.value)}
                          className="w-full p-2.5 text-right border border-slate-300 rounded-lg font-bold text-emerald-700 focus:border-blue-500 focus:ring-1"
                        />
                      </td>
                      <td className="p-4 text-right text-slate-700 font-medium">
                        {row.bag_wt || '0.000'}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => removeRow(idx)}
                          disabled={gridRows.length === 1}
                          className="text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors p-1 rounded hover:bg-red-50"
                        >
                          <MinusCircle size={20} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={addNewRow}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors flex items-center justify-center gap-2 shadow-md"
            >
              <Plus size={20} /> Add Product Line
            </button>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end gap-4 pt-8 border-t border-slate-200 mt-6">
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="px-8 py-3 border border-slate-400 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            Cancel
          </button>

          <button
            type="submit"
            onClick={handleSave}
            disabled={submitLoading}
            className={`
              px-10 py-3 rounded-xl font-semibold shadow-lg flex items-center gap-2 min-w-[160px] justify-center transition-all
              ${submitLoading
                ? 'bg-slate-400 text-white cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-blue-300 active:scale-[0.98]'
              }
            `}
          >
            {submitLoading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Processing...
              </>
            ) : (
              <>
                <Save size={20} />
                {formData.id ? 'Update Order' : 'Create Order'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  </div>
)}
        </div>
    );
};

export default SalesWithOrder;