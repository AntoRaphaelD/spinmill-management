
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { mastersAPI, transactionsAPI } from '../service/api';
import {
    Save, FileText, Calculator, Plus, MinusCircle,
    Layers, Activity, Search, Hash, Printer,
    Warehouse, X, Database, CheckCircle
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { evaluate } from "mathjs";

const evaluateFormula = (formula, ctx) => {

    let processed = formula;

    Object.keys(ctx).forEach(key => {
        const regex = new RegExp(`\\[${key}\\]`, 'gi');
        processed = processed.replace(regex, ctx[key]);
    });

    processed = processed.replace(/\[.*?\]/g, '0');

    processed = processed
        .replace(/Round\(/gi, "round(")
        .replace(/Abs\(/gi, "abs(");

    return evaluate(processed);
};
// ==========================================
// HELPERS & FORMATTING
// ==========================================
const num = (v) => isNaN(parseFloat(v)) ? 0 : parseFloat(v);
const money = (v) => num(v).toFixed(2);
const numberToWords = (amount) => {
    if (!amount || amount === 0) return "Zero Rupees Only";
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const convert = (n) => {
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
        if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + convert(n % 100) : "");
        return "";
    };
    let str = "";
    const crore = Math.floor(amount / 10000000);
    const lakh = Math.floor((amount % 10000000) / 100000);
    const thousand = Math.floor((amount % 100000) / 1000);
    const hundred = amount % 1000;
    if (crore) str += convert(crore) + " Crore ";
    if (lakh) str += convert(lakh) + " Lakh ";
    if (thousand) str += convert(thousand) + " Thousand ";
    if (hundred) str += convert(hundred);
    return str.trim() + " Rupees Only";
};
const DepotSalesInvoice = () => {
    // ==========================================
    // 1. INITIAL STATES
    // ==========================================
    const emptyInvoice = {

        id: null,
        invoice_no: '',
        date: new Date().toISOString().split('T')[0],

        sales_type: 'DEPOT SALES',
        invoice_type_id: '',

        depot_id: '',
        party_id: '',
        addr1: '',
        addr2: '',
        addr3: '',

        del1: '',
        del2: '',
        del3: '',

        credit_days: 0,
        interest_pct: 0,

        transport_id: '',
        lr_no: '',
        lr_date: new Date().toISOString().split('T')[0],

        vehicle_no: '',
        remarks: '',

        broker_id: '',
        pay_mode: 'CREDIT',

        // ⭐ NEW FIELDS
        country: '',
        are_no: '',
        removal_time: '',
        agent_name: '',
        form_jj: '',

        // totals
        total_assessable: 0,
        total_charity: 0,

        total_vat: 0,
        total_cenvat: 0,
        total_duty: 0,
        total_cess: 0,
        total_hr_sec_cess: 0,

        total_sgst: 0,
        total_cgst: 0,
        total_igst: 0,
        total_tcs: 0,

        total_discount: 0,
        total_other: 0,

        pf_amount: 0,
        freight: 0,

        sub_total: 0,
        round_off: 0,
        final_invoice_value: 0
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

    const [searchField, setSearchField] = useState('invoice_no');
    const [searchCondition, setSearchCondition] = useState('Like');
    const [searchValue, setSearchValue] = useState('');
    // Add this near your other useMemo/useEffect hooks
const filteredInvoiceTypes = useMemo(() => {
    return listData.types.filter(type => {
        const typeName = (type.type_name || '').toLowerCase();
        const salesType = formData.sales_type;
        
        if (salesType === 'DEPOT SALES') {
            return typeName.includes("depot yarn sales");
        }
        
        if (salesType === 'GST SALES') {
            // Include "Yarn Sales GST" but EXCLUDE "Depot"
            return typeName.includes("yarn sales gst") && !typeName.includes("depot");
        }
        
        if (salesType === 'DIRECT SALES') {
            return typeName.includes("depot stock transfer") || 
                   typeName.includes("lab yarn sales");
        }
        
        return false;
    });
}, [listData.types, formData.sales_type]);
    useEffect(() => {

        if (!formData.invoice_type_id) return;

        setGridRows(prev =>
            runCalculations(prev, formData.invoice_type_id)
        );

    }, [formData.invoice_type_id]);
    useEffect(() => {

        if (gridRows.length === 0) return;

        setGridRows(prev =>
            runCalculations(prev, formData.invoice_type_id)
        );

    }, []);
    // ==========================================
    // 2. MATH ENGINE - FREIGHT NOW SYNCED FROM DETAILS
    // ==========================================
    const runCalculations = useCallback((rows, typeId, salesType = formData.sales_type) => {
    if (!typeId) return rows;
    const config = listData.types.find(t => t.id === parseInt(typeId));
    if (!config) return rows;

    let hTotals = {
        assess: 0, charity: 0,gst:0, vat: 0, cenvat: 0, duty: 0, cess: 0,
        hcess: 0, sgst: 0, cgst: 0, igst: 0, tcs: 0,
        disc: 0, other: 0, net: 0
    };

    const updatedRows = rows.map((item) => {
        const product = listData.products.find(p => p.id === parseInt(item.product_id));

        // ⭐ SAME LOGIC AS INVOICE PREPARATION: Recalculate Total Kgs
        const packs = num(item.packs);
        const bagWt = num(item.avg_content); // Weight per bag

        // 1. Base Math using calculated weight
        const calculatedKgs = packs * bagWt; 
        const H = num(item.rate) * calculatedKgs;
        const A = H - num(item.resale) + num(item.convert_to_hank) - num(item.convert_to_cone);
        
        // 2. Charity Logic
        let charityRate = (salesType === 'GST SALES') ? 3 : (num(config.charity_value) || num(product?.charity_rs));
        const charity = config.charity_checked ? (charityRate * calculatedKgs) : 0;
        // 3. Tax Calculations
        const taxable = A;
        const vat = (num(item.vat_per) * taxable) / 100;
        const cenvat = (num(item.cenvat_per) * taxable) / 100;
        const duty = (num(item.duty_per) * taxable) / 100;
        const cess = (num(item.cess_per) * taxable) / 100;
        const hcess = (num(item.hcess_per) * taxable) / 100;
        const gst = (num(item.gst_per) * taxable) / 100;
        const sgst = (num(item.sgst_per) * taxable) / 100;
        const cgst = (num(item.cgst_per) * taxable) / 100;
        const igst = (num(item.igst_per) * taxable) / 100;
        const tcs = (num(item.tcs_per) * taxable) / 100;

        // 4. Row Totaling
        const basis = taxable + vat + cenvat + duty + gst + cess + hcess + sgst + cgst + igst + tcs + charity + num(item.other_amt) + num(item.freight_amt);
        const discAmt = (num(item.discount_percentage) * basis) / 100;
        const rowTotal = basis - discAmt;

        hTotals.assess += A; hTotals.charity += charity;
        hTotals.vat += vat; hTotals.cenvat += cenvat; hTotals.duty += duty;
        hTotals.cess += cess; hTotals.hcess += hcess;
        hTotals.gst += gst; hTotals.sgst += sgst; hTotals.cgst += cgst; hTotals.igst += igst;
        hTotals.tcs += tcs; hTotals.disc += discAmt;
        hTotals.other += num(item.other_amt); hTotals.net += rowTotal;

        return {
            ...item,
            packs: packs,
            avg_content: bagWt,
            total_kgs: calculatedKgs, // Store the calculated result
            base_h: H, assessable_value: A, charity_amt: charity,gst_amt: gst,
            vat_amt: vat, cenvat_amt: cenvat, duty_amt: duty, cess_amt: cess,
            hcess_amt: hcess, sgst_amt: sgst, cgst_amt: cgst, igst_amt: igst, tcs_amt: tcs,
            discount_amt: discAmt, sub_total: basis, final_value: rowTotal
        };
    });

    const finalRawTotal = hTotals.net + num(formData.pf_amount);
    const finalNetTotal = Math.round(finalRawTotal);

    setFormData(prev => ({
        ...prev,
        total_assessable: money(hTotals.assess),
        total_charity: money(hTotals.charity),
        total_vat: money(hTotals.vat),
        total_cenvat: money(hTotals.cenvat),
        total_duty: money(hTotals.duty),
        total_cess: money(hTotals.cess),
        total_hr_sec_cess: money(hTotals.hcess),
        total_gst: money(hTotals.gst),
        total_sgst: money(hTotals.sgst),
        total_cgst: money(hTotals.cgst),
        total_igst: money(hTotals.igst),
        total_tcs: money(hTotals.tcs),
        total_discount: money(hTotals.disc),
        total_other: money(hTotals.other),
        sub_total: money(finalRawTotal),
        round_off: (finalNetTotal - finalRawTotal).toFixed(2),
        final_invoice_value: finalNetTotal
    }));

    return updatedRows;
}, [listData.types, listData.products, formData.pf_amount, formData.sales_type]);
    // ==========================================
    // 3. EXPORT TO PDF (now uses synced freight)
    // ==========================================
    const exportToPDF = () => {
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const data = formData;
        const rows = gridRows;
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("DEPOT SALES INVOICE", pageWidth / 2, 20, { align: "center" });
        doc.setFontSize(10);
        doc.text("KAYAAR EXPORTS PRIVATE LIMITED", margin, 35);
        doc.setFont("helvetica", "normal");
        doc.text("D.No: 43/5, Railway Feeder Road, Kovilpatti - 628503", margin, 40);
        doc.text("GSTIN: 33AAACK4468M1ZA", margin, 45);
        doc.setFont("helvetica", "bold");
        doc.text("Bill To:", margin, 60);
        doc.setFont("helvetica", "normal");
        doc.text(data.Party?.account_name || "N/A", margin, 65);
        doc.text(`${data.addr1 || ''}`, margin, 70);
        doc.text(`${data.addr2 || ''}`, margin, 75);
        doc.text(`${data.addr3 || ''}`, margin, 80);
        doc.text(`Invoice No: #${data.invoice_no}`, pageWidth - margin - 50, 60);
        doc.text(`Date: ${data.date}`, pageWidth - margin - 50, 65);
        doc.text(`Depot: ${data.Depot?.account_name || "N/A"}`, pageWidth - margin - 50, 70);
        const tableRows = rows.map(r => [
            r.product_description,
            r.packs,
            r.total_kgs,
            `Rs. ${num(r.rate).toLocaleString()}`,
            num(r.assessable_value).toLocaleString(),
            num(r.final_value).toLocaleString()
        ]);
        autoTable(doc, {
            startY: 85,
            head: [['Description of Goods', 'Packs', 'Weight', 'Rate', 'Assessable', 'Total']],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [40, 40, 40] },
            columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } }
        });
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFont("helvetica", "bold");
        doc.text("Assessable Total:", pageWidth - 90, finalY);
        doc.text(`Rs. ${num(data.total_assessable).toLocaleString()}`, pageWidth - margin, finalY, { align: "right" });

        doc.text("Tax Total (GST):", pageWidth - 90, finalY + 7);
        const gst = num(data.total_sgst) + num(data.total_cgst) + num(data.total_igst);
        doc.text(`Rs. ${gst.toLocaleString()}`, pageWidth - margin, finalY + 7, { align: "right" });
        doc.text("Freight (from details):", pageWidth - 90, finalY + 14);
        doc.text(`Rs. ${num(data.freight).toLocaleString()}`, pageWidth - margin, finalY + 14, { align: "right" });
        doc.setFontSize(14);
        doc.rect(pageWidth - 95, finalY + 22, 80, 12);
        doc.text("NET AMOUNT:", pageWidth - 90, finalY + 30);
        doc.text(`Rs. ${num(data.final_invoice_value).toLocaleString()}`, pageWidth - margin - 5, finalY + 30, { align: "right" });
        doc.setFontSize(9);
        doc.text(`In Words: ${numberToWords(num(data.final_invoice_value))}`, margin, finalY + 42);
        doc.save(`Depot_Invoice_${data.invoice_no}.pdf`);
    };
    // ==========================================
    // 4. DATA LOAD
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
            setListData({
                types: types.data?.data || [],
                parties: accs.filter(a => !a.account_group?.toUpperCase().includes('DEPOT')),
                depots: accs.filter(a => a.account_group?.toUpperCase().includes('DEPOT')),
                transports: transports.data?.data || [],
                products: products.data?.data || [],
                orders: orders.data?.data || [],
                history: history.data?.data || [], brokers: brokers.data?.data || []
            });
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    useEffect(() => { init(); }, []);
    // ==========================================
    // 5. HANDLERS
    // ==========================================
    const handleOrderSync = (e) => {

        const val = e.target.value;
        if (!val) return;

        const [source, orderNo] = val.split('|');

        const config = listData.types.find(
            t => t.id === parseInt(formData.invoice_type_id)
        );

        if (!config) {
            alert("Select Invoice Type first.");
            return;
        }

        const order = listData.orders.find(
            o => o.order_no === orderNo
        );

        if (!order) return;

        const details = order?.OrderDetails || [];

        // 🔵 AUTO FILL HEADER
        const party = order.Party || {};
        const broker = order.Broker || {};

        setFormData(prev => ({
            ...prev,

            party_id: party.id || '',
            broker_id: broker.id || '',
            addr1: party.addr1 || '',
            addr2: party.addr2 || '',
            addr3: party.addr3 || '',

            header_locked: true

        }));

        // 🔵 CREATE GRID ROWS
        const newRows = details.map(d => {
    const packs = d.packs || d.qty || 0;
    const bagWt = d.bag_wt || 0;

    return {
        order_no: orderNo,
        order_type: 'WITH_ORDER',
        product_id: d.product_id,
        product_description: d.Product?.product_name || '',
        // 🟢 qty from order is mapped to packs here
        packs: num(d.qty) || 0, 
        avg_content: num(d.bag_wt) || 0,
        // 🟢 Immediate calculation for the initial load
        total_kgs: num(d.qty) * num(d.bag_wt),
        rate: d.rate_cr || 0,
        broker_code: broker.broker_code || '',
        packing_type: d.packing_type || 'BAGS',
        vat_per: config.vat_percentage || 0,
        gst_per: config.gst_percentage || 0,
        sgst_per: config.sgst_percentage || 0,
        cgst_per: config.cgst_percentage || 0,
        igst_per: config.igst_percentage || 0,
        tcs_per: config.tcs_percentage || 0,
        discount_percentage: 0,
        other_amt: 0,
        freight_amt: 0
    };
});

        setGridRows(
            runCalculations([...gridRows, ...newRows], formData.invoice_type_id)
        );

        e.target.value = "";
    };
    const updateGrid = (idx, field, val) => {
        setGridRows(prev => {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], [field]: val };
            return runCalculations(updated, formData.invoice_type_id);
        });
    };
    const handleSave = async () => {
        setSubmitLoading(true);
        try {
        await transactionsAPI.production.create(formData);
        await fetchMasters(); // 🟢 THIS IS THE MISSING LINK: Refresh dropdown stock values
        fetchRecords();
        setIsModalOpen(false);
    } catch (e) { alert("Save Error"); } finally { setSubmitLoading(false); }
    };
    const filteredHistory = useMemo(() => {
        const history = Array.isArray(listData.history) ? listData.history : [];
        const term = searchValue.toLowerCase().trim();
        return history
            .filter(item => (item.DepotSalesDetails || []).some(d => String(d.order_type).toLowerCase() !== "transfer"))
            .filter(item => {
                let fieldValue = '';
                if (searchField === 'invoice_no') fieldValue = String(item.invoice_no);
                if (searchField === 'depot') fieldValue = item.Depot?.account_name || '';
                if (searchField === 'party') fieldValue = item.Party?.account_name || '';
                const value = fieldValue.toLowerCase();
                return searchCondition === 'Equal' ? value === term : value.includes(term);
            });
    }, [listData.history, searchValue, searchField, searchCondition]);
    return (
        <div className="min-h-screen bg-slate-100 p-6 font-sans">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                    <Warehouse className="text-blue-600" /> Depot Sales Registry
                </h1>
                <button
                    onClick={() => {
                        setFormData({ ...emptyInvoice, invoice_no: (listData.history.length + 1).toString(), header_locked: false });
                        setGridRows([]); setIsModalOpen(true);
                    }}
                    className="bg-blue-600 text-white px-8 py-2 rounded-xl font-bold uppercase text-xs flex items-center gap-2 shadow-lg hover:bg-blue-700"
                >
                    <Plus size={18} /> New Depot Invoice
                </button>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm mb-6 flex gap-4 items-end">
                <div className="flex-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Search Field</label>
                    <select value={searchField} onChange={e => setSearchField(e.target.value)} className="w-full border border-slate-300 p-2 text-xs font-bold rounded">
                        <option value="invoice_no">Invoice No</option>
                        <option value="depot">Depot</option>
                        <option value="party">Party</option>
                    </select>
                </div>
                <div className="flex-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Value</label>
                    <input value={searchValue} onChange={e => setSearchValue(e.target.value)} className="w-full border border-slate-300 p-2 text-xs font-bold rounded" placeholder="Search..." />
                </div>
                <div className="bg-blue-50 text-blue-700 border border-blue-200 px-6 py-2 rounded text-xs font-bold">{filteredHistory.length} Matches</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-900 text-white text-[10px] uppercase font-black tracking-widest">
                        <tr><th className="p-5">Inv #</th><th className="p-5">Date</th><th className="p-5">Depot</th><th className="p-5">Party</th><th className="p-5 text-right">Net Value</th></tr>
                    </thead>
                    <tbody className="divide-y text-sm font-mono">
                        {filteredHistory.map(item => (
                            <tr key={item.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => {

                                const formattedItem = {
                                    ...item,

                                    removal_time: item.removal_time
                                        ? item.removal_time.replace(' ', 'T').slice(0, 16)
                                        : ''
                                };

                                setFormData({
                                        ...formattedItem,

                                        addr1: formattedItem.Party?.addr1 || '',
                                        addr2: formattedItem.Party?.addr2 || '',
                                        addr3: formattedItem.Party?.addr3 || ''
                                    });

                                const rows = item.DepotSalesDetails || [];
                                const recalculated = runCalculations(rows, item.invoice_type_id);

                                setGridRows(recalculated);
                                setIsModalOpen(true);
                            }}>
                                <td className="p-5 font-bold text-blue-600">{item.invoice_no}</td>
                                <td className="p-5 text-slate-500">{item.date}</td>
                                <td className="p-5 uppercase text-xs">{item.Depot?.account_name}</td>
                                <td className="p-5 uppercase font-bold text-xs">{item.Party?.account_name}</td>
                                <td className="p-5 text-right font-black">₹{parseFloat(item.final_invoice_value).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                    <div className="bg-[#D9E5F7] rounded-lg shadow-2xl w-full max-w-[1250px] flex flex-col overflow-hidden border border-slate-400 h-[98vh]">
                        <div className="bg-[#FCD166] p-1.5 border-b border-slate-400 flex justify-between items-center">
                            <span className="text-[13px] font-bold text-slate-700 ml-2 flex items-center gap-2"><Layers size={14} /> Depot Sales Engine</span>
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
                                            <RowInput label="Date" type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                                        </div>
                                        <RowSelect 
    label="Sales Type" 
    value={formData.sales_type} 
    options={[
        { value: 'GST SALES', label: 'GST SALES' }, 
        { value: 'DEPOT SALES', label: 'DEPOT SALES' }, 
        { value: 'DIRECT SALES', label: 'DIRECT SALES' }
    ]} 
    onChange={e => setFormData({ 
        ...formData, 
        sales_type: e.target.value, 
        invoice_type_id: '' // 🟢 Clear selected ID to prevent invalid mapping
    })} 
/>
                                        <RowSelect label="Invoice Type" value={formData.invoice_type_id} options={filteredInvoiceTypes.map(t => ({ value: t.id, label: t.type_name }))} onChange={e => setFormData({ ...formData, invoice_type_id: e.target.value })} />
                                        <RowSelect label="Depot Name" value={formData.depot_id} options={listData.depots.map(d => ({ value: d.id, label: d.account_name }))} onChange={e => setFormData({ ...formData, depot_id: e.target.value })} />
                                        <RowSelect label="Party Name" value={formData.party_id} disabled={formData.header_locked} options={listData.parties.map(p => ({value: p.id, label: p.account_name}))}
                                                onChange={e => {
                                                const partyId = parseInt(e.target.value);
                                                const acc = listData.parties.find(a => a.id === partyId);
                                                console.log("Selected Party:", acc);
                                                if (!acc) return;
                                                setFormData(prev => ({
                                                    ...prev,
                                                    party_id: partyId,
                                                    addr1: acc.addr1 ?? '',
                                                    addr2: acc.addr2 ?? '',
                                                    addr3: acc.addr3 ?? ''
                                                }));
                                            }}
                                            />

                                        <RowInput label="Address 1" value={formData.addr1} readOnly={formData.header_locked} onChange={e => setFormData({ ...formData, addr1: e.target.value })} />
                                        <RowInput label="Address 2" value={formData.addr2} readOnly={formData.header_locked} onChange={e => setFormData({ ...formData, addr2: e.target.value })} />
                                        <RowInput label="Address 3" value={formData.addr3} readOnly={formData.header_locked} onChange={e => setFormData({ ...formData, addr3: e.target.value })}/>
                                        <div className="grid grid-cols-3 gap-2">
                                            <RowInput label="Credit Days" type="number" value={formData.credit_days} onChange={e => setFormData({ ...formData, credit_days: e.target.value })} />
                                            <RowInput label="Interest %" type="number" value={formData.interest_pct} onChange={e => setFormData({ ...formData, interest_pct: e.target.value })} />
                                            <RowSelect label="Pay Mode" value={formData.pay_mode} options={[{ value: 'CREDIT', label: 'CREDIT' }, { value: 'CASH', label: 'CASH' }, { value: 'Immediate', label: 'Immediate' }]} onChange={e => setFormData({ ...formData, pay_mode: e.target.value })} />
                                        </div>
                                        <RowSelect label="Agent Name" value={formData.broker_id} disabled={formData.header_locked} options={listData.brokers.map(b => ({ value: b.id, label: b.broker_name }))} onChange={e => setFormData({ ...formData, broker_id: e.target.value })} />
                                        <div className="grid grid-cols-2 gap-4 pt-2 border-t">

                                            <RowSelect
                                                label="Transport"
                                                value={formData.transport_id}
                                                options={listData.transports.map(t => ({
                                                    value: t.id,
                                                    label: t.transport_name
                                                }))}
                                                onChange={e => setFormData({ ...formData, transport_id: e.target.value })}
                                            />

                                            <RowInput
                                                label="Vehicle No"
                                                value={formData.vehicle_no}
                                                onChange={e => setFormData({ ...formData, vehicle_no: e.target.value })}
                                            />

                                            <RowInput
                                                label="LR No"
                                                value={formData.lr_no}
                                                onChange={e => setFormData({ ...formData, lr_no: e.target.value })}
                                            />

                                            <RowInput
                                                label="Country"
                                                value={formData.country}
                                                onChange={e => setFormData({ ...formData, country: e.target.value })}
                                            />

                                            <RowInput
                                                label="LR Date"
                                                type="date"
                                                value={formData.lr_date}
                                                onChange={e => setFormData({ ...formData, lr_date: e.target.value })}
                                            />

                                            <RowInput
                                                label="ARE No"
                                                value={formData.are_no}
                                                onChange={e => setFormData({ ...formData, are_no: e.target.value })}
                                            />

                                            <RowInput
                                                label="Removal Time"
                                                type="datetime-local"
                                                value={formData.removal_time || ""}
                                                onChange={e =>
                                                    setFormData({ ...formData, removal_time: e.target.value })
                                                }
                                            />
                                            <RowSelect
                                                label="Pay Mode"
                                                value={formData.pay_mode}
                                                options={[
                                                    { value: 'IMMEDIATE', label: 'IMMEDIATE' },
                                                    { value: 'CREDIT', label: 'CREDIT' }
                                                ]}
                                                onChange={e => setFormData({ ...formData, pay_mode: e.target.value })}
                                            />

                                            <RowInput
                                                label="Form JJ"
                                                value={formData.form_jj}
                                                onChange={e => setFormData({ ...formData, form_jj: e.target.value })}
                                            />

                                            <RowInput
                                                label="Remarks"
                                                value={formData.remarks}
                                                onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                                            />

                                        </div>
                                    </div>
                                    <div className="col-span-4 bg-slate-50 border border-slate-300 p-4 rounded flex flex-col gap-1 shadow-inner font-black overflow-y-auto">
    <h3 className="text-xs text-blue-800 mb-2 border-b pb-1 uppercase tracking-tighter">Aggregate Value</h3>
    
    <TotalRow label="Assessable Value" value={formData.total_assessable} />
    <TotalRow label="Charity" value={formData.total_charity} />
    
    {/* GST Group */}
    <div className="bg-blue-50/50 p-1 rounded border border-blue-100 my-1">
        <TotalRow label="GST (Gen)" value={formData.total_gst} />
        <TotalRow label="SGST Total" value={formData.total_sgst} />
        <TotalRow label="CGST Total" value={formData.total_cgst} />
        <TotalRow label="IGST Total" value={formData.total_igst} />
    </div>

    {/* Traditional Taxes from Model */}
    <TotalRow label="VAT Tax" value={formData.total_vat} />
    <TotalRow label="CENVAT Tax" value={formData.total_cenvat} />
    <TotalRow label="Duty Amount" value={formData.total_duty} />
    <TotalRow label="CESS Total" value={formData.total_cess} />
    <TotalRow label="H.S. Cess" value={formData.total_hr_sec_cess} />
    <TotalRow label="TCS Amount" value={formData.total_tcs} />

    {/* Deductions & Additions */}
    <TotalRow label="Discount (-)" value={formData.total_discount} color="text-red-600" />
    <TotalRow label="Other Amt (+)" value={formData.total_other} />
    <TotalRow label="PF Amount" value={formData.pf_amount} />
    <TotalRow label="Freight" value={formData.freight} />

    <div className="mt-auto pt-4 border-t-2 border-slate-400 space-y-1">
        <TotalRow label="Sub Total" value={formData.sub_total} />
        <TotalRow label="Round Off" value={formData.round_off} />
        <div className="flex justify-between items-center py-2 px-2 bg-white border border-slate-400 rounded shadow-sm mt-1">
            <span className="text-[11px] uppercase font-black">Final Invoice Value</span>
            <span className="text-xl font-mono text-blue-700 font-black">₹ {num(formData.final_invoice_value).toLocaleString()}</span>
        </div>
    </div>
</div>
                                </div>
                            ) : (
                                <div className="space-y-4 h-full flex flex-col overflow-hidden">
                                    <div className="bg-blue-50 p-2 border border-blue-200 flex items-center justify-between rounded shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <span className="text-[10px] font-black uppercase text-blue-700">Sync Mill Order:</span>
                                            <select onChange={handleOrderSync} className="border border-slate-300 text-[11px] p-1 w-72 font-bold rounded">
                                                <option value="">-- Choose Order --</option>
                                                {listData.orders.map(o => <option key={o.id} value={`WITH|${o.order_no}`}>{o.order_no} | {o.Party?.account_name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex-1 border border-slate-300 overflow-x-auto bg-slate-50 shadow-inner rounded">
                                        {/* ... inside the Detail tab section ... */}
                                        <div className="flex-1 border border-slate-300 overflow-x-auto bg-slate-50 shadow-inner rounded">
                                            <table className="min-w-[8000px] text-[10px] border-collapse bg-white">
    <thead className="bg-slate-800 text-white sticky top-0 z-10 font-bold uppercase">
    {/* Row 1: Main Categories */}
    <tr>
        <th className="p-3 border-r w-32" rowSpan="2">Order No</th>
        <th className="p-3 border-r w-80" rowSpan="2">Product Description</th>
        <th className="p-3 border-r w-32" rowSpan="2">Broker</th>
        <th className="p-3 border-r w-24" rowSpan="2">Packs</th>
        <th className="p-3 border-r w-32" rowSpan="2">Avg Content</th>
        <th className="p-3 border-r w-32 bg-blue-900" rowSpan="2">Total Kgs</th>
        <th className="p-3 border-r w-24" rowSpan="2">Rate</th>
        <th className="p-3 border-r w-40 bg-blue-700 font-black" rowSpan="2">Assess [A]</th>
        <th className="p-3 border-r w-32" rowSpan="2">Charity</th>
        
        {/* 10 Tax Groups */}
        <th colSpan="2" className="border-r text-center bg-slate-700">GST</th>
        <th colSpan="2" className="border-r text-center bg-slate-700">SGST</th>
        <th colSpan="2" className="border-r text-center bg-slate-700">CGST</th>
        <th colSpan="2" className="border-r text-center bg-slate-700">IGST</th>
        <th colSpan="2" className="border-r text-center bg-slate-700">VAT</th>
        <th colSpan="2" className="border-r text-center bg-slate-700">CENVAT</th>
        <th colSpan="2" className="border-r text-center bg-slate-700">DUTY</th>
        <th colSpan="2" className="border-r text-center bg-slate-700">CESS</th>
        <th colSpan="2" className="border-r text-center bg-slate-700">H.CESS</th>
        <th colSpan="2" className="border-r text-center bg-slate-700">TCS</th>
        <th colSpan="2" className="border-r text-center bg-rose-900">Discount</th>

        <th className="p-3 border-r w-32" rowSpan="2">Other</th>
        <th className="p-3 border-r w-32" rowSpan="2">Freight</th>
        <th className="p-3 border-r w-80" rowSpan="2">ID Mark</th>
        <th className="p-3 w-12" rowSpan="2"></th>
    </tr>
    {/* Row 2: Sub-headers - UPDATED TO 10 PAIRS */}
    <tr className="bg-slate-900 text-[9px]">
        {[...Array(11)].map((_, i) => (
            <React.Fragment key={i}>
                <th className="border-r p-1 text-center">%</th>
                <th className="border-r p-1 text-center">Amt</th>
            </React.Fragment>
        ))}
    </tr>
</thead>
    <tbody className="divide-y divide-slate-200 font-black">
        {gridRows.map((r, i) => (
            <tr key={i} className="hover:bg-blue-50">
                <td className="p-2 border-r text-blue-600 font-mono">{r.order_no}</td>
                <td className="p-2 border-r uppercase">{r.product_description}</td>
                <td className="p-1 border-r"><input className="w-full text-center outline-none border-none" value={r.broker_code} onChange={e => updateGrid(i, 'broker_code', e.target.value)} /></td>
                <td className="p-1 border-r">
    <input 
        type="number" 
        className="w-full text-center font-black bg-white" 
        value={r.packs} 
        onChange={e => updateGrid(i, 'packs', e.target.value)} 
    />
</td>
<td className="p-1 border-r">
    <input 
        type="number" 
        step="0.001"
        className="w-full text-center font-black bg-white" 
        value={r.avg_content} 
        onChange={e => updateGrid(i, 'avg_content', e.target.value)} 
    />
</td>
<td className="p-2 border-r text-center font-black bg-blue-50 text-blue-800">
    {num(r.total_kgs).toFixed(3)}
</td>
<td className="p-1 border-r">
    <input 
        type="number" 
        className="w-full text-center font-black bg-white" 
        value={r.rate} 
        onChange={e => updateGrid(i, 'rate', e.target.value)} 
    />
</td>
                <td className="p-2 border-r text-center bg-blue-100 font-black">₹{num(r.assessable_value).toFixed(2)}</td>
                <td className="p-2 border-r text-center text-orange-600">₹{num(r.charity_amt).toFixed(2)}</td>

                {/* Editable Percentage Pair Cells */}
                {/* Editable Percentage Pair Cells - Full Sync */}
                {/* Render Pair Cells - Ensure this order matches the header! */}
                {renderPairCell(r, i, 'gst_per', 'gst_amt', true, updateGrid)}
                {renderPairCell(r, i, 'sgst_per', 'sgst_amt', true, updateGrid)}
                {renderPairCell(r, i, 'cgst_per', 'cgst_amt', true, updateGrid)}
                {renderPairCell(r, i, 'igst_per', 'igst_amt', true, updateGrid)}
                {renderPairCell(r, i, 'vat_per', 'vat_amt', true, updateGrid)}
                {renderPairCell(r, i, 'cenvat_per', 'cenvat_amt', true, updateGrid)}
                {renderPairCell(r, i, 'duty_per', 'duty_amt', true, updateGrid)}
                {renderPairCell(r, i, 'cess_per', 'cess_amt', true, updateGrid)}
                {renderPairCell(r, i, 'hcess_per', 'hcess_amt', true, updateGrid)}
                {renderPairCell(r, i, 'tcs_per', 'tcs_amt', true, updateGrid)}
                {renderPairCell(r, i, 'discount_percentage', 'discount_amt', true, updateGrid, "text-rose-600")}

                <td className="p-1 border-r"><input type="number" className="w-full text-center outline-none" value={r.other_amt} onChange={e => updateGrid(i, 'other_amt', e.target.value)} /></td>
                <td className="p-1 border-r"><input type="number" className="w-full text-center outline-none" value={r.freight_amt} onChange={e => updateGrid(i, 'freight_amt', e.target.value)} /></td>
                <td className="p-1 border-r"><input className="w-full text-center outline-none text-[9px] uppercase" value={r.identification_mark} onChange={e => updateGrid(i, 'identification_mark', e.target.value)} /></td>
                <td className="p-2 text-center">
                    <button onClick={() => setGridRows(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 hover:scale-110">
                        <MinusCircle size={20} />
                    </button>
                </td>
            </tr>
        ))}
    </tbody>
</table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="bg-[#D9E5F7] p-3 border-t border-slate-400 flex justify-between gap-3 px-6 shadow-inner">
                            <div className="flex gap-2">
                                <button onClick={exportToPDF} disabled={gridRows.length === 0} className="bg-emerald-600 text-white px-6 py-2 text-[11px] font-black rounded flex items-center gap-2 shadow hover:bg-emerald-700">
                                    <FileText size={16} /> DOWNLOAD PDF
                                </button>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setIsModalOpen(false)} className="bg-white border border-slate-400 px-10 py-2 text-[11px] font-black rounded uppercase hover:bg-slate-50">Cancel</button>
                                <button onClick={handleSave} disabled={submitLoading || gridRows.length === 0} className="bg-blue-600 text-white border border-blue-700 px-12 py-2 text-[11px] font-black rounded flex items-center gap-2 hover:bg-blue-700 shadow-md">
                                    <Save size={16} /> {submitLoading ? "SAVING..." : "COMMIT INVOICE"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
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
const renderPairCell = (row, idx, perKey, amtKey, isEditable, updateGrid, color = "text-blue-600") => (
    <>
        <td className="p-1 border-r text-slate-400"><input type="number" step="0.01" disabled={!isEditable} className={`w-full p-2 text-center font-black border rounded bg-white outline-none focus:border-blue-500 ${color} disabled:bg-slate-100 disabled:border-transparent`} value={row[perKey] || 0} onChange={(e) => updateGrid(idx, perKey, e.target.value)} /></td>
        <td className={`p-2 border-r text-center font-black bg-slate-50 ${color}`}>{num(row[amtKey]).toFixed(2)}</td>
    </>
);
export default DepotSalesInvoice;
