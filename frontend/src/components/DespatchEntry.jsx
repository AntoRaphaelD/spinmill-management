import React, { useState, useEffect, useMemo } from 'react';
import { mastersAPI, transactionsAPI } from '../service/api';
import { 
    Save, FileText, Truck, Calculator, 
    Warehouse, Users, Link, History, Search, 
    Plus, Trash2, X, RefreshCw,
    ChevronLeft, ChevronRight, Square, CheckSquare, 
    Edit, MapPin, Package, Clock, ShieldCheck,
    Percent, DollarSign, Info, Filter, Database, 
    Calendar, Activity, ArrowRightCircle, AlertCircle,
    Navigation, Hash, Timer, Map
} from 'lucide-react';

const DespatchEntry = () => {
    // --- Initial States (Zero deletions) ---
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
        in_time: '', 
        out_time: '', 
        no_of_bags: 0, 
        freight: 0, 
        freight_per_bag: 0    
    };

    // --- Main States ---
    const [list, setList] = useState([]);
    const [transports, setTransports] = useState([]);
    const [formData, setFormData] = useState(emptyState);
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('manifest');

    // Search & Selection
    const [searchField, setSearchField] = useState('vehicle_no');
    const [searchCondition, setSearchCondition] = useState('Like');
    const [searchValue, setSearchValue] = useState('');
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // --- Calculation Logic (Preserved) ---
    const calculatedFreightPerBag = useMemo(() => {
        const bags = parseFloat(formData.no_of_bags) || 0;
        const total = parseFloat(formData.freight) || 0;
        return bags > 0 ? (total / bags).toFixed(2) : "0.00";
    }, [formData.no_of_bags, formData.freight]);

    // --- Initialization ---
    useEffect(() => { 
        fetchRecords(); 
        fetchTransports();
    }, []);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await transactionsAPI.despatch.getAll();
            setList(res.data.data || res.data || []);
        } catch (err) { console.error("Fetch Error", err); } 
        finally { setLoading(false); }
    };

    const fetchTransports = async () => {
        try {
            const res = await mastersAPI.transports.getAll();
            setTransports(res.data.data || res.data || []);
        } catch (err) { console.error("Master Load Error", err); }
    };

    // --- Action Handlers ---
    const handleAddNew = () => {
        const nextNo = list.length > 0 ? Math.max(...list.map(i => parseInt(i.load_no) || 0)) + 1 : 1;
        setFormData({ ...emptyState, load_no: String(nextNo) });
        setActiveTab('manifest');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.vehicle_no) return alert("Vehicle Number is required");
        setSubmitLoading(true);
        const payload = {
            ...formData,
            freight_per_bag: parseFloat(calculatedFreightPerBag)
        };
        try {
            if (formData.id) await transactionsAPI.despatch.update(formData.id, payload);
            else await transactionsAPI.despatch.create(payload);
            setIsModalOpen(false);
            fetchRecords();
        } catch (err) { alert("Save failed"); }
        finally { setSubmitLoading(false); }
    };

    const handleRowClick = (item) => {
        if (isSelectionMode) {
            setSelectedIds(prev =>
                prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
            );
            return;
        }
        setFormData({ ...item, transport_id: item.transport_id?.toString() || '' });
        setActiveTab('manifest');
        setIsModalOpen(true);
    };

    // --- Dynamic Filtering Logic ---
    const filteredData = useMemo(() => {
        let result = Array.isArray(list) ? [...list] : [];
        if (searchValue.trim()) {
            result = result.filter(item => {
                let itemValue = String(item[searchField] || "").toLowerCase();
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
                        <Truck className="text-blue-600" /> Despatch Registry
                    </h1>
                    <p className="text-sm text-slate-500">Fleet manifest, load tracking and logistics control</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds([]); }}
                        className={`px-5 py-2 border rounded-lg font-semibold transition-all ${isSelectionMode ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-blue-600 hover:bg-slate-50'}`}>
                        {isSelectionMode ? 'Cancel' : 'Select'}
                    </button>
                    <button onClick={handleAddNew} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold shadow-sm transition-all active:scale-95">
                        <Plus size={18} /> New Load Registry
                    </button>
                    <button onClick={fetchRecords} className="p-2 border border-slate-200 rounded-lg bg-white text-slate-400 hover:text-blue-600 transition-colors shadow-sm">
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
                            <option value="vehicle_no">Vehicle No</option>
                            <option value="load_no">Load No</option>
                            <option value="lr_no">LR Number</option>
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
                            <input type="text" placeholder="Search manifest..." value={searchValue} onChange={(e) => setSearchValue(e.target.value)} className="w-full border border-slate-200 pl-10 pr-4 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
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
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-blue-600 text-white font-mono">
                                {isSelectionMode && <th className="p-4 w-12 text-center"><Square size={18} className="mx-auto" /></th>}
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider">Load #</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider">Date</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider">Vehicle / Agency</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider text-right">Bags</th>
                                <th className="p-4 text-sm font-semibold uppercase tracking-wider text-right">Net Freight (₹)</th>
                                {!isSelectionMode && <th className="p-4 w-10"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-24 text-center">
                                        <RefreshCw size={48} className="animate-spin text-blue-500 mx-auto mb-4" />
                                        <p className="text-slate-500 font-medium uppercase text-xs">Syncing Logistics Registry...</p>
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
                                        <td className="p-4 text-sm font-black text-blue-600">L-{item.load_no}</td>
                                        <td className="p-4 text-sm text-slate-500 font-sans">{item.load_date}</td>
                                        <td className="p-4 text-sm font-bold text-slate-700 uppercase font-sans">
                                            {item.vehicle_no}
                                            <div className="text-[10px] text-slate-400 font-normal">{item.Transport?.transport_name || 'DIRECT'}</div>
                                        </td>
                                        <td className="p-4 text-sm font-bold text-right text-slate-400">{item.no_of_bags}</td>
                                        <td className="p-4 text-sm font-black text-right text-emerald-600 font-mono">₹{parseFloat(item.freight).toLocaleString()}</td>
                                        {!isSelectionMode && <td className="p-4 text-right"><Edit size={16} className="text-slate-300" /></td>}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="py-28 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-24 h-24 bg-slate-100 rounded-3xl flex items-center justify-center mb-8 shadow-inner">
                                                {searchValue.trim() ? <Search size={56} className="text-amber-400" /> : <Truck size={56} className="text-slate-300" />}
                                            </div>
                                            <h3 className="text-2xl font-semibold text-slate-800 mb-3 tracking-tight">
                                                {searchValue.trim() ? "No matching loads" : "Logistics registry empty"}
                                            </h3>
                                            <p className="text-slate-500 max-w-md text-[15px]">Fleet manifests and vehicle despatch records will appear here.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination */}
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
                        <div className="bg-blue-600 p-4 flex justify-between items-center text-white shadow-lg shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-white/20 rounded-lg"><Navigation size={20} /></div>
                                <div>
                                    <h2 className="font-bold uppercase tracking-tight">Load Registry Deployment</h2>
                                    <p className="text-[10px] font-bold text-blue-100 uppercase">Manifest ID: #{formData.load_no}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="hover:bg-blue-500 p-1 rounded-full transition-all"><X size={24}/></button>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex bg-slate-50 border-b px-6 shrink-0">
                            <button onClick={() => setActiveTab('manifest')} className={`py-4 px-6 text-[10px] font-black uppercase tracking-widest relative transition-colors ${activeTab === 'manifest' ? 'text-blue-600' : 'text-slate-400'}`}>
                                01. Fleet & Route Details {activeTab === 'manifest' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"/>}
                            </button>
                            <button onClick={() => setActiveTab('logistics')} className={`py-4 px-6 text-[10px] font-black uppercase tracking-widest relative transition-colors ${activeTab === 'logistics' ? 'text-blue-600' : 'text-slate-400'}`}>
                                02. Logistics Tracking {activeTab === 'logistics' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"/>}
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-6 bg-slate-50/50">
                            
                            {/* LEFT SIDE: Entry Form */}
                            <div className="flex-1 space-y-6">
                                {activeTab === 'manifest' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white p-5 rounded-xl space-y-4 border shadow-sm">
                                            <div className="flex items-center gap-2 mb-2 text-slate-400"><Database size={14}/><span className="text-[9px] font-black uppercase">Technical Profile</span></div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <InputField label="Load Number" value={formData.load_no} readOnly className="font-mono text-blue-600" />
                                                <InputField label="Load Date" type="date" value={formData.load_date} onChange={e => setFormData({...formData, load_date: e.target.value})} />
                                            </div>
                                            <InputField label="Vehicle Number *" value={formData.vehicle_no} onChange={e => setFormData({...formData, vehicle_no: e.target.value.toUpperCase()})} placeholder="TN-37-BY-1234" className="text-sm font-black text-blue-700" />
                                            <InputField label="Delivery Destination" value={formData.delivery} onChange={e => setFormData({...formData, delivery: e.target.value.toUpperCase()})} placeholder="CITY / HUB NAME" />
                                        </div>

                                        <div className="bg-white p-5 rounded-xl space-y-4 border shadow-sm">
                                            <div className="flex items-center gap-2 mb-2 text-slate-400"><Timer size={14}/><span className="text-[9px] font-black uppercase">Fleet Timeline</span></div>
                                            <div className="grid grid-cols-1 gap-4">
                                                <InputField label="In Time (Arrival)" type="time" value={formData.in_time} onChange={e => setFormData({...formData, in_time: e.target.value})} />
                                                <InputField label="Out Time (Dispatch)" type="time" value={formData.out_time} onChange={e => setFormData({...formData, out_time: e.target.value})} />
                                            </div>
                                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3">
                                                <Info className="text-blue-500" size={20} />
                                                <p className="text-[10px] font-bold text-blue-700 leading-tight uppercase">Ensure precise loading times are logged for distribution efficiency tracking.</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white p-5 rounded-xl space-y-4 border shadow-sm">
                                            <div className="flex items-center gap-2 mb-2 text-slate-400"><Hash size={14}/><span className="text-[9px] font-black uppercase">Consignment Tracking</span></div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Transport Agency</label>
                                                <select value={formData.transport_id} onChange={e => setFormData({...formData, transport_id: e.target.value})} className="w-full bg-white border border-slate-200 p-2 rounded-lg text-sm font-bold shadow-inner outline-none focus:ring-1 focus:ring-blue-500">
                                                    <option value="">-- Choose Agency --</option>
                                                    {transports.map(t => <option key={t.id} value={t.id}>{t.transport_name}</option>)}
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <InputField label="LR Number" value={formData.lr_no} onChange={e => setFormData({...formData, lr_no: e.target.value.toUpperCase()})} />
                                                <InputField label="LR Date" type="date" value={formData.lr_date} onChange={e => setFormData({...formData, lr_date: e.target.value})} />
                                            </div>
                                            <InputField label="Insurance Reference" value={formData.insurance_no} onChange={e => setFormData({...formData, insurance_no: e.target.value.toUpperCase()})} />
                                        </div>

                                        <div className="bg-blue-600 rounded-2xl p-8 text-white flex flex-col justify-center items-center text-center shadow-xl relative overflow-hidden group">
                                            <ShieldCheck className="absolute -right-4 -bottom-4 text-white/10 group-hover:scale-120 transition-transform duration-700" size={140} />
                                            <ShieldCheck size={48} className="mb-4 text-blue-200" />
                                            <h3 className="text-lg font-black uppercase tracking-tight relative z-10">Consignment Secure</h3>
                                            <p className="text-xs font-bold text-blue-100 opacity-80 uppercase tracking-widest relative z-10 mt-2">Verified Transit Protocol</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* RIGHT SIDE: Financial Cockpit (Freight Metrics) */}
                            <div className="w-full lg:w-96 bg-slate-900 rounded-2xl p-6 text-white flex flex-col justify-between shadow-2xl">
                                <div className="space-y-4">
                                    <div className="text-center mb-6">
                                        <Activity size={32} className="text-blue-400 mx-auto mb-1" />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Freight Economics</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 shadow-inner">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Units (Bags)</p>
                                            <div className="flex items-baseline gap-2">
                                                <input 
                                                    type="number" 
                                                    className="bg-transparent text-3xl font-black text-white font-mono w-24 outline-none border-b border-white/10 focus:border-blue-500"
                                                    value={formData.no_of_bags}
                                                    onChange={e => setFormData({...formData, no_of_bags: e.target.value})}
                                                />
                                                <span className="text-[10px] font-bold text-slate-600 uppercase">Units</span>
                                            </div>
                                        </div>

                                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 shadow-inner">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Freight Cost</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-xs text-slate-600 font-black">₹</span>
                                                <input 
                                                    type="number" 
                                                    className="bg-transparent text-3xl font-black text-emerald-400 font-mono w-40 outline-none border-b border-white/10 focus:border-emerald-500"
                                                    value={formData.freight}
                                                    onChange={e => setFormData({...formData, freight: e.target.value})}
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-4 p-5 bg-blue-600/10 rounded-2xl border border-blue-500/20 text-center">
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Freight Per Unit (Auto)</p>
                                            <h3 className="text-2xl font-black text-white font-mono tracking-tighter">₹ {calculatedFreightPerBag}</h3>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 p-6 bg-emerald-600/10 rounded-3xl border border-emerald-500/20 text-center relative overflow-hidden group">
                                    <Map className="absolute -right-2 -bottom-2 text-white/5 group-hover:scale-110 transition-transform" size={80} />
                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 relative z-10">Route Status</p>
                                    <h3 className="text-lg font-black text-white uppercase relative z-10 truncate">{formData.delivery || 'HUB UNDEFINED'}</h3>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 bg-slate-50 border-t flex justify-end items-center gap-4 shrink-0">
                            {formData.id && (
                                <button 
                                    onClick={() => { if(window.confirm("Purge manifest registry?")) transactionsAPI.despatch.delete(formData.id).then(fetchRecords).then(() => setIsModalOpen(false)); }}
                                    className="mr-auto text-rose-500 text-[10px] font-bold uppercase tracking-widest hover:bg-rose-50 px-4 py-2 rounded-lg transition-all"
                                >
                                    Purge Record
                                </button>
                            )}
                            <button onClick={() => setIsModalOpen(false)} className="px-8 py-3 font-bold text-slate-400 hover:text-slate-600 text-xs tracking-widest uppercase transition-colors">Discard</button>
                            <button onClick={handleSave} disabled={submitLoading} className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3 rounded-xl font-black shadow-xl flex items-center gap-2 active:scale-95 transition-all text-xs tracking-widest uppercase">
                                <Save size={18}/> {submitLoading ? 'COMMITTING...' : 'COMMIT MANIFEST'}
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
        <input {...props} className="w-full bg-white border border-slate-200 p-2 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500 shadow-inner" />
    </div>
);

export default DespatchEntry;