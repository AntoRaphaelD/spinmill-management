import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { mastersAPI, transactionsAPI } from '../service/api';
import {
    Save, FileText, Calculator, RefreshCw, X, Plus,
    Database, MinusCircle, Box, Layers, Activity, Lock,
    ShoppingCart, ChevronDown, Clock, Truck, User,
    Search, Hash, Info, MapPin, Printer, FileJson
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { evaluate } from "mathjs"

// =====================================================
// SAFE NUMBER HELPERS (PREVENT NaN + DECIMAL ISSUES)
// =====================================================
const num = (v) => {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
};

const money = (v) => Number(num(v).toFixed(2));
// =====================================================
// INDIAN RUPEES TO WORDS (Professional GST Requirement)
// =====================================================
const numberToWords = (amount) => {
    if (!amount || amount === 0) return "Zero Rupees Only";

    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
        "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
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

// =====================================================
// PREMIUM PRINT VIEW - EXACTLY AS PER YOUR SPECIFICATION
// =====================================================
const ModernPrintView = ({ data, listData, getHSN }) => {
    if (!data) return null;

    const getProduct = (pid) => listData.products.find(p => p.id === pid);
    const netAmount = num(data.net_amount);

    return (
        <div id="printable-invoice-wrapper" className="p-8 bg-white text-slate-800 font-sans border border-slate-900 max-w-[210mm] mx-auto shadow-xl">
            {/* 1. HEADER */}
            <div className="flex justify-between items-start border-b-2 border-gray-300 pb-6 mb-6">
                <div>
                    <h1 className="text-5xl font-black text-blue-600 tracking-tighter">TAX INVOICE</h1>
                    <div className="mt-2 inline-block bg-blue-100 text-blue-700 text-xs font-bold px-5 py-1 rounded">Original for Buyer</div>
                </div>
                <div className="text-right text-xs">
                    <div className="font-bold">Duplicate for Transporter</div>
                    <div className="font-bold">Triplicate for File Copy</div>
                    <div className="font-bold">Extra Copy</div>
                </div>
            </div>

            {/* 2. COMPANY DETAILS */}
            <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                    <h2 className="text-xl font-black">KAYAAR EXPORTS PRIVATE LIMITED</h2>
                    <p className="text-xs leading-tight mt-1">
                        D.No: 43/5, Railway Feeder Road<br />
                        K.R. Nagar – 628503<br />
                        Kovilpatti – Taluk<br />
                        Tuticorin Dist, Tamilnadu, India
                    </p>
                    <p className="text-xs mt-3">Phone: 04632 – 248258, 9443238761</p>
                    <p className="text-xs">Email: ttnkrgroup@gmail.com</p>
                    <p className="text-xs font-bold mt-3">GSTIN: 33AAACK4468M1ZA</p>
                </div>

                {/* 3. CERTIFICATION + REGISTRATION */}
                <div className="text-right">
                    <div className="border border-gray-300 bg-gray-50 p-4 rounded-xl inline-block text-xs">
                        <div className="font-black text-emerald-700">OEKO-TEX Standard 100</div>
                        <div className="text-[10px]">Tested for harmful substances</div>
                        <div className="text-[10px]">www.oeko-tex.com/standard100</div>
                    </div>
                    <div className="mt-6 text-xs">
                        <div>PAN: <span className="font-mono">AAACK4468M</span></div>
                        <div>CIN: <span className="font-mono">U51101TN1991PTC020933</span></div>
                    </div>
                </div>
            </div>

            {/* 5. PARTY DETAILS + 6. INVOICE INFO */}
            <div className="grid grid-cols-2 gap-12 mb-10 border border-slate-300 p-6 rounded-2xl">
                <div>
                    <div className="uppercase text-blue-700 text-[10px] font-black tracking-widest mb-1">Bill To</div>
                        <div className="font-black text-lg">{data.Party?.account_name}</div>
                        <div className="text-xs mt-2 leading-tight">
                            {data.addr1}<br/>
                            {data.addr2}<br/>
                            {data.addr3}
                        </div>
                    <div className="mt-4 text-xs font-bold">GST No: <span className="font-mono">{data.Party?.gst_no || 'N/A'}</span></div>
                </div>

                <div className="grid grid-cols-2 gap-6 text-xs">
                    <div>
                        <div className="font-black text-slate-500">Invoice No</div>
                        <div className="font-mono text-2xl font-black">{data.invoice_no}</div>
                    </div>
                    <div>
                        <div className="font-black text-slate-500">Invoice Date</div>
                        <div className="font-bold text-lg">{data.date}</div>
                    </div>
                    <div>
                        <div className="font-black text-slate-500">E-Way Bill No</div>
                        <div className="font-mono">{data.ebill_no || 'PENDING'}</div>
                    </div>
                    <div>
                        <div className="font-black text-slate-500">Vehicle No</div>
                        <div className="font-bold uppercase">{data.vehicle_no || 'N/A'}</div>
                    </div>
                    <div>
                        <div className="font-black text-slate-500">Delivery At</div>
                        <div className="font-medium">{data.delivery || 'MUMBAI'}</div>
                    </div>
                </div>
            </div>

            {/* 7. PRODUCT TABLE */}
            <table className="w-full border-collapse mb-8 text-xs">
                <thead>
                    <tr className="bg-gray-100 text-gray-800 font-bold text-[10px] border-b">
                        <th className="py-4 px-4 text-left border-r border-slate-700">Description of Goods</th>
                        <th className="py-4 px-4 text-center border-r border-slate-700">No of Bags</th>
                        <th className="py-4 px-4 text-center border-r border-slate-700">Net Weight</th>
                        <th className="py-4 px-4 text-center border-r border-slate-700">S.L No</th>
                        <th className="py-4 px-4 text-right border-r border-slate-700">Rate Per Kgs</th>
                        <th className="py-4 px-4 text-right">Assessable Value</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {(data.Details || data.InvoiceDetails || []).map((item, idx) => {
                        const prod = getProduct(item.product_id);
                        return (
                            <tr key={idx} className="text-[11px]">
                                <td className="py-4 px-4">
                                    <div className="font-black uppercase">{item.product_description}</div>
                                    <div className="text-[10px] text-slate-500">HSN: {getHSN(item.product_id)}</div>
                                </td>
                                <td className="py-4 px-4 text-center font-bold">{item.packs}</td>
                                <td className="py-4 px-4 text-center font-black">{item.total_kgs}</td>
                                <td className="py-4 px-4 text-center">{item.from_no} - {item.to_no}</td>
                                <td className="py-4 px-4 text-right font-bold">₹{item.rate}</td>
                                <td className="py-4 px-4 text-right font-black">{num(item.assessable_value).toLocaleString('en-IN')}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* 9. TOTALS (Exact match to your screenshot) */}
            <div className="flex justify-end">
                <div className="w-96">
                    <div className="space-y-2 text-sm border-b pb-4">
                        <div className="flex justify-between"><span>Assessable Value</span><span className="font-mono">₹{num(data.total_assessable).toLocaleString('en-IN')}</span></div>
                        <div className="flex justify-between"><span>Charity</span><span className="font-mono">₹{num(data.total_charity).toLocaleString('en-IN')}</span></div>
                        <div className="flex justify-between"><span>Freight Charges</span><span className="font-mono">₹{num(data.freight_charges).toLocaleString('en-IN')}</span></div>
                        <div className="flex justify-between border-t pt-3 font-bold"><span>GST Total</span><span className="font-mono">₹{num(data.total_gst).toLocaleString('en-IN')}</span></div>
                    </div>

                    {/* GRAND TOTAL - BLACK BOX LIKE YOUR SCREENSHOT */}
                    <div className="mt-6 bg-blue-50 border border-blue-200 rounded-2xl px-8 py-5 flex justify-between items-center">
                        <span className="text-lg font-bold text-blue-700 tracking-widest">GRAND TOTAL</span>
                        <span className="text-3xl font-black font-mono text-blue-700">₹{netAmount.toLocaleString('en-IN')}</span>
                    </div>

                    {/* Amount in Words */}
                    <div className="mt-8 text-xs font-bold text-slate-700">
                        Amount Chargeable (in words):<br />
                        <span className="font-mono text-blue-700 text-sm">{numberToWords(netAmount)}</span>
                    </div>
                </div>
            </div>

            {/* Declaration & Signatures */}
            <div className="mt-16 text-[10px] italic text-slate-500">
                We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
            </div>

            <div className="grid grid-cols-2 mt-12 text-xs">
                <div>
                    <div className="border border-dashed border-slate-400 w-52 h-24 rounded"></div>
                    <p className="mt-3">Receiver's Signature</p>
                </div>
                <div className="text-right">
                    <p className="font-black">For KAYAAR EXPORTS PRIVATE LIMITED</p>
                    <p className="mt-10">Authorised Signatory</p>
                </div>
            </div>
        </div>
    );
};

const InvoicePreparation = () => {
    // ==========================================
    // 1. INITIAL STATES
    // ==========================================
    const emptyInvoice = {
        id: null, invoice_no: '', load_id: '', date: new Date().toISOString().split('T')[0],
        sales_type: 'GST SALES', invoice_type_id: '', party_id: '', addr1: '', addr2: '', addr3: '',del1: '', del2: '', del3: '',
        credit_days: 0, interest_percentage: 0, transport_id: '', lr_no: '',
        delivery: '', lr_date: new Date().toISOString().split('T')[0], ebill_no: '',
        vehicle_no: '', remarks: '', removal_time: '12:00', prepare_time: '12:00',
        pay_mode: 'CREDIT', form_j: '', sales_against: '', epcg_no: '', broker_id: '', is_approved: false,
        // Header Totals
        total_assessable: 0, total_charity: 0, total_vat: 0, total_cenvat: 0,
        total_duty: 0, total_cess: 0, total_hr_sec_cess: 0, total_tcs: 0,
        total_gst: 0, total_igst: 0, total_discount: 0, total_broker: 0,
        total_other: 0, freight_charges: 0, sub_total: 0, round_off: 0, net_amount: 0
    };

    const [listData, setListData] = useState({
        types: [], parties: [], transports: [], products: [], orders: [], directOrders: [], history: [], loads: [], brokers: []
    });

    const [formData, setFormData] = useState(emptyInvoice);
    const [gridRows, setGridRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('head');
    // SEARCH FILTERS (like AccountMaster)
    const [searchField, setSearchField] = useState('invoice_no');
    const [searchCondition, setSearchCondition] = useState('Like');
    const [searchValue, setSearchValue] = useState('');
    const [printData, setPrintData] = useState(null);
    // ==========================================
    // SEARCH FILTER ENGINE
    // ==========================================
    const filteredInvoices = useMemo(() => {

        let result = [...listData.history];

        if (searchValue.trim()) {

            result = result.filter(item => {

                let fieldValue = '';

                switch (searchField) {
                    case 'invoice_no':
                        fieldValue = String(item.invoice_no || '');
                        break;

                    case 'date':
                        fieldValue = String(item.date || '');
                        break;

                    case 'party':
                        fieldValue = String(item.Party?.account_name || '');
                        break;

                    case 'status':
                        fieldValue = item.is_approved ? 'APPROVED' : 'PENDING';
                        break;

                    default:
                        fieldValue = '';
                }

                const term = searchValue.toLowerCase().trim();
                const value = fieldValue.toLowerCase();

                return searchCondition === 'Equal'
                    ? value === term
                    : value.includes(term);
            });

        }

        return result;

    }, [listData.history, searchField, searchCondition, searchValue]);

    // =====================================================
    // PROFESSIONAL EXPORT TO PDF - MATCHES PRINT VIEW 100%
    // =====================================================
    const getHSN = (productId) => {
        const prod = listData.products.find(p => p.id === productId);
        return prod?.printing_tariff_sub_head_no || '';
    };
    const exportToPDF = () => {
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const data = formData;
        const rows = gridRows;
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        const getProduct = (pid) => listData.products.find(p => p.id === pid);

        // Header
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(26);
        doc.text("TAX INVOICE", pageWidth / 2, 22, { align: "center" });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(26);
        doc.text("TAX INVOICE", pageWidth / 2, 22, { align: "center" });

        doc.setFontSize(10);
        const checkboxX = pageWidth - margin - 45;
        let checkboxY = 14;

        const drawCheckbox = (label) => {
            doc.setDrawColor(0);
            doc.rect(checkboxX, checkboxY - 3, 4, 4);
            doc.setFontSize(9);
            doc.text(label, checkboxX + 7, checkboxY);
            checkboxY += 6;
        };

        drawCheckbox("ORIGINAL FOR BUYER");
        drawCheckbox("DUPLICATE FOR TRANSPORTER");
        drawCheckbox("TRIPLICATE FOR FILE COPY");
        drawCheckbox("EXTRA COPY");

        // Company Details
        doc.setTextColor(0);
        doc.setFontSize(12);
        doc.text("KAYAAR EXPORTS PRIVATE LIMITED", margin, 48);
        doc.setFontSize(9);
        doc.text("D.No: 43/5, Railway Feeder Road", margin, 54);
        doc.text("K.R. Nagar – 628503, Kovilpatti – Taluk", margin, 59);
        doc.text("Tuticorin Dist, Tamilnadu, India", margin, 64);
        doc.text("Phone: 04632 – 248258, 9443238761", margin, 69);
        doc.text("Email: ttnkrgroup@gmail.com", margin, 74);
        doc.text("GSTIN: 33AAACK4468M1ZA", margin, 79);

        // PAN & CIN
        doc.text("PAN: AAACK4468M", pageWidth - margin - 45, 52);
        doc.text("CIN: U51101TN1991PTC020933", pageWidth - margin - 45, 57);

        // OEKO-TEX
        doc.setDrawColor(0);
        doc.rect(pageWidth - margin - 50, 65, 55, 18);
        doc.setFontSize(8);
        doc.text("OEKO-TEX Standard 100", pageWidth - margin - 45, 72);
        doc.text("Tested for harmful substances", pageWidth - margin - 45, 77);

        // Party & Invoice Info
        doc.setFontSize(10);
        doc.text("Bill To:", margin, 95);
        doc.text(data.Party?.account_name || "", margin, 102);
        doc.text(data.addr1 || "", margin, 107);
        doc.text(data.addr2 || "", margin, 112);
        doc.text(data.addr3 || "", margin, 117);

        doc.text("Invoice No :", pageWidth / 2, 95);
        doc.text(`${data.invoice_no}`, pageWidth / 2 + 25, 95);
        doc.text("Date :", pageWidth / 2, 102);
        doc.text(data.date, pageWidth / 2 + 25, 102);
        doc.text("E-Way Bill :", pageWidth / 2, 109);
        doc.text(data.ebill_no || "PENDING", pageWidth / 2 + 25, 109);
        doc.text("Vehicle :", pageWidth / 2, 116);
        doc.text(data.vehicle_no || "N/A", pageWidth / 2 + 25, 116);
        doc.text("Delivery At :", pageWidth / 2, 123);
        doc.text(data.delivery || "MUMBAI", pageWidth / 2 + 25, 123);

        // Table
        const tableRows = rows.map(r => [
            `${r.product_description}\nHSN: ${getHSN(r.product_id)}`,
            r.packs,
            r.total_kgs,
            `${r.from_no || ''} - ${r.to_no || ''}`,
            `Rs. ${Number(r.rate).toLocaleString('en-IN')}`,
            num(r.assessable_value).toLocaleString()
        ]);

        autoTable(doc, {
            startY: 135,
            head: [['Description of Goods', 'No of Bags', 'Net Weight', 'S.L No', 'Rate Per Kgs', 'Assessable Value']],
            body: tableRows,
            theme: 'grid',
            headStyles: { textColor: 0, fontStyle: 'bold', fontSize: 9 },
            styles: { lineColor: 0, lineWidth: 0.2 },
            columnStyles: {
                0: { cellWidth: 70 },
                1: { halign: 'center' },
                2: { halign: 'center' },
                3: { halign: 'center' },
                4: { halign: 'right' },
                5: { halign: 'right' }
            }
        });

        const finalY = doc.lastAutoTable.finalY + 12;

        // Totals
        doc.setFontSize(11);
        doc.text("Assessable Value", pageWidth - 85, finalY);
        doc.text(`Rs. ${num(data.total_assessable).toLocaleString('en-IN')}`, pageWidth - margin, finalY, { align: "right" });

        doc.text("Charity", pageWidth - 85, finalY + 7);
        doc.text(`Rs. ${num(data.total_charity).toLocaleString('en-IN')}`, pageWidth - margin, finalY + 7, { align: "right" });

        doc.text("Freight Charges", pageWidth - 85, finalY + 14);
        doc.text(`Rs. ${num(data.freight_charges).toLocaleString('en-IN')}`, pageWidth - margin, finalY + 14, { align: "right" });

        doc.text("GST Total", pageWidth - 85, finalY + 21);
        doc.text(`Rs.${num(data.total_gst).toLocaleString('en-IN')}`, pageWidth - margin, finalY + 21, { align: "right" });

        // Grand Total Box
        doc.setDrawColor(0);
        doc.roundedRect(pageWidth - 85, finalY + 28, 80, 18, 4, 4);
        doc.setTextColor(0);
        doc.setFontSize(12);
        doc.text("GRAND TOTAL", pageWidth - 75, finalY + 39);
        doc.setFontSize(18);
        doc.text(`Rs. ${num(data.net_amount).toLocaleString('en-IN')}`, pageWidth - 10, finalY + 39, { align: "right" });

        // Amount in Words
        const wordsY = finalY + 58;
        doc.setTextColor(0);
        doc.setFontSize(10);
        doc.text("Amount Chargeable (in words):", margin, wordsY);
        doc.setFont("helvetica", "bold");
        doc.text(numberToWords(num(data.net_amount)), margin, wordsY + 7);

        // Declaration & Sign
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.text("We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.", margin, wordsY + 22);

        doc.setFont("helvetica", "normal");
        doc.text("Authorised Signatory", pageWidth - margin - 70, wordsY + 45);
        doc.text("For KAYAAR EXPORTS PRIVATE LIMITED", pageWidth - margin - 70, wordsY + 50);

        doc.save(`Kayaar_TAX_INVOICE_${data.invoice_no}.pdf`);
    };

    // ==========================================
    // 2. MATH ENGINE (Strict Logic: H -> A -> Tax -> Deductions)
    // ==========================================
    const handlePrint = (item) => {
        setPrintData(item);
        setTimeout(() => {
            window.print();
        }, 800);
    };
    const evaluateFormula = (formula, ctx) => {

        let processed = formula;

        Object.keys(ctx).forEach(key => {
            const regex = new RegExp(`\\[${key}\\]`, "gi");
            processed = processed.replace(regex, ctx[key]);
        });

        processed = processed.replace(/Round\(/gi, "round(");

        try {
            const result = evaluate(processed);

            const digits = ctx.round_digits ?? 2;

            return Number(result.toFixed(digits));

        } catch (err) {
            console.error("Formula Error:", processed);
            return 0;
        }
    };
    const runCalculations = useCallback((rows, typeId, hFreight = formData.freight_charges) => {

        if (!typeId) return rows;

        const config = listData.types.find(t => t.id === parseInt(typeId));
        if (!config) return rows;

        // Total weight for freight distribution
        const totalWeight = rows.reduce((sum, r) => sum + num(r.total_kgs), 0);

        let hTotals = {
            assess: 0, charity: 0, vat: 0, cenvat: 0,
            duty: 0, cess: 0, hcess: 0, tcs: 0,
            gst: 0, igst: 0, disc: 0, brok: 0,
            other: 0, net: 0
        };

        const updatedRows = rows.map((item) => {

            const product = listData.products.find(
                p => p.id === parseInt(item.product_id)
            );

            // ======================
            // 1. BASE VALUE [H]
            // ======================
            const H = num(item.rate) * num(item.total_kgs);

            // ======================
            // AVG CONTENT AUTO CALC
            // ======================
            const avgContent =
                num(item.packs) > 0
                    ? Number((num(item.total_kgs) / num(item.packs)).toFixed(3))
                    : 0;
            // ======================
            // 2. ASSESS VALUE [A]
            // ======================
            const A =
                H
                - num(item.resale)
                + num(item.convert_to_hank)
                - num(item.convert_to_cone);

            // ======================
            // FREIGHT DISTRIBUTION
            // ======================
            const freightShare =
                totalWeight > 0
                    ? (num(hFreight) * num(item.total_kgs)) / totalWeight
                    : 0;

            const taxable = A + freightShare;

            // ======================
            // TAXES
            // ======================
            const charity = config.charity_checked
                ? num(product?.charity_rs) * num(item.total_kgs)
                : 0;

            const vat = config.vat_checked ? num(item.vat_per) * taxable / 100 : 0;
            const cenvat = config.cenvat_checked ? num(item.cenvat_per) * taxable / 100 : 0;
            const duty = config.duty_checked ? num(item.duty_per) * taxable / 100 : 0;
            const cess = config.cess_checked ? num(item.cess_per) * taxable / 100 : 0;
            const hcess = config.hr_sec_cess_checked ? num(item.hcess_per) * taxable / 100 : 0;
            const tcs = config.tcs_checked ? num(item.tcs_per) * taxable / 100 : 0;

            const sgst = config.gst_checked ? num(item.sgst_per) * taxable / 100 : 0;
            const cgst = config.gst_checked ? num(item.cgst_per) * taxable / 100 : 0;
            let igst = 0;

            if (config.igst_checked && config.igst_formula) {

                const ctx = {
                    H: H,
                    A: A,

                    "Total Kgs": num(item.total_kgs),
                    Rate: num(item.rate),
                    CharityRs: num(product?.charity_rs),

                    igstper: num(item.igst_per),
                    sgstper: num(item.sgst_per),
                    cgstper: num(item.cgst_per),

                    round_digits: num(config.round_off_digits)   // ⭐ ADD THIS
                };

                igst = evaluateFormula(config.igst_formula, ctx);
            }

            // ======================
            // BASIS VALUE
            // ======================
            const basis =
                taxable
                + sgst + cgst + igst
                + vat + cenvat + duty + cess + hcess + tcs
                + charity
                + num(item.other_amt);

            // ======================
            // DEDUCTIONS
            // ======================
            const discAmt = num(item.discount_percentage) * basis / 100;
            const brokAmt = num(item.broker_percentage) * basis / 100;

            // ======================
            // FINAL VALUE
            // ======================
            const rowTotal = basis - discAmt - brokAmt;

            const roundedValue = Number(rowTotal.toFixed(2));

            const rowRoundedOff =
                Number((roundedValue - Number(rowTotal.toFixed(2))).toFixed(2));

            // ======================
            // HEADER TOTALS
            // ======================
            hTotals.assess += A;
            hTotals.charity += charity;
            hTotals.vat += vat;
            hTotals.cenvat += cenvat;
            hTotals.duty += duty;
            hTotals.cess += cess;
            hTotals.hcess += hcess;
            hTotals.tcs += tcs;
            hTotals.gst += (sgst + cgst);
            hTotals.igst += igst;
            hTotals.disc += discAmt;
            hTotals.brok += brokAmt;
            hTotals.other += num(item.other_amt);
            hTotals.net += rowTotal;

            return {
                ...item,

                avg_content: avgContent,

                base_h: H,

                assessable_value: A,

                freight_amt: freightShare,

                charity_amt: charity,

                vat_amt: vat,
                cenvat_amt: cenvat,
                duty_amt: duty,
                cess_amt: cess,
                hr_sec_cess_amt: hcess,
                tcs_amt: tcs,

                sgst_amt: sgst,
                cgst_amt: cgst,
                igst_amt: igst,

                discount_amt: discAmt,
                broker_amt: brokAmt,

                sub_total: basis,

                rounded_off: rowRoundedOff,

                final_value: roundedValue
            };
        });

        // ======================
        // HEADER TOTAL
        // ======================
        const finalRawTotal = hTotals.net;

        const finalNetTotal = Number(
            finalRawTotal.toFixed(config.round_off_digits ?? 2)
        );

        setFormData(prev => ({
            ...prev,

            total_assessable: money(hTotals.assess),
            total_charity: money(hTotals.charity),

            total_vat: money(hTotals.vat),
            total_cenvat: money(hTotals.cenvat),

            total_duty: money(hTotals.duty),
            total_cess: money(hTotals.cess),

            total_hr_sec_cess: money(hTotals.hcess),

            total_tcs: money(hTotals.tcs),

            total_gst: money(hTotals.gst),
            total_igst: money(hTotals.igst),

            total_discount: money(hTotals.disc),
            total_broker: money(hTotals.brok),

            total_other: money(hTotals.other),

            sub_total: money(finalRawTotal),

            round_off: money(finalNetTotal - finalRawTotal),

            net_amount: finalNetTotal
        }));

        return updatedRows;

    }, [listData.types, listData.products, formData.freight_charges]);

    // ==========================================
    // 3. INITIAL LOAD
    // ==========================================
    const init = async () => {
        setLoading(true);
        try {
            const [types, accounts, transports, products, orders, direct, invoices, despatch, brokers] = await Promise.all([
                mastersAPI.invoiceTypes.getAll(),
                mastersAPI.accounts.getAll(),
                mastersAPI.transports.getAll(),
                mastersAPI.products.getAll(),
                transactionsAPI.orders.getAll(),
                transactionsAPI.directInvoices.getAll(),
                transactionsAPI.invoices.getAll(),
                transactionsAPI.despatch.getAll(),
                mastersAPI.brokers.getAll()
            ]);

            const historyData = invoices.data.data || [];
            setListData({
                types: types.data.data || [],
                parties: accounts.data.data || [],
                transports: transports.data.data || [],
                products: products.data.data || [],
                orders: orders.data.data || [],
                directOrders: direct.data.data || [],
                history: historyData,
                loads: despatch.data.data || [],
                brokers: brokers.data.data || []
            });

            const maxNo = historyData.reduce((max, item) => Math.max(max, parseInt(item.invoice_no) || 0), 0);
            setFormData(prev => ({ ...prev, invoice_no: (maxNo + 1).toString() }));
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    useEffect(() => { init(); }, []);

    // ==========================================
    // 4. HANDLERS
    // ==========================================
    const handleLoadSync = (loadId) => {

        const load = listData.loads.find(
            l => l.id === parseInt(loadId)
        );

        if (!load) return;

        const bags = num(load.no_of_bags);

        const updatedForm = {
            ...formData,

            load_id: load.id,

            transport_id: load.transport_id,
            vehicle_no: load.vehicle_no,
            delivery: load.delivery,

            lr_no: load.lr_no,
            lr_date: load.lr_date,

            ebill_no: load.insurance_no,
            freight_charges: load.freight,

            // FETCH TIME EXACTLY AS STORED
            removal_time: load.out_time || '',
            prepare_time: load.in_time || ''
        };

        setFormData(updatedForm);

        setGridRows(prev => {

            const updatedRows = prev.map(r => ({
                ...r,
                packs: bags
            }));

            return runCalculations(
                updatedRows,
                updatedForm.invoice_type_id,
                load.freight
            );
        });
    };
    const handleAccountSync = (accId) => {

    const partyId = parseInt(accId);

    const acc = listData.parties.find(a => a.id === partyId);

    if (!acc) return;

    setFormData(prev => ({
        ...prev,
        party_id: partyId,

        addr1: acc.addr1 || '',
        addr2: acc.addr2 || '',
        addr3: acc.addr3 || ''
    }));
};
    const handleOrderSync = (e) => {
        const val = e.target.value;
        if (!val) return;
        const [source, orderNo] = val.split('|');
        const order = source === 'WITH' ? listData.orders.find(o => o.order_no === orderNo) : listData.directOrders.find(o => o.order_no === orderNo);
        const config = listData.types.find(t => t.id === parseInt(formData.invoice_type_id));
        if (!config) return alert("Select Invoice Type first.");
        const load = listData.loads.find(l => l.id === parseInt(formData.load_id));
        const details = source === 'WITH' ? order.OrderDetails || [] : order.DirectInvoiceDetails || [];
        const newRows = details.map(d => {
        const broker = listData.brokers.find(b => b.id === order.broker_id);
        const qty = num(d.qty || 0);
        const bagWt = num(d.bag_wt || 0);
            return {
                order_no: orderNo, order_type: source === 'WITH' ? 'WITH_ORDER' : 'WITHOUT_ORDER',
                sales_type_label: source === 'WITH' ? 'Order' : 'Direct', product_id: d.product_id,
                broker_code: broker?.broker_code || '', broker_percentage: broker?.commission_pct || 0,
                product_description: d.Product?.product_name || '', packs: load?.no_of_bags || d.packs || 0,
                packing_type: d.packing_type || d.Product?.packing_type || 'BAGS', total_kgs: qty * bagWt || d.total_kgs || 0,
                avg_content: d.bag_wt || 0, rate: d.rate_cr || d.rate || 0, rate_per: d.rate_per || d.Product?.rate_per || 'KG', identification_mark: '',
                from_no: '', to_no: '', resale: 0, convert_to_hank: 0, convert_to_cone: 0,
                vat_per: config.vat_percentage || 0, cenvat_per: config.cenvat_percentage || 0, duty_per: config.duty_percentage || 0,
                cess_per: config.cess_percentage || 0, hcess_per: config.hr_sec_cess_percentage || 0,
                sgst_per: config.sgst_percentage || 0, cgst_per: config.cgst_percentage || 0,
                igst_per: config.igst_percentage || 0, tcs_per: config.tcs_percentage || 0,
                discount_percentage: 0, other_amt: 0, freight_amt: 0
            };
        });
        setGridRows(runCalculations([...gridRows, ...newRows], formData.invoice_type_id));
        e.target.value = "";
    };

    const updateGrid = (idx, field, val) => {
        setGridRows(prev => {
            const updated = [...prev];
            updated[idx] = {
                ...updated[idx],
                [field]: val
            };
            return runCalculations(updated, formData.invoice_type_id);
        });
    };
    const handleSave = async () => {

        setSubmitLoading(true);

        try {

            const cleanForm = { ...formData };

            delete cleanForm.InvoiceDetails;
            delete cleanForm.Details;
            delete cleanForm.Party;
            delete cleanForm.Transport;
            delete cleanForm.Broker;

            const payload = {
                ...cleanForm,
                is_approved: true,   // AUTO APPROVAL
                Details: gridRows
            };

            let invoiceId;

            if (formData.id) {

                await transactionsAPI.invoices.update(formData.id, payload);
                invoiceId = formData.id;

            } else {

                const res = await transactionsAPI.invoices.create(payload);
                invoiceId = res.data.data?.id;

            }

            // 🔥 AUTO APPROVE AFTER SAVE
            if (invoiceId) {
                await transactionsAPI.invoices.approve(invoiceId);
            }

            // Refresh screen
            setIsModalOpen(false);
            await init();
            setGridRows([]);

        } catch (e) {

            console.error("Save error:", e);
            alert("Error saving invoice");

        } finally {

            setSubmitLoading(false);

        }
    };

    // Cleanup after print
    useEffect(() => {
        const afterPrint = () => setPrintData(null);
        window.addEventListener('afterprint', afterPrint);
        return () => window.removeEventListener('afterprint', afterPrint);
    }, []);

    return (
        <div className="min-h-screen bg-slate-100 p-6 font-sans text-slate-800">
            {/* Dashboard View */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3"><FileText className="text-blue-600" /> Dashboard</h1>
                <button onClick={() => { setFormData({ ...emptyInvoice, invoice_no: (listData.history.length + 1).toString() }); setGridRows([]); setIsModalOpen(true); }} className="bg-blue-600 text-white px-8 py-2 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all uppercase text-xs flex items-center gap-2"><Plus size={18} /> New Invoice</button>
            </div>
            {/* SEARCH FILTER BAR */}
            <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm mb-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">

                    {/* FIELD */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                            Search Field
                        </label>
                        <select
                            value={searchField}
                            onChange={(e) => setSearchField(e.target.value)}
                            className="w-full border border-slate-300 p-2 text-xs font-bold rounded"
                        >
                            <option value="invoice_no">Invoice No</option>
                            <option value="date">Date</option>
                            <option value="party">Party</option>
                            <option value="status">Status</option>
                        </select>
                    </div>

                    {/* CONDITION */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
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
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                            Search Value
                        </label>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            className="w-full border border-slate-300 p-2 text-xs font-bold rounded"
                        />
                    </div>

                    {/* CLEAR */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSearchValue('')}
                            className="flex-1 border border-slate-300 py-2 text-xs font-bold rounded hover:bg-gray-50"
                        >
                            Clear
                        </button>

                        <div className="flex-1 bg-blue-50 text-blue-700 border border-blue-200 py-2 rounded text-xs font-bold flex items-center justify-center">
                            {filteredInvoices.length} Matches
                        </div>
                    </div>

                </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-blue-700 text-white text-[10px] uppercase font-black tracking-widest">
                        <tr><th className="p-6">InvoiceNo</th><th className="p-6">Date</th><th className="p-6">Party</th></tr>
                    </thead>
                    <tbody className="divide-y text-sm font-mono">
                        {filteredInvoices.map(item => (
                            <tr
                                key={item.id}
                                className="hover:bg-blue-50 cursor-pointer"
                                onClick={async () => {
                                    try {
                                        const res = await transactionsAPI.invoices.getById(item.id);
                                        const invoice = res.data.data;
                                        const party = invoice.Party;
                                        

                                        setFormData({
                                            ...invoice,
                                            addr1: invoice.addr1 || party?.addr1 || '',
                                            addr2: invoice.addr2 || party?.addr2 || '',
                                            addr3: invoice.addr3 || party?.addr3 || ''
                                        });

                                        const details =
                                            invoice.InvoiceDetails ||
                                            invoice.Details ||
                                            invoice.details ||
                                            [];

                                        setGridRows(
                                            runCalculations(
                                                details,
                                                invoice.invoice_type_id,
                                                invoice.freight_charges
                                            )
                                        );

                                        setIsModalOpen(true);

                                    } catch (err) {
                                        console.error("Error loading invoice:", err);
                                    }
                                }}
                            >
                                <td className="p-6 font-bold text-blue-600">
                                    {item.invoice_no}
                                </td>

                                <td className="p-6">{item.date}</td>

                                <td className="p-6 font-bold uppercase">
                                    {item.Party?.account_name}
                                </td>




                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* PREPARATION MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-[1150px] flex flex-col overflow-hidden border border-slate-300 h-[96vh]">

                        {/* <div className="bg-white p-2 border-b border-slate-300 flex justify-between items-center shadow-sm">
                            <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><Layers size={16}/> Invoice Preparation</span>
                            <button onClick={() => setIsModalOpen(false)} className="text-white bg-red-500 hover:bg-red-600 px-2 rounded font-bold">×</button>
                        </div> */}

                        <div className="bg-[#5A8DEE] p-3 text-white">
                            <h2 className="text-base font-bold">Invoice</h2>
                            <p className="text-[11px] opacity-90 uppercase font-bold tracking-widest">To Add, Modify Invoice details.</p>
                        </div>

                        <div className="flex bg-[#D9E5F7] pt-2 px-4 gap-1">
                            {['head', 'detail'].map(t => (
                                <button key={t} onClick={() => setActiveTab(t)} className={`px-5 py-1.5 text-xs font-bold border border-b-0 rounded-t-md transition-all ${activeTab === t ? 'bg-white text-blue-700 border-slate-400 shadow-sm' : 'bg-[#EBF2FA] text-slate-500 border-slate-300'}`}>
                                    {t.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 bg-white mx-4 mb-4 border border-slate-400 p-5 overflow-hidden flex flex-col">
                            {activeTab === 'head' ? (
                                <div className="grid grid-cols-12 gap-6 h-full overflow-y-auto">
                                    <div className="col-span-8 space-y-2.5">
                                        <div className="flex items-center gap-2">
                                            <RowInput label="Invoice No." value={formData.invoice_no} readOnly width="w-32" color="bg-[#F5F8FA]" />
                                            <RowSelect label="Load No" value={formData.load_id} options={listData.loads.map(l => ({ value: l.id, label: l.load_no }))} onChange={e => handleLoadSync(e.target.value)} width="w-44" />
                                        </div>
                                        <RowInput label="Date" type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} width="w-44" />
                                        <RowSelect label="Sales Type" value={formData.sales_type} options={[{ value: 'GST SALES', label: 'GST SALES' }, { value: 'DEPOT SALES', label: 'DEPOT SALES' }, { value: 'DIRECT SALES', label: 'DIRECT SALES' }]} onChange={e => setFormData({ ...formData, sales_type: e.target.value })} />
                                        <RowSelect label="Invoice Type" value={formData.invoice_type_id} options={listData.types.map(t => ({ value: t.id, label: t.type_name }))} onChange={e => setFormData({ ...formData, invoice_type_id: e.target.value })} />
                                        <RowSelect label="Party name" value={formData.party_id} options={listData.parties.map(p => ({ value: p.id, label: p.account_name }))} onChange={e => handleAccountSync(e.target.value)} />
                                        <div className="flex flex-col gap-1 ml-[120px]">
                                            <input readOnly value={formData.addr1} className="border border-slate-300 p-1 text-[11px] bg-[#F5F8FA] font-bold outline-none" />
                                            <input readOnly value={formData.addr2} className="border border-slate-300 p-1 text-[11px] bg-[#F5F8FA] font-bold outline-none" />
                                            <input readOnly value={formData.addr3} className="border border-slate-300 p-1 text-[11px] bg-[#F5F8FA] font-bold outline-none" />
                                        </div>
                                        <div className="flex items-center gap-8 ml-[120px] py-1">
                                            <div className="flex items-center gap-2"><span className="text-[11px] font-bold text-slate-700">Credit days</span><input type="number" className="border border-slate-300 w-16 p-1 text-xs font-black" value={formData.credit_days} onChange={e => setFormData({ ...formData, credit_days: e.target.value })} /></div>
                                            <div className="flex items-center gap-2"><span className="text-[11px] font-bold text-slate-700">Interest %</span><input type="number" className="border border-slate-300 w-16 p-1 text-xs font-black" value={formData.interest_percentage} onChange={e => setFormData({ ...formData, interest_percentage: e.target.value })} /></div>
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
                                        <RowSelect label="Transport" value={formData.transport_id} options={listData.transports.map(t => ({ value: t.id, label: t.transport_name }))} disabled />
                                        <div className="grid grid-cols-2 gap-4">
                                            <RowInput label="LR No." value={formData.lr_no} readOnly />                                            <RowInput label="Delivery" value={formData.delivery} readOnly />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <RowInput label="LR Date" type="date" value={formData.lr_date} readOnly />
                                            <RowInput label="E-Bill" value={formData.ebill_no} onChange={e => setFormData({ ...formData, ebill_no: e.target.value })} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <RowInput label="Vehicle No." value={formData.vehicle_no} readOnly />
                                            <RowInput label="Remarks" value={formData.remarks} onChange={e => setFormData({ ...formData, remarks: e.target.value })} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <RowInput label="Removal Time" type="text" value={formData.removal_time} onChange={e => setFormData({ ...formData, removal_time: e.target.value })} />
                                            <RowSelect label="PayMode" value={formData.pay_mode} options={[{ value: 'CREDIT', label: 'CREDIT' }, { value: 'CASH', label: 'CASH' }]} onChange={e => setFormData({ ...formData, pay_mode: e.target.value })} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <RowInput label="Prepare Time" type="text" value={formData.prepare_time} onChange={e => setFormData({ ...formData, prepare_time: e.target.value })} />
                                            <RowInput label="Form JJ" value={formData.form_j} onChange={e => setFormData({ ...formData, form_j: e.target.value })} width="w-24" />
                                        </div>
                                        <RowInput label="Sales Against" value={formData.sales_against} onChange={e => setFormData({ ...formData, sales_against: e.target.value })} color="bg-rose-50" />
                                        <RowInput label="EPCG No" value={formData.epcg_no} onChange={e => setFormData({ ...formData, epcg_no: e.target.value })} />
                                    </div>
                                    <div className="col-span-4 bg-[#F5F8FA] border border-slate-300 p-4 flex flex-col gap-1 rounded shadow-inner">
                                        <h3 className="text-xs font-black text-slate-500 mb-2 border-b border-slate-300 pb-1 uppercase tracking-tight">Invoice Value</h3>
                                        <TotalRow label="Assessable Value" value={formData.total_assessable} />
                                        <TotalRow label="Charity" value={formData.total_charity} />
                                        <TotalRow label="VAT Tax" value={formData.total_vat} />
                                        <TotalRow label="Cenvat" value={formData.total_cenvat} />
                                        <TotalRow label="Duty" value={formData.total_duty} />
                                        <TotalRow label="Cess" value={formData.total_cess} />
                                        <TotalRow label="H.S.Cess" value={formData.total_hr_sec_cess} />
                                        <TotalRow label="TCS" value={formData.total_tcs} />
                                        <TotalRow label="Freight" value={formData.freight_charges} />
                                        <TotalRow label="Others" value={formData.total_other} />
                                        <TotalRow label="GST" value={formData.total_gst} />
                                        <TotalRow label="IGST" value={formData.total_igst} />
                                        <div className="mt-auto pt-4 border-t-2 border-slate-400 space-y-1.5">
                                            <TotalRow label="Sub Total" value={formData.sub_total} />
                                            <TotalRow label="Round off" value={formData.round_off} />
                                            <div className="flex justify-between items-center py-2 px-2 bg-white border border-slate-400 mt-2 shadow-sm">
                                                <span className="text-[11px] font-black uppercase text-slate-700">Invoice Value</span>
                                                <span className="text-xl font-black font-mono text-blue-700">₹ {parseFloat(formData.net_amount).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* TAB 2: DETAIL MATRIX */
                                <div className="space-y-4 h-full flex flex-col overflow-hidden">
                                    <div className="bg-[#EBF2FA] p-3 border border-slate-300 flex items-center justify-between rounded shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[11px] font-black text-slate-700">Select with order No.</span>
                                            <select className="border border-slate-300 text-xs p-1 min-w-[180px] font-black outline-none" onChange={handleOrderSync}>
                                                <option value="">-- Order No --</option>
                                                {listData.orders.map(o => <option key={o.id} value={`WITH|${o.order_no}`}>{o.order_no}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[11px] font-black text-slate-700">Select without order No.</span>
                                            <select className="border border-slate-300 text-xs p-1 min-w-[180px] font-black outline-none" onChange={handleOrderSync}>
                                                <option value="">-- Direct Doc --</option>
                                                {listData.directOrders.map(o => <option key={o.id} value={`WITHOUT|${o.order_no}`}>{o.order_no}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex-1 border border-slate-300 overflow-x-auto bg-[#F5F8FA]">
                                        <table className="min-w-[8500px] text-[11px] border-collapse bg-white">
                                            <thead className="bg-[#F5F8FA] sticky top-0 z-10 border-b border-slate-300 text-slate-600">
                                                <tr>
                                                    <th className="p-3 border-r w-10"></th>
                                                    <th className="p-3 border-r w-32 text-left">OrderNo</th>
                                                    <th className="p-3 border-r w-80 text-left">Product</th>
                                                    <th className="p-3 border-r w-32 text-left">Broker Code</th>
                                                    <th className="p-3 border-r w-24 text-center">Broker %</th>
                                                    <th className="p-3 border-r w-24 text-center">Packs</th>
                                                    <th className="p-3 border-r w-32 text-center">Packing Type</th>
                                                    <th className="p-3 border-r w-24 text-center">From No</th>
                                                    <th className="p-3 border-r w-24 text-center">To No</th>
                                                    <th className="p-3 border-r w-32 text-center">Total Kgs</th>
                                                    <th className="p-3 border-r w-24 text-center">Avg Content</th>
                                                    <th className="p-3 border-r w-32 text-center">Rate</th>
                                                    <th className="p-3 border-r w-24 text-center">Rate Per</th>
                                                    <th className="p-3 border-r w-36 text-center bg-blue-50 text-blue-800">Base [H]</th>
                                                    <th className="p-3 border-r w-32 text-center bg-indigo-50 text-indigo-800">Resale (-)</th>
                                                    <th className="p-3 border-r w-32 text-center bg-indigo-50 text-indigo-800">Hank (+)</th>
                                                    <th className="p-3 border-r w-32 text-center bg-indigo-50 text-indigo-800">Cone Adjust (-)</th>
                                                    <th className="p-3 border-r w-40 text-center bg-blue-100 text-blue-900 font-black">Assess [A]</th>
                                                    <th className="p-3 border-r w-32 text-center">Charity</th>
                                                    <th className="p-3 border-r w-24 text-center bg-slate-100">VAT%</th><th className="p-3 border-r w-32 text-center bg-slate-50">VAT Amt</th>
                                                    <th className="p-3 border-r w-24 text-center bg-slate-100">CENVAT%</th><th className="p-3 border-r w-32 text-center bg-slate-50">CENVAT Amt</th>
                                                    <th className="p-3 border-r w-24 text-center bg-slate-100">DUTY%</th><th className="p-3 border-r w-32 text-center bg-slate-50">DUTY Amt</th>
                                                    <th className="p-3 border-r w-24 text-center bg-slate-100">CESS%</th><th className="p-3 border-r w-32 text-center bg-slate-50">CESS Amt</th>
                                                    <th className="p-3 border-r w-24 text-center bg-slate-100">H.CESS%</th><th className="p-3 border-r w-32 text-center bg-slate-50">H.CESS Amt</th>
                                                    <th className="p-3 border-r w-24 text-center bg-slate-100">SGST%</th><th className="p-3 border-r w-32 text-center bg-slate-50">SGST Amt</th>
                                                    <th className="p-3 border-r w-24 text-center bg-slate-100">CGST%</th><th className="p-3 border-r w-32 text-center bg-slate-50">CGST Amt</th>
                                                    <th className="p-3 border-r w-24 text-center bg-slate-100">IGST%</th><th className="p-3 border-r w-32 text-center bg-slate-50">IGST Amt</th>
                                                    <th className="p-3 border-r w-24 text-center bg-slate-100">TCS%</th><th className="p-3 border-r w-32 text-center bg-slate-50">TCS Amt</th>
                                                    <th className="p-3 border-r w-24 text-center bg-rose-50 text-rose-800">Disc% (Edit)</th><th className="p-3 border-r w-36 text-center bg-rose-50 text-rose-800">Disc Amt</th>
                                                    <th className="p-3 border-r w-32 text-center">Other Amt</th>
                                                    <th className="p-3 border-r w-32 text-center">Freight Amt</th>
                                                    <th className="p-3 border-r w-80 text-center">ID Mark</th>
                                                    <th className="p-3 text-center w-24"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {gridRows.map((r, i) => (
                                                    <tr key={i} className="hover:bg-blue-50 font-black">
                                                        <td className="p-2 border-r text-center text-slate-300">▶</td>
                                                        <td className="p-2 border-r text-blue-700">{r.order_no}</td>
                                                        <td className="p-2 border-r uppercase text-slate-800">{r.product_description}</td>
                                                        <td className="p-1 border-r"><input type="text" className="w-full p-2 outline-none" value={r.broker_code} onChange={e => updateGrid(i, 'broker_code', e.target.value)} /></td>
                                                        <td className="p-1 border-r"><input type="number" className="w-full p-2 text-center outline-none text-amber-600" value={r.broker_percentage} onChange={e => updateGrid(i, 'broker_percentage', e.target.value)} /></td>
                                                        <td className="p-2 border-r bg-[#FFD1FF] text-center font-black">{r.packs}</td>
                                                        <td className="p-2 border-r text-center uppercase">{r.packing_type}</td>
                                                        <td className="p-1 border-r"><input type="text" className="w-full p-2 text-center outline-none" value={r.from_no} onChange={e => updateGrid(i, 'from_no', e.target.value)} /></td>
                                                        <td className="p-1 border-r"><input type="text" className="w-full p-2 text-center outline-none" value={r.to_no} onChange={e => updateGrid(i, 'to_no', e.target.value)} /></td>
                                                        <td className="p-2 border-r text-center text-blue-700 font-black">{r.total_kgs}</td>
                                                        <td className="p-2 border-r text-center">{r.avg_content}</td>
                                                        <td className="p-2 border-r text-center">₹{r.rate}</td>
                                                        <td className="p-1 border-r"><input type="text" className="w-full p-2 text-center outline-none" value={r.rate_per} onChange={e => updateGrid(i, 'rate_per', e.target.value)} /></td>
                                                        <td className="p-2 border-r text-center bg-blue-50 text-blue-600">₹{num(r.base_h).toFixed(2)}</td>

                                                        <td className="p-1 border-r bg-indigo-50"><input type="number" className="w-full p-2 text-center outline-none bg-white rounded border border-indigo-100" value={r.resale} onChange={e => updateGrid(i, 'resale', parseFloat(e.target.value) || 0)} /></td>
                                                        <td className="p-1 border-r bg-indigo-50"><input type="number" className="w-full p-2 text-center outline-none bg-white rounded border border-indigo-100" value={r.convert_to_hank} onChange={e => updateGrid(i, 'convert_to_hank', parseFloat(e.target.value) || 0)} /></td>
                                                        <td className="p-1 border-r bg-indigo-50"><input type="number" className="w-full p-2 text-center outline-none bg-white rounded border border-indigo-100" value={r.convert_to_cone} onChange={e => updateGrid(i, 'convert_to_cone', parseInt(e.target.value) || 0)} /></td>

                                                        <td className="p-2 border-r text-center bg-blue-100 text-blue-900 font-black">₹{num(r.assessable_value).toFixed(2)}</td>
                                                        <td className="p-2 border-r text-center font-bold text-orange-600">₹{num(r.charity_amt).toFixed(2)}</td>

                                                        {renderPairCell(r, i, 'vat_per', 'vat_amt', false, updateGrid)}
                                                        {renderPairCell(r, i, 'cenvat_per', 'cenvat_amt', false, updateGrid)}
                                                        {renderPairCell(r, i, 'duty_per', 'duty_amt', false, updateGrid)}
                                                        {renderPairCell(r, i, 'cess_per', 'cess_amt', false, updateGrid)}
                                                        {renderPairCell(r, i, 'hcess_per', 'hr_sec_cess_amt', false, updateGrid)}
                                                        {renderPairCell(r, i, 'sgst_per', 'sgst_amt', false, updateGrid)}
                                                        {renderPairCell(r, i, 'cgst_per', 'cgst_amt', false, updateGrid)}
                                                        {renderPairCell(r, i, 'igst_per', 'igst_amt', false, updateGrid)}
                                                        {renderPairCell(r, i, 'tcs_per', 'tcs_amt', false, updateGrid)}
                                                        {renderPairCell(r, i, 'discount_percentage', 'discount_amt', true, updateGrid, "text-rose-600")}

                                                        <td className="p-1 border-r"><input type="number" className="w-full p-2 text-center outline-none" value={r.other_amt} onChange={e => updateGrid(i, 'other_amt', parseFloat(e.target.value) || 0)} /></td>
                                                        <td className="p-1 border-r"><input type="number" className="w-full p-2 text-center outline-none" value={r.freight_amt} onChange={e => updateGrid(i, 'freight_amt', parseFloat(e.target.value) || 0)} /></td>
                                                        <td className="p-1 border-r"><input type="text" className="w-full p-2 text-xs border rounded font-black uppercase text-center" value={r.identification_mark} onChange={e => updateGrid(i, 'identification_mark', e.target.value)} /></td>
                                                        <td className="p-2 text-center"><button onClick={() => setGridRows(gridRows.filter((_, idx) => idx !== i))}><MinusCircle size={22} className="text-red-500 hover:scale-110 transition-transform" /></button></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-[#D9E5F7] p-4 border-t border-slate-400 flex justify-between items-center shadow-lg">
                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={formData.is_approved} onChange={e => setFormData({ ...formData, is_approved: e.target.checked })} className="w-4 h-4" />
                                <span className="text-xs font-black text-blue-800">Approval</span>
                            </div>
                            <div className="flex gap-1.5">
                                <FooterBtn icon={<FileText size={14} />} label="Form JJ" />
                                <FooterBtn icon={<Layers size={14} />} label="GC" />
                                <FooterBtn icon={<Activity size={14} />} label="Lap Yarn" />
                                <FooterBtn icon={<Hash size={14} />} label="GST" />
                                <FooterBtn icon={<Database size={14} />} label="A4" />
                                <FooterBtn icon={<Printer size={14} />} label="Report [A80]" />
                                <FooterBtn icon={<Calculator size={14} />} label="JSON" />
                            </div>
                            <div className="flex gap-3">

                                {/* EXPORT PDF BUTTON */}
                                <button
                                    onClick={exportToPDF}
                                    disabled={gridRows.length === 0}
                                    className="bg-emerald-600 text-white border border-emerald-700 px-6 py-2 text-xs font-black uppercase hover:bg-emerald-700 shadow-md transition-all rounded flex items-center gap-2"
                                >
                                    <FileText size={16} /> Download Professional TAX INVOICE
                                </button>

                                {/* UPDATE BUTTON */}
                                <button
                                    onClick={handleSave}
                                    disabled={submitLoading}
                                    className="bg-white border border-slate-400 px-10 py-2 text-xs font-black flex items-center gap-2 hover:bg-green-50 shadow-sm transition-all rounded"
                                >
                                    <Save size={16} className="text-blue-700" />
                                    {submitLoading ? 'Saving...' : 'Update'}
                                </button>

                                {/* CANCEL BUTTON */}
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="bg-white border border-slate-400 px-10 py-2 text-xs font-black flex items-center gap-2 hover:bg-red-50 shadow-sm transition-all rounded"
                                >
                                    <X size={16} className="text-red-600" /> Cancel
                                </button>

                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PRINT CONTAINER - OFF-SCREEN BUT VISIBLE TO PRINTER (FIXES WHITE SHEET) */}
            {printData && (
                <div id="printable-invoice-wrapper">
                    <ModernPrintView data={printData} listData={listData} getHSN={getHSN} />
                </div>
            )}

            {/* PRINT STYLES - CLEAN A4 BILL ONLY */}
            <style>{`
                @media print {

  body * {
      display: none !important;
  }

  #printable-invoice-wrapper,
  #printable-invoice-wrapper * {
      display: block !important;
  }

  #printable-invoice-wrapper {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      background: white;
  }

  @page {
      size: A4;
      margin: 10mm;
  }

}
            `}</style>
        </div>
    );
};

// ==========================================
// ERP HELPER COMPONENTS
// ==========================================
const RowInput = ({ label, width = "w-full", color = "bg-white", ...props }) => (
    <div className="flex items-center">
        <label className="w-[120px] text-[11px] font-black text-slate-700">{label}</label>
        <input {...props} className={`border border-slate-300 p-1 text-[11px] font-black outline-none focus:border-blue-500 shadow-inner ${width} ${color}`} />
    </div>
);

const RowSelect = ({ label, options, width = "w-full", ...props }) => (
    <div className="flex items-center">
        <label className="w-[120px] text-[11px] font-black text-slate-700">{label}</label>
        <select {...props} className={`border border-slate-300 p-1 text-[11px] font-black outline-none focus:border-blue-500 ${width}`}>
            <option value="">-- Select --</option>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    </div>
);
const TotalRow = ({ label, value }) => {

    const displayValue =
        value === '' || value === null || value === undefined
            ? ''
            : Number(value).toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            });

    return (
        <div className="flex justify-between items-center text-[11px] py-0.5 px-1 hover:bg-white rounded">
            <span className="font-black text-slate-500 uppercase tracking-tighter">
                {label}
            </span>
            <input
                readOnly
                value={displayValue}
                className="w-28 border border-slate-300 text-right p-0.5 font-mono bg-white outline-none font-black shadow-inner"
            />
        </div>
    );
};

const FooterBtn = ({ label, icon }) => (
    <button className="bg-white border border-slate-400 px-3 py-1.5 text-[10px] font-black flex items-center gap-1.5 hover:bg-slate-50 shadow-sm transition-colors">
        <span className="text-blue-700">{icon}</span> {label}
    </button>
);

const renderPairCell = (row, idx, perKey, amtKey, isEditable, updateGrid, color = "text-blue-600") => (
    <>
        <td className="p-1 border-r text-slate-400">
            <input
                type="number" step="0.01"
                disabled={!isEditable}
                className={`w-full p-2 text-center font-black border rounded bg-white outline-none focus:border-blue-500 ${color} disabled:bg-slate-50 disabled:border-none`}
                value={row[perKey] || 0}
                onChange={(e) => updateGrid(idx, perKey, e.target.value)}
            />
        </td>
        <td className={`p-2 border-r text-center font-black bg-slate-50 ${color}`}>
            {parseFloat(row[amtKey] || 0).toFixed(2)}
        </td>
    </>
);

export default InvoicePreparation;