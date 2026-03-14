import React, { useState, useEffect, useMemo } from 'react';
import { mastersAPI, transactionsAPI } from '../service/api';
import { 
    Plus, Edit, Trash2, X, ChevronLeft, 
    ChevronRight, RefreshCw, Save, Factory, Search, Filter, 
    Square, CheckSquare, Clock, Truck
} from 'lucide-react';

const DespatchEntry = () => {
    const [list, setList] = useState([]);
    const [transports, setTransports] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    
    const [searchField, setSearchField] = useState('vehicle_no');
    const [searchCondition, setSearchCondition] = useState('Like');
    const [searchValue, setSearchValue] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const emptyState = { 
        id: null,
        load_no: '', 
        load_date: new Date().toISOString().split('T')[0], 
        transport_id: '', 
        lr_no: '', 
        lr_date: new Date().toISOString().split('T')[0], 
        vehicle_no: '', 
        delivery: '',         
        insurance_no: '',     
        in_hh: '12', in_mm: '00', in_period: 'PM',
        out_hh: '12', out_mm: '00', out_period: 'PM',
        no_of_bags: 0, 
        freight: 0, 
        freight_per_bag: 0    
    };

    const [formData, setFormData] = useState(emptyState);

    const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
    const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

    const calculatedFreightPerBag = useMemo(() => {
        const bags = parseFloat(formData.no_of_bags) || 0;
        const total = parseFloat(formData.freight) || 0;
        return bags > 0 ? (total / bags).toFixed(2) : "0.00";
    }, [formData.no_of_bags, formData.freight]);

    useEffect(() => { 
        fetchRecords(); 
        fetchTransports(); 
    }, []);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await transactionsAPI.despatch.getAll();
            setList(res?.data?.data || []);
        } catch (err) { setList([]); } 
        finally { setLoading(false); }
    };

    const fetchTransports = async () => {
        try {
            const res = await mastersAPI.transports.getAll();
            setTransports(res?.data?.data || []);
        } catch (err) { console.error(err); }
    };

    const handleAddNew = () => {
        const nextNo = (list.length + 1).toString();
        setFormData({ ...emptyState, load_no: nextNo });
        setIsModalOpen(true);
    };

    const handleRowClick = (item) => {
        if (isSelectionMode) {
            setSelectedIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]);
        } else {
            const parseTime = (str) => {
                if (!str) return { hh: '12', mm: '00', period: 'PM' };
                const [time, period] = str.split(' ');
                const [hh, mm] = time.split(':');
                return { hh, mm, period };
            };

            const inT = parseTime(item.in_time);
            const outT = parseTime(item.out_time);

            setFormData({ 
                ...item, 
                transport_id: item.transport_id?.toString() || '',
                in_hh: inT.hh, in_mm: inT.mm, in_period: inT.period,
                out_hh: outT.hh, out_mm: outT.mm, out_period: outT.period
            });
            setIsModalOpen(true);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (window.confirm(`Permanently delete ${selectedIds.length} despatch records?`)) {
            try {
                await Promise.all(selectedIds.map(id => transactionsAPI.despatch.delete(id)));
                setSelectedIds([]);
                setIsSelectionMode(false);
                fetchRecords();
            } catch (err) { alert("Delete failed."); }
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);
        
        const finalIn = `${formData.in_hh}:${formData.in_mm} ${formData.in_period}`;
        const finalOut = `${formData.out_hh}:${formData.out_mm} ${formData.out_period}`;
        
        const payload = { 
            ...formData, 
            in_time: finalIn,
            out_time: finalOut,
            freight_per_bag: parseFloat(calculatedFreightPerBag) 
        };

        try {
            if (formData.id) await transactionsAPI.despatch.update(formData.id, payload);
            else await transactionsAPI.despatch.create(payload);
            fetchRecords();
            setIsModalOpen(false);
        } catch (err) { alert("Error saving."); } 
        finally { setSubmitLoading(false); }
    };

    const filteredData = useMemo(() => {
        let result = Array.isArray(list) ? [...list] : [];
        if (searchValue.trim()) {
            result = result.filter(item => {
                const val = item[searchField] || '';
                return String(val).toLowerCase().includes(searchValue.toLowerCase().trim());
            });
        }
        return result.sort((a, b) => b.id - a.id);
    }, [list, searchValue, searchField]);

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
                    <Truck className="text-blue-700" /> Despatch Entry Registry
                </h1>
                <div className="flex gap-2">
                    <button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-sm uppercase shadow-md transition-all flex items-center gap-1">
                        <Plus size={18} /> New Entry
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
                        <option value="vehicle_no">Vehicle No</option>
                        <option value="load_no">Load No</option>
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
                        <button onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} className="border border-slate-300 px-6 py-2.5 rounded-lg text-base font-semibold text-black hover:bg-slate-50 shadow-sm">
                            Clear
                        </button>
                        <button onClick={handleBulkDelete} disabled={selectedIds.length === 0} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg text-base font-semibold shadow-md disabled:opacity-50 flex items-center gap-2">
                            <Trash2 size={18} /> Delete ({selectedIds.length})
                        </button>
                    </div>
                )}
            </div>

            {/* Main Table – All text now BLACK */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-blue-700 border-b text-white text-base font-bold uppercase tracking-wider">
                        <tr>
                            {isSelectionMode && <th className="p-4 w-12 text-center">#</th>}
                            <th className="p-4">Load No</th>
                            <th className="p-4">Load Date</th>
                            <th className="p-4">Transport Name</th>
                            <th className="p-4 text-right pr-10">Bags</th>
                            <th className="p-4 text-right pr-10">Freight (₹)</th>
                            {!isSelectionMode && <th className="p-4 w-10"></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {loading ? (
                            <tr><td colSpan={6} className="p-12 text-center text-black font-medium text-lg">Loading despatch records...</td></tr>
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
                                <td className="p-4 text-base font-bold text-black font-mono">L-{item.load_no}</td>
                                <td className="p-4 text-base text-black">{item.load_date || '—'}</td>
                                <td className="p-4 text-base font-semibold text-black uppercase">{item.Transport?.transport_name || 'DIRECT'}</td>
                                <td className="p-4 text-right pr-10 text-base font-bold text-black">{item.no_of_bags || 0}</td>
                                <td className="p-4 text-right pr-10 text-base font-bold text-black">₹{parseFloat(item.freight || 0).toLocaleString()}</td>
                                {!isSelectionMode && <td className="p-4 text-slate-400"><Edit size={18} /></td>}
                            </tr>
                        )) : (
                            <tr><td colSpan={6} className="p-12 text-center text-black font-medium text-lg">No despatch records found</td></tr>
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
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 font-sans">
    <div className="relative bg-white w-full max-w-xl rounded-xl shadow-2xl overflow-hidden border-2 border-slate-950 animate-in zoom-in-95 duration-200 flex flex-col max-h-[94vh]">
      
      {/* Header */}
      <div className="bg-slate-950 px-6 py-4 flex justify-between items-center text-white">
        <div className="flex items-center gap-3">
          <Truck size={24} className="text-blue-400" />
          <h2 className="text-xl font-black uppercase tracking-tight">Despatch Entry</h2>
        </div>
        <button onClick={() => setIsModalOpen(false)} className="bg-red-600 p-2 rounded-lg">
          <X size={24} strokeWidth={3} />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 overflow-y-auto flex-1 bg-white">
        <form onSubmit={handleSave} className="space-y-3">
          
          {/* Load Info */}
          <div className="grid grid-cols-12 items-center gap-4">
            <label className="col-span-4 text-right text-sm font-black text-slate-950 uppercase">Load Info</label>
            <div className="col-span-8 flex gap-2">
              <input type="text" readOnly className="w-24 p-2 bg-slate-100 border border-slate-400 text-slate-950 font-black text-lg rounded text-center" value={formData.load_no || 'NEW'} />
              <input type="date" className="flex-1 p-2 border-2 border-slate-300 rounded text-lg font-black text-slate-950 outline-none focus:border-blue-600" value={formData.load_date || ''} onChange={e => setFormData({ ...formData, load_date: e.target.value })} />
            </div>
          </div>

          {/* Transport */}
          <div className="grid grid-cols-12 items-center gap-4">
            <label className="col-span-4 text-right text-sm font-black text-slate-950 uppercase">Transport</label>
            <select className="col-span-8 p-2 border-2 border-slate-300 rounded uppercase text-lg font-black text-slate-950 outline-none focus:border-blue-600" value={formData.transport_id || ''} onChange={e => setFormData({ ...formData, transport_id: e.target.value })}>
              <option value="">— SELECT AGENCY —</option>
              {transports.map(t => <option key={t.id} value={t.id}>{t.transport_name}</option>)}
            </select>
          </div>

          {/* LR Details */}
          <div className="grid grid-cols-12 items-center gap-4">
            <label className="col-span-4 text-right text-sm font-black text-slate-950 uppercase">LR No/Date</label>
            <div className="col-span-8 flex gap-2">
              <input type="text" className="flex-1 p-2 border-2 border-slate-300 rounded text-lg font-black text-slate-950 uppercase outline-none focus:border-blue-600" value={formData.lr_no || ''} onChange={e => setFormData({ ...formData, lr_no: e.target.value.toUpperCase() })} placeholder="LR NO" />
              <input type="date" className="flex-1 p-2 border-2 border-slate-300 rounded text-lg font-black text-slate-950 outline-none" value={formData.lr_date || ''} onChange={e => setFormData({ ...formData, lr_date: e.target.value })} />
            </div>
          </div>

          {/* Vehicle No */}
          <div className="grid grid-cols-12 items-center gap-4">
            <label className="col-span-4 text-right text-sm font-black text-slate-950 uppercase">Vehicle No</label>
            <input type="text" required className="col-span-8 p-2 border-2 border-slate-950 bg-white text-lg font-black text-slate-950 uppercase outline-none focus:bg-yellow-50" value={formData.vehicle_no || ''} onChange={e => setFormData({ ...formData, vehicle_no: e.target.value.toUpperCase() })} placeholder="TN 37 AB 1234" />
          </div>

          {/* Delivery */}
          <div className="grid grid-cols-12 items-center gap-4">
            <label className="col-span-4 text-right text-sm font-black text-slate-950 uppercase">Delivery To</label>
            <input type="text" className="col-span-8 p-2 border-2 border-slate-300 rounded text-lg font-black text-slate-950 uppercase outline-none" value={formData.delivery || ''} onChange={e => setFormData({ ...formData, delivery: e.target.value.toUpperCase() })} placeholder="LOCATION / PARTY" />
          </div>

          {/* Insurance */}
          <div className="grid grid-cols-12 items-center gap-4">
            <label className="col-span-4 text-right text-sm font-black text-slate-950 uppercase">Insurance</label>
            <input type="text" className="col-span-8 p-2 border-2 border-slate-300 rounded text-lg font-bold text-slate-950 outline-none" value={formData.insurance_no || ''} onChange={e => setFormData({ ...formData, insurance_no: e.target.value })} placeholder="POLICY NUMBER" />
          </div>

          {/* Time */}
          <div className="grid grid-cols-12 items-center gap-4">
            <label className="col-span-4 text-right text-sm font-black text-slate-950 uppercase">Time In/Out</label>
            <div className="col-span-8 flex items-center gap-2">
              <div className="flex bg-slate-100 border border-slate-400 p-1 rounded font-black text-slate-950">
                <select className="bg-transparent" value={formData.in_hh} onChange={e => setFormData({ ...formData, in_hh: e.target.value })}>{hours.map(h => <option key={h} value={h}>{h}</option>)}</select>
                <span>:</span>
                <select className="bg-transparent" value={formData.in_mm} onChange={e => setFormData({ ...formData, in_mm: e.target.value })}>{minutes.map(m => <option key={m} value={m}>{m}</option>)}</select>
                <select className="bg-transparent text-blue-700" value={formData.in_period} onChange={e => setFormData({ ...formData, in_period: e.target.value })}><option value="AM">AM</option><option value="PM">PM</option></select>
              </div>
              <span className="font-bold">→</span>
              <div className="flex bg-slate-100 border border-slate-400 p-1 rounded font-black text-slate-950">
                <select className="bg-transparent" value={formData.out_hh} onChange={e => setFormData({ ...formData, out_hh: e.target.value })}>{hours.map(h => <option key={h} value={h}>{h}</option>)}</select>
                <span>:</span>
                <select className="bg-transparent" value={formData.out_mm} onChange={e => setFormData({ ...formData, out_mm: e.target.value })}>{minutes.map(m => <option key={m} value={m}>{m}</option>)}</select>
                <select className="bg-transparent text-red-700" value={formData.out_period} onChange={e => setFormData({ ...formData, out_period: e.target.value })}><option value="AM">AM</option><option value="PM">PM</option></select>
              </div>
            </div>
          </div>

          {/* SEPARATE BOX FOR NO. OF BAGS */}
          <div className="grid grid-cols-12 items-center gap-4">
            <label className="col-span-4 text-right text-sm font-black text-slate-950 uppercase">No. of Bags</label>
            <div className="col-span-8">
              <input type="number" className="w-40 p-2 border-2 border-slate-400 rounded text-xl font-black text-slate-950 text-right outline-none focus:border-blue-600" value={formData.no_of_bags ?? ''} onChange={e => setFormData({ ...formData, no_of_bags: Number(e.target.value) })} placeholder="0" />
            </div>
          </div>

          {/* SEPARATE BOX FOR FREIGHT */}
          <div className="grid grid-cols-12 items-center gap-4">
            <label className="col-span-4 text-right text-sm font-black text-slate-950 uppercase">Total Freight</label>
            <div className="col-span-8">
              <input type="number" className="w-full p-2 border-2 border-slate-400 rounded text-xl font-black text-slate-950 text-right outline-none focus:border-blue-600" value={formData.freight ?? ''} onChange={e => setFormData({ ...formData, freight: Number(e.target.value) })} placeholder="ENTER AMOUNT (₹)" />
            </div>
          </div>

          {/* SEPARATE BOX FOR CALCULATION */}
          <div className="grid grid-cols-12 items-center gap-4">
            <label className="col-span-4 text-right text-sm font-black text-slate-500 uppercase">Freight Per Bag</label>
            <div className="col-span-8">
              <input type="text" readOnly className="w-40 p-2 bg-blue-50 border-2 border-blue-200 rounded text-xl font-black text-blue-700 text-right cursor-default" value={`₹ ${calculatedFreightPerBag}`} />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 border-2 border-slate-950 rounded font-black text-slate-950 uppercase">Cancel</button>
            <button type="submit" disabled={submitLoading} className={`px-12 py-2 rounded font-black text-lg shadow-lg uppercase transition-all active:scale-95 ${submitLoading ? 'bg-slate-300 text-slate-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              {submitLoading ? 'Saving...' : 'Save Record'}
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

export default DespatchEntry;