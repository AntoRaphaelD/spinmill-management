import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { mastersAPI, transactionsAPI } from '../service/api';
import { 
    Save, FileText, Calculator, RefreshCw, X, Plus, 
    Database, MinusCircle, Box, Layers, Activity, 
    ShoppingCart, Truck, Search, Hash, Printer, 
    Warehouse, MapPin, Tag, ChevronLeft, ChevronRight
} from 'lucide-react';

// ==========================================
// HELPERS
// ==========================================
const num = (v) => isNaN(parseFloat(v)) ? 0 : parseFloat(v);
const money = (v) => num(v).toFixed(2);

const DepotSalesInvoice = () => {
    // ==========================================
    // 1. INITIAL STATES
    // ==========================================
    const emptyInvoice = {
        id: null, invoice_no: '', date: new Date().toISOString().split('T')[0],
        sales_type: 'DEPOT SALES', invoice_type_id: '', depot_id: '', party_id: '', address: '',
        credit_days: 0, interest_pct: 0, transport_id: '', lr_no: '', lr_date: new Date().toISOString().split('T')[0],
        country: '', are_no: '', vehicle_no: '', remarks: '', agent_name: '', pay_mode: 'CREDIT', form_jj: '',
        // Aggregates
        total_assessable: 0, total_charity: 0, total_vat: 0, total_cenvat: 0,
        total_duty: 0, total_cess: 0, total_hr_sec_cess: 0, total_tcs: 0,
        total_sgst: 0, total_cgst: 0, total_igst: 0, total_discount: 0, total_other: 0,
        pf_amount: 0, freight: 0, sub_total: 0, round_off: 0, final_invoice_value: 0
    };

    const [listData, setListData] = useState({
        types: [], parties: [], depots: [], transports: [], 
        products: [], orders: [], history: [], brokers: []
    });

    const [formData, setFormData] = useState(emptyInvoice);
    const [gridRows, setGridRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('head');
    // FILTER STATES (ERP style)
const [searchField, setSearchField] = useState('invoice_no');
const [searchCondition, setSearchCondition] = useState('Like');
const [searchValue, setSearchValue] = useState('');

    // ==========================================
    // 2. MATH ENGINE (Strict Model Alignment)
    // ==========================================
    const runCalculations = useCallback((rows, typeId, hFreight = formData.freight, pf = formData.pf_amount) => {
        if (!typeId) return rows;
        const config = listData.types.find(t => t.id === parseInt(typeId));
        if (!config) return rows;

        let hTotals = { 
            assess: 0, charity: 0, vat: 0, cenvat: 0, duty: 0, cess: 0, 
            hcess: 0, tcs: 0, sgst: 0, cgst: 0, igst: 0, disc: 0, other: 0, net: 0 
        };

        const updatedRows = rows.map((item) => {
            const product = listData.products.find(p => p.id === parseInt(item.product_id));
            
            // 1. [H] Base
            const H = num(item.rate) * num(item.total_kgs);
            const avgContent = num(item.packs) > 0 ? num(item.total_kgs) / num(item.packs) : 0;

            // 2. [A] Assessable
            const A = H - num(item.resale) + num(item.convert_to_hank) - (item.convert_to_cone ? num(item.rate) : 0);

            // 3. Taxes
            const charity = config.charity_checked ? num(product?.charity_rs) * num(item.total_kgs) : 0;
            const vat     = num(item.vat_per)    * A / 100;
            const sgst    = num(item.sgst_per)   * A / 100;
            const cgst    = num(item.cgst_per)   * A / 100;
            const igst    = num(item.igst_per)   * A / 100;

            // 4. Basis
            const basis = A + sgst + cgst + igst + vat + charity + num(item.other_amt) + num(item.freight_amt);
            const discAmt = num(item.discount_percentage) * basis / 100;
            const rowTotal = basis - discAmt;

            // Header accumulators
            hTotals.assess += A; hTotals.charity += charity; hTotals.vat += vat;
            hTotals.sgst += sgst; hTotals.cgst += cgst; hTotals.igst += igst; 
            hTotals.disc += discAmt; hTotals.other += num(item.other_amt); hTotals.net += rowTotal;

            return {
                ...item, avg_content: avgContent.toFixed(3), assessable_value: A, charity_amt: charity,
                vat_amt: vat, sgst_amt: sgst, cgst_amt: cgst, igst_amt: igst, discount_amt: discAmt,
                sub_total: basis, final_value: rowTotal
            };
        });

        const finalRawTotal = hTotals.net + num(hFreight) + num(pf);
        const finalNetTotal = Math.round(finalRawTotal);

        setFormData(prev => ({
            ...prev,
            total_assessable: money(hTotals.assess), total_charity: money(hTotals.charity),
            total_vat: money(hTotals.vat), total_sgst: money(hTotals.sgst), 
            total_cgst: money(hTotals.cgst), total_igst: money(hTotals.igst),
            total_discount: money(hTotals.disc), total_other: money(hTotals.other),
            sub_total: money(finalRawTotal), round_off: (finalNetTotal - finalRawTotal).toFixed(2),
            final_invoice_value: finalNetTotal
        }));

        return updatedRows;
    }, [listData.types, listData.products, formData.freight, formData.pf_amount]);

    // ==========================================
    // 3. DATA LOAD
    // ==========================================
    const init = async () => {
        setLoading(true);
        try {
            const [types, accounts, transports, products, orders, history, brokers] = await Promise.all([
                mastersAPI.invoiceTypes.getAll(), mastersAPI.accounts.getAll(), mastersAPI.transports.getAll(),
                mastersAPI.products.getAll(), transactionsAPI.orders.getAll(), 
                transactionsAPI.depotSales.getAll(), mastersAPI.brokers.getAll()
            ]);

            const accs = accounts.data?.data || [];
            const hist = history.data?.data || [];

            setListData({
                types: types.data?.data || [], 
                parties: accs.filter(a => !a.account_group?.toUpperCase().includes('DEPOT')),
                depots: accs.filter(a => a.account_group?.toUpperCase().includes('DEPOT')),
                transports: transports.data?.data || [], 
                products: products.data?.data || [],
                orders: orders.data?.data || [],
                history: hist, brokers: brokers.data?.data || []
            });
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    useEffect(() => { init(); }, []);

    // ==========================================
    // 4. HANDLERS
    // ==========================================
    const handleOrderSync = (e) => {
        const val = e.target.value; if (!val) return;
        const [source, orderNo] = val.split('|');
        const config = listData.types.find(t => t.id === parseInt(formData.invoice_type_id));
        if (!config) return alert("Select Invoice Type first.");

        const order = listData.orders.find(o => o.order_no === orderNo);
        const details = order?.OrderDetails || [];
        
        const newRows = details.map(d => ({
            order_no: orderNo, order_type: 'WITH_ORDER',
            product_id: d.product_id, product_description: d.Product?.product_name || '',
            packs: d.packs || 0, total_kgs: d.qty || 0, rate: d.rate_cr || 0, 
            rate_per: 'KG', broker_code: order.Broker?.broker_code || '', 
            packing_type: d.packing_type || 'BAGS', identification_mark: '', 
            vat_per: config.vat_percentage || 0, sgst_per: config.sgst_percentage || 0,
            cgst_per: config.cgst_percentage || 0, igst_per: config.igst_percentage || 0,
            resale: 0, convert_to_hank: 0, convert_to_cone: false, other_amt: 0, 
            freight_amt: 0, discount_percentage: 0
        }));
        setGridRows(runCalculations([...gridRows, ...newRows], formData.invoice_type_id));
        e.target.value = "";
    };

    const handleSave = async () => {
        setSubmitLoading(true);
        try {
            const payload = { ...formData, Details: gridRows };
            if (formData.id) await transactionsAPI.depotSales.update(formData.id, payload);
            else await transactionsAPI.depotSales.create(payload);
            setIsModalOpen(false); init();
        } catch (e) { alert("Save Error: Check Console"); } finally { setSubmitLoading(false); }
    };

const filteredHistory = useMemo(() => {

    const history = Array.isArray(listData.history) ? listData.history : [];
    const term = searchValue.toLowerCase().trim();

    return history.filter(item => {

        let fieldValue = '';

        switch (searchField) {

            case 'invoice_no':
                fieldValue = String(item.invoice_no || '');
                break;

            case 'date':
                fieldValue = String(item.date || '');
                break;

            case 'type':
                const typeObj = listData.types.find(t => t.id === item.invoice_type_id);
                fieldValue = typeObj?.type_name || '';
                break;

            case 'depot':
                fieldValue = item.Depot?.account_name || '';
                break;

            case 'party':
                fieldValue = item.Party?.account_name || '';
                break;

            default:
                fieldValue = '';
        }

        const value = fieldValue.toLowerCase();

        return searchCondition === 'Equal'
            ? value === term
            : value.includes(term);

    });

}, [listData.history, listData.types, searchField, searchCondition, searchValue]);

    return (
        <div className="min-h-screen bg-slate-100 p-6 font-sans">
            <div className="flex justify-between items-center mb-4">
    <h1 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
        <Warehouse className="text-blue-600"/> Depot Sales Registry
    </h1>

    <button 
        onClick={() => { 
            const nextId = (listData.history?.length || 0) + 1;

setFormData({
  ...emptyInvoice,
  invoice_no: `${nextId}`
});
            setGridRows([]); 
            setIsModalOpen(true); 
        }} 
        className="bg-blue-600 text-white px-8 py-2 rounded-xl font-bold uppercase text-xs flex items-center gap-2 shadow-lg"
    >
        <Plus size={18}/> New Depot Invoice
    </button>
</div>
{/* FILTER BAR */}
<div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm mb-6">
    <div className="grid grid-cols-5 gap-4 items-end">

        {/* FIELD */}
        <div>
            <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">
                Search Field
            </label>
            <select
                value={searchField}
                onChange={(e) => setSearchField(e.target.value)}
                className="w-full border border-slate-300 p-2 text-xs font-bold rounded"
            >
                <option value="invoice_no">Invoice No</option>
                <option value="date">Date</option>
                <option value="type">Invoice Type</option>
                <option value="depot">Depot</option>
                <option value="party">Party</option>
            </select>
        </div>

        {/* CONDITION */}
        <div>
            <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">
                Condition
            </label>
            <select
                value={searchCondition}
                onChange={(e) => setSearchCondition(e.target.value)}
                className="w-full border border-slate-300 p-2 text-xs font-bold rounded"
            >
                <option value="Like">Contains</option>
                <option value="Equal">Exact</option>
            </select>
        </div>

        {/* VALUE */}
        <div>
            <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">
                Search Value
            </label>
            <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                <input
                    placeholder="Type to search..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="pl-7 pr-3 py-2 border border-slate-300 rounded text-xs font-bold outline-none w-full"
                />
            </div>
        </div>

        {/* CLEAR */}
        <div>
            <button
                onClick={() => setSearchValue('')}
                className="w-full border border-slate-300 py-2 rounded text-xs font-bold hover:bg-slate-50"
            >
                Clear Filter
            </button>
        </div>

        {/* MATCH COUNT */}
        <div className="bg-blue-50 text-blue-700 border border-blue-200 py-2 rounded text-xs font-bold flex items-center justify-center">
            {filteredHistory.length} Matches
        </div>

    </div>
</div>

            <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-900 text-white text-[10px] uppercase font-black tracking-widest">
                        <tr>
                            <th className="p-5">Inv</th>
                            <th className="p-5">Date</th>
                            <th className="p-5">Type</th>
                            <th className="p-5">Depot (Source)</th>
                            <th className="p-5">Party (Customer)</th>
                            <th className="p-5 text-right">Net Value</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-sm font-mono">
                        {filteredHistory.map(item => {
                            const typeObj = listData.types.find(t => t.id === item.invoice_type_id);
                            return (
                                <tr key={item.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => { setFormData(item); setGridRows(item.DepotSalesDetails || []); setIsModalOpen(true); }}>
                                    <td className="p-5 font-bold text-blue-600">{item.invoice_no}</td>
                                    <td className="p-5 text-slate-500">{item.date}</td>
                                    <td className="p-5">
                                        <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-black border border-blue-200">
                                            {typeObj?.type_name || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="p-5 uppercase text-xs">{item.Depot?.account_name}</td>
                                    <td className="p-5 uppercase font-bold text-xs">{item.Party?.account_name}</td>
                                    <td className="p-5 text-right font-black">₹{parseFloat(item.final_invoice_value).toLocaleString()}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* MODAL COCKPIT */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                    <div className="bg-[#D9E5F7] rounded-lg shadow-2xl w-full max-w-[1250px] flex flex-col overflow-hidden border border-slate-400 h-[98vh]">
                        <div className="bg-[#FCD166] p-1.5 border-b border-slate-400 flex justify-between items-center">
                            <span className="text-[13px] font-bold text-slate-700 ml-2">Depot Sales Invoice Engine</span>
                            <button onClick={() => setIsModalOpen(false)} className="bg-red-500 text-white px-2 rounded font-bold">×</button>
                        </div>

                        <div className="flex bg-[#D9E5F7] pt-2 px-4 gap-1">
                            {['head', 'detail'].map(t => (
                                <button key={t} onClick={() => setActiveTab(t)} className={`px-6 py-1 text-[11px] font-bold border border-b-0 rounded-t-md ${activeTab === t ? 'bg-white text-blue-700 border-slate-400' : 'bg-[#EBF2FA] text-slate-500 border-slate-300'}`}>{t.toUpperCase()}</button>
                            ))}
                        </div>

                        <div className="flex-1 bg-white mx-4 mb-4 border border-slate-400 p-5 overflow-hidden flex flex-col">
                            {activeTab === 'head' ? (
                                <div className="grid grid-cols-12 gap-6 h-full overflow-y-auto">
                                    <div className="col-span-8 space-y-2">
                                        <div className="grid grid-cols-2 gap-4">
                                            <RowInput label="Invoice No" value={formData.invoice_no} readOnly color="bg-slate-50" />
                                            <RowInput label="Date" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                                        </div>
                                        <RowSelect label="Invoice Type" value={formData.invoice_type_id} options={listData.types.map(t => ({value:t.id, label:t.type_name}))} onChange={e => setFormData({...formData, invoice_type_id: e.target.value})} />
                                        <RowSelect label="Depot (Source)" value={formData.depot_id} options={listData.depots.map(d => ({value:d.id, label:d.account_name}))} onChange={e => setFormData({...formData, depot_id: e.target.value})} />
                                        <RowSelect label="Party (Customer)" value={formData.party_id} options={listData.parties.map(p => ({value:p.id, label:p.account_name}))} onChange={e => { const acc = listData.parties.find(a => a.id == e.target.value); setFormData({...formData, party_id: e.target.value, address: acc?.address || ''})}} />
                                        <RowInput label="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                                        
                                        <div className="grid grid-cols-3 gap-2">
                                            <RowInput label="Credit Days" type="number" value={formData.credit_days} onChange={e => setFormData({...formData, credit_days: e.target.value})} />
                                            <RowInput label="Interest %" type="number" value={formData.interest_pct} onChange={e => setFormData({...formData, interest_pct: e.target.value})} />
                                            <RowSelect label="Pay Mode" value={formData.pay_mode} options={[{value:'CREDIT', label:'CREDIT'}, {value:'CASH', label:'CASH'}]} onChange={e => setFormData({...formData, pay_mode: e.target.value})} />
                                        </div>
<RowSelect
    label="Broker"
    value={formData.broker_id}
    options={listData.brokers.map(b => ({
        value: b.id,
        label: b.broker_name
    }))}
    onChange={e => setFormData({
        ...formData,
        broker_id: e.target.value
    })}
/>
                                        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                                            <RowSelect label="Transport" value={formData.transport_id} options={listData.transports.map(t => ({value:t.id, label:t.transport_name}))} onChange={e => setFormData({...formData, transport_id: e.target.value})} />
                                            <RowInput label="Vehicle No" value={formData.vehicle_no} onChange={e => setFormData({...formData, vehicle_no: e.target.value})} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <RowInput label="LR No" value={formData.lr_no} onChange={e => setFormData({...formData, lr_no: e.target.value})} />
                                            <RowInput label="LR Date" type="date" value={formData.lr_date} onChange={e => setFormData({...formData, lr_date: e.target.value})} />
                                        </div>
                                    </div>

                                    <div className="col-span-4 bg-slate-50 border border-slate-300 p-4 rounded flex flex-col gap-1 shadow-inner">
                                        <h3 className="text-xs font-black text-blue-800 mb-2 border-b pb-1 uppercase tracking-tighter">Aggregate Value</h3>
                                        <TotalRow label="Assessable" value={formData.total_assessable} />
                                        <TotalRow label="Charity" value={formData.total_charity} />
                                        <TotalRow label="VAT Tax" value={formData.total_vat} />
                                        <TotalRow label="SGST Total" value={formData.total_sgst} />
                                        <TotalRow label="CGST Total" value={formData.total_cgst} />
                                        <TotalRow label="IGST Total" value={formData.total_igst} />
                                        <TotalRow label="Discount" value={formData.total_discount} color="text-red-600" />
                                        <TotalRow label="PF Charges" value={formData.pf_amount} isEditable onChange={v => setFormData(p => ({...p, pf_amount: v}))} />
                                        <TotalRow label="Freight" value={formData.freight} isEditable onChange={v => setFormData(p => ({...p, freight: v}))} />
                                        
                                        <div className="mt-auto pt-4 border-t-2 border-slate-400">
                                            <div className="flex justify-between items-center py-2 px-2 bg-white border border-slate-400 rounded">
                                                <span className="text-[11px] font-black uppercase">Invoice Net Value</span>
                                                <span className="text-xl font-black font-mono text-blue-700">₹ {num(formData.final_invoice_value).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 h-full flex flex-col">
                                    <div className="bg-blue-50 p-2 border border-blue-200 flex items-center justify-between rounded shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <span className="text-[10px] font-black uppercase text-blue-700">Sync Mill Order:</span>
                                            <select onChange={handleOrderSync} className="border border-slate-300 text-[11px] p-1 w-72 font-bold rounded">
                                                <option value="">-- Choose Order --</option>
                                                {listData.orders.map(o => <option key={o.id} value={`WITH|${o.order_no}`}>{o.order_no} | {o.Party?.account_name}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex-1 border border-slate-300 overflow-auto bg-slate-50 shadow-inner rounded">
                                        <table className="min-w-[4000px] text-[10px] border-collapse bg-white">
                                            <thead className="bg-slate-800 text-white sticky top-0 z-10 font-bold">
                                                <tr>
                                                    <th className="p-3 border-r w-32">Order No</th>
                                                    <th className="p-3 border-r w-80">Product Description</th>
                                                    <th className="p-3 border-r w-24">Packs</th>
                                                    <th className="p-3 border-r w-32">Packing Type</th>
                                                    <th className="p-3 border-r w-32">Total Kgs</th>
                                                    <th className="p-3 border-r w-24">Rate</th>
                                                    <th className="p-3 border-r w-40 bg-blue-900">Assess Value</th>
                                                    <th className="p-3 border-r w-32">VAT Amt</th>
                                                    <th className="p-3 border-r w-32">SGST Amt</th>
                                                    <th className="p-3 border-r w-32">CGST Amt</th>
                                                    <th className="p-3 border-r w-32">IGST Amt</th>
                                                    <th className="p-3 border-r w-32 bg-red-900">Disc Amt</th>
                                                    <th className="p-3 border-r w-40 bg-emerald-800">Final Value</th>
                                                    <th className="p-3 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {gridRows.map((r, i) => (
                                                    <tr key={i} className="hover:bg-blue-50 font-bold">
                                                        <td className="p-2 border-r text-blue-600">{r.order_no}</td>
                                                        <td className="p-2 border-r uppercase">{r.product_description}</td>
                                                        <td className="p-1 border-r text-center">{r.packs}</td>
                                                        <td className="p-1 border-r text-center">{r.packing_type}</td>
                                                        <td className="p-1 border-r"><input type="number" className="w-full text-center" value={r.total_kgs} onChange={e => {
                                                            const updated = [...gridRows];
                                                            updated[i].total_kgs = e.target.value;
                                                            setGridRows(runCalculations(updated, formData.invoice_type_id));
                                                        }} /></td>
                                                        <td className="p-1 border-r"><input type="number" className="w-full text-center" value={r.rate} onChange={e => {
                                                            const updated = [...gridRows];
                                                            updated[i].rate = e.target.value;
                                                            setGridRows(runCalculations(updated, formData.invoice_type_id));
                                                        }} /></td>
                                                        <td className="p-2 border-r text-center bg-blue-50">₹{num(r.assessable_value).toFixed(2)}</td>
                                                        <td className="p-2 border-r text-center">₹{num(r.vat_amt).toFixed(2)}</td>
                                                        <td className="p-2 border-r text-center text-blue-600">₹{num(r.sgst_amt).toFixed(2)}</td>
                                                        <td className="p-2 border-r text-center text-blue-600">₹{num(r.cgst_amt).toFixed(2)}</td>
                                                        <td className="p-2 border-r text-center text-blue-600">₹{num(r.igst_amt).toFixed(2)}</td>
                                                        <td className="p-2 border-r text-center text-red-600 bg-red-50">₹{num(r.discount_amt).toFixed(2)}</td>
                                                        <td className="p-2 border-r text-right bg-emerald-50 font-black">₹{num(r.final_value).toFixed(2)}</td>
                                                        <td className="p-2 text-center">
                                                            <button onClick={() => setGridRows(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500"><MinusCircle size={18}/></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-[#D9E5F7] p-3 border-t border-slate-400 flex justify-end gap-3 px-6 shadow-inner">
                            <button onClick={() => setIsModalOpen(false)} className="bg-white border border-slate-400 px-10 py-2 text-[11px] font-black rounded">CANCEL</button>
                            <button onClick={handleSave} disabled={submitLoading || gridRows.length === 0} className="bg-blue-600 text-white border border-blue-700 px-12 py-2 text-[11px] font-black rounded flex items-center gap-2">
                                <Save size={16}/> {submitLoading ? "SAVING..." : "COMMIT INVOICE"}
                            </button>
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

// --- ERP HELPERS ---
const RowInput = ({ label, width = "w-full", color = "bg-white", ...props }) => (
    <div className="flex items-center"><label className="w-[140px] text-[10px] font-black text-slate-700 uppercase tracking-tighter">{label}</label><input {...props} className={`border border-slate-300 p-1 px-2 text-[11px] font-bold outline-none rounded-sm shadow-sm ${width} ${color}`} /></div>
);
const RowSelect = ({ label, options, width = "w-full", ...props }) => (
    <div className="flex items-center"><label className="w-[140px] text-[10px] font-black text-slate-700 uppercase tracking-tighter">{label}</label><select {...props} className={`border border-slate-300 p-1 text-[11px] font-bold outline-none rounded-sm shadow-sm ${width}`}><option value="">-- Select --</option>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
);
const TotalRow = ({ label, value, isEditable = false, onChange, color = "text-slate-900" }) => (
    <div className="flex justify-between items-center text-[10px] py-0.5 px-2 hover:bg-white rounded transition-colors"><span className="font-black text-slate-500 uppercase tracking-tighter">{label}</span><input readOnly={!isEditable} value={value} onChange={e => onChange?.(e.target.value)} className={`w-32 border border-slate-300 text-right p-0.5 font-mono text-[11px] font-black outline-none rounded shadow-inner ${color} ${isEditable ? 'bg-white border-blue-400' : 'bg-slate-50'}`} /></div>
);

export default DepotSalesInvoice;