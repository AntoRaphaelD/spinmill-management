import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { mastersAPI, transactionsAPI } from '../service/api';
import {
    Save, FileText, Calculator, RefreshCw, X, Plus,
    Database, MinusCircle, Box, Layers, Activity, Lock,
    ShoppingCart, ChevronDown, Clock, Truck, User,
    Search, Hash, Info, MapPin, Printer, FileJson,
    ChevronLeft, ChevronRight
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
                        {data.addr1}<br />
                        {data.addr2}<br />
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
        sales_type: 'GST SALES', invoice_type_id: '', party_id: '', addr1: '', addr2: '', addr3: '', del1: '', del2: '', del3: '',
        credit_days: 0, interest_percentage: 0, transport_id: '', lr_no: '',
        delivery: '', lr_date: new Date().toISOString().split('T')[0], ebill_no: '',
        vehicle_no: '', remarks: '', removal_time: '12:00', prepare_time: '12:00',
        pay_mode: 'CREDIT', form_j: '', sales_against: '', epcg_no: '', broker_id: '', is_approved: false,
        // Header Totals
        total_assessable: 0, total_charity: 0, total_vat: 0, total_cenvat: 0,
        total_duty: 0, total_cess: 0, total_hr_sec_cess: 0, total_tcs: 0,
        total_gst: 0, total_sgst: 0, total_cgst: 0, total_igst: 0, total_discount: 0, total_broker: 0,
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
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    // ==========================================
    // SEARCH FILTER ENGINE
    // ==========================================
    // Filter Invoice Types with Exclusion Logic to prevent overlap
    const filteredInvoiceTypes = useMemo(() => {
        // If no sales type is selected in the header, hide all invoice types
        if (!formData.sales_type) return [];

        return listData.types.filter(type => {
            // This matches the 'sales_type' field from your tbl_InvoiceTypes model
            // directly against the 'sales_type' selected on the screen.
            return String(type.sales_type).trim().toUpperCase() === String(formData.sales_type).trim().toUpperCase();
        });
    }, [listData.types, formData.sales_type]);
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

    const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage) || 1;
    const currentItems = filteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchField, searchCondition, searchValue]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

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
        const pageHeight = doc.internal.pageSize.getHeight();
        const left = 14;
        const right = pageWidth - 14;
        const top = 8;
        const contentWidth = right - left;
        const fmt = (v, digits = 2) => num(v).toLocaleString('en-IN', {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        });
        const text = (value) => String(value || '');
        const party = listData.parties.find(p => String(p.id) === String(data.party_id)) || data.Party || {};
        const cgstPer = rows.find(r => num(r.cgst_per) > 0)?.cgst_per || 0;
        const sgstPer = rows.find(r => num(r.sgst_per) > 0)?.sgst_per || 0;
        const igstPer = rows.find(r => num(r.igst_per) > 0)?.igst_per || 0;

        doc.setTextColor(0);
        doc.setDrawColor(0);
        doc.setLineWidth(0.25);
        doc.rect(left, top, contentWidth, pageHeight - 16);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("TAX INVOICE", pageWidth / 2, 28, { align: "center" });

        let copyY = 18;
        ["ORIGINAL FOR BUYER", "DUPLICATE FOR TRANSPORTER", "TRIPLICATE FOR FILE COPY", "EXTRA COPY"].forEach(label => {
            doc.rect(right - 58, copyY - 3.5, 4, 4);
            doc.setFontSize(6.5);
            doc.text(label, right - 52, copyY);
            copyY += 5;
        });

        const companyTop = 40;
        const companyHeight = 57;
        const certX = right - 45;
        doc.rect(left + 6, companyTop, contentWidth - 12, companyHeight);
        doc.line(certX, companyTop, certX, companyTop + companyHeight - 9);
        doc.line(left + 6, companyTop + companyHeight - 9, right - 6, companyTop + companyHeight - 9);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("KAYAAR EXPORTS PRIVATE LIMITED", (left + certX) / 2, companyTop + 7, { align: "center" });
        doc.setFontSize(7.2);
        [
            "D.No: 43/5, Railway Feeder Road,",
            "K.R. Nagar - 628 503, Kovilpatti - Taluk",
            "Tuticorin Dist., Tamilnadu, India",
            "(04632) - 248258, 9443238761",
            "E-Mail : ttnkrgroup@gmail.com",
            "GSTIN : 33AAACK4468M1ZA"
        ].forEach((line, idx) => {
            doc.text(line, (left + certX) / 2, companyTop + 13 + (idx * 5), { align: "center" });
        });

        doc.setFontSize(6.2);
        doc.text("OEKO-TEX (R)", certX + 22, companyTop + 6, { align: "center" });
        doc.text("CONFIDENCE IN TEXTILES", certX + 22, companyTop + 10, { align: "center" });
        doc.setFontSize(8);
        doc.text("STANDARD 100", certX + 22, companyTop + 17, { align: "center" });
        doc.setFontSize(6.2);
        doc.text("18.HIN.60427 HOHENSTEIN HTTI", certX + 22, companyTop + 22, { align: "center" });
        doc.setFontSize(5.8);
        doc.text("Tested for harmful substances", certX + 22, companyTop + 34, { align: "center" });
        doc.text("www.oeko-tex.com/standard100", certX + 22, companyTop + 38, { align: "center" });

        doc.setFontSize(6.7);
        doc.text("PAN : AAACK4468M", left + 9, companyTop + companyHeight - 3);
        doc.text("CIN : U51101TN1991PTC020933", right - 9, companyTop + companyHeight - 3, { align: "right" });

        const partyTop = companyTop + companyHeight;
        const partyHeight = 55;
        const midX = left + contentWidth * 0.58;
        doc.rect(left + 6, partyTop, contentWidth - 12, partyHeight);
        doc.line(midX, partyTop, midX, partyTop + partyHeight);

        doc.setFontSize(7.2);
        doc.setFont("helvetica", "bold");
        doc.text("Party Name & Address", left + 9, partyTop + 8);
        doc.setFontSize(8);
        doc.text(text(party.account_name || data.party_name).toUpperCase(), left + 14, partyTop + 17);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        const addressLines = [data.addr1, data.addr2, data.addr3].filter(Boolean);
        addressLines.forEach((line, idx) => doc.text(text(line).toUpperCase(), left + 14, partyTop + 25 + (idx * 6)));
        doc.setFont("helvetica", "bold");
        doc.text(`GST No: ${party.gst_no || data.gst_no || 'N/A'}`, left + 14, partyTop + 47);

        const infoRows = [
            ["Invoice No", data.invoice_no],
            ["Invoice Dt", data.date],
            ["E-Way Bill No", data.ebill_no || "PENDING"],
            ["Vehicle No", data.vehicle_no || "N/A"],
            ["Delivery At", data.delivery || "MUMBAI"]
        ];
        infoRows.forEach(([label, value], idx) => {
            const y = partyTop + 12 + (idx * 8);
            doc.setFont("helvetica", "bold");
            doc.text(label, midX + 8, y);
            doc.text(":", midX + 35, y);
            doc.text(text(value).toUpperCase(), midX + 44, y);
        });

        const tableStartY = partyTop + partyHeight;
        autoTable(doc, {
            startY: tableStartY,
            margin: { left: left + 6, right: left + 6 },
            tableWidth: contentWidth - 12,
            head: [
                [{ content: "DESCRIPTION OF GOODS", colSpan: 6, styles: { halign: "center", fontStyle: "bold" } }],
                ["No of Bags", "Net Weight", "S.L No", "Rate Per Kgs", "Assessable Value"]
            ],
            body: rows.map(r => [
                fmt(r.packs, 0),
                fmt(r.total_kgs, 2),
                `${text(r.from_no)} - ${text(r.to_no)}`.trim(),
                fmt(r.rate, 2),
                fmt(r.assessable_value, 2)
            ]),
            theme: "grid",
            styles: {
                font: "helvetica",
                fontSize: 7,
                textColor: 0,
                lineColor: 0,
                lineWidth: 0.2,
                cellPadding: 2,
                valign: "middle"
            },
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: 0,
                lineColor: 0,
                lineWidth: 0.2,
                fontSize: 7,
                fontStyle: "bold"
            },
            columnStyles: {
                0: { cellWidth: 24, halign: "center" },
                1: { cellWidth: 28, halign: "center" },
                2: { cellWidth: 54, halign: "center" },
                3: { cellWidth: 34, halign: "right" },
                4: { cellWidth: 30, halign: "right" }
            }
        });

        let y = doc.lastAutoTable.finalY;
        const detailHeight = Math.max(44, 22 + (rows.length * 8));
        const footerTop = Math.min(y, 245);
        doc.rect(left + 6, footerTop, contentWidth - 12, detailHeight);
        doc.line(midX, footerTop, midX, footerTop + detailHeight);
        doc.line(right - 44, footerTop, right - 44, footerTop + detailHeight);

        const description = rows.map(r => text(r.product_description).toUpperCase()).filter(Boolean).join(", ");
        const hsnCodes = [...new Set(rows.map(r => getHSN(r.product_id)).filter(Boolean))].join(", ");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text(doc.splitTextToSize(description || "GOODS", midX - left - 17), left + 9, footerTop + 8);
        doc.text(`HSN CODE: ${hsnCodes || "-"}`, left + 9, footerTop + 31);
        doc.text("-", left + 9, footerTop + 38);

        const totalLines = [
            ["CHARITY", fmt(data.total_charity, 2)],
            ["FREIGHT", fmt(data.freight_charges, 2)],
            [`C.G.S.T    ${fmt(cgstPer, 2)} %`, fmt(data.total_cgst, 2)],
            [`S.G.S.T    ${fmt(sgstPer, 2)} %`, fmt(data.total_sgst, 2)],
            [`I.G.S.T    ${fmt(igstPer, 2)} %`, fmt(data.total_igst, 2)],
            ["TCS", fmt(data.total_tcs, 2)],
            ["ROUND OFF", fmt(data.round_off, 2)]
        ].filter(([, value], idx) => idx < 2 || num(value.replace(/,/g, '')) !== 0);

        totalLines.forEach(([label, value], idx) => {
            const lineY = footerTop + 8 + (idx * 6);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.text(label, midX + 5, lineY);
            doc.setFont("helvetica", "bold");
            doc.text(value, right - 9, lineY, { align: "right" });
        });

        const amountTop = footerTop + detailHeight;
        doc.rect(left + 6, amountTop, contentWidth - 12, 20);
        doc.line(right - 60, amountTop, right - 60, amountTop + 20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("Amount Chargeable (in words)", left + 9, amountTop + 6);
        doc.setFontSize(7);
        doc.text(doc.splitTextToSize(numberToWords(num(data.net_amount)), 115), left + 9, amountTop + 13);
        doc.setFontSize(9);
        doc.text("NET AMOUNT", right - 57, amountTop + 8);
        doc.setFontSize(11);
        doc.text(fmt(data.net_amount, 2), right - 9, amountTop + 15, { align: "right" });

        const signTop = amountTop + 20;
        doc.rect(left + 6, signTop, contentWidth - 12, 30);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.text("We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.", left + 9, signTop + 7);
        doc.setFont("helvetica", "bold");
        doc.text("For KAYAAR EXPORTS PRIVATE LIMITED", right - 9, signTop + 9, { align: "right" });
        doc.text("Authorised Signatory", right - 9, signTop + 25, { align: "right" });

        doc.save(`Kayaar_TAX_INVOICE_${data.invoice_no}.pdf`);
    };
    const exportToJSON = () => {
        // 1. Prepare the data object
        const exportData = {
            ...formData,
            Details: gridRows // Include the line items
        };

        // 2. Convert to JSON string (with 2-space indentation for readability)
        const jsonString = JSON.stringify(exportData, null, 2);

        // 3. Create a Blob from the JSON string
        const blob = new Blob([jsonString], { type: "application/json" });

        // 4. Create a temporary download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        // 5. Set the filename as [invoiceNumber].json
        const fileName = formData.invoice_no ? `${formData.invoice_no}.json` : 'invoice.json';

        link.href = url;
        link.download = fileName;

        // 6. Trigger the download and cleanup
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
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
    const runCalculations = useCallback((rows, typeId, hFreight = formData.freight_charges, salesType = formData.sales_type) => {
        if (!typeId) return rows;

        const config = listData.types.find(t => t.id === parseInt(typeId));
        if (!config) return rows;

        // 1. FLOW: Get Tax and TCS Percentages
        const gstPer = num(config.gst_percentage);
        const sgstPer = num(config.sgst_percentage);
        const cgstPer = num(config.cgst_percentage);
        const igstPer = num(config.igst_percentage);
        const cenvatPer = num(config.cenvat_percentage);
        const dutyPer = num(config.duty_percentage);
        const cessPer = num(config.cess_percentage);
        const hcessPer = num(config.hr_sec_cess_percentage);
        const tcsPer = num(config.tcs_percentage || 0);

        // Total tax percentage (Sum of SGST+CGST or just IGST)
        const splitGstPer = sgstPer + cgstPer;
        const taxPercentage = igstPer > 0 ? igstPer : (splitGstPer > 0 ? splitGstPer : gstPer);
        const displayGstPer = splitGstPer > 0 ? splitGstPer : gstPer;

        const totalBags = rows.reduce((sum, r) => sum + num(r.packs), 0);
        const freightPerBag = totalBags > 0 ? num(hFreight) / totalBags : 0;

        console.log(`%c >>> CALCULATION START [Tax: ${taxPercentage}%, TCS: ${tcsPer}%] <<< `, "background: #000; color: #fff;");

        let hTotals = {
            assess: 0, charity: 0, freight: 0, gst: 0, tcs: 0, gross: 0,
            cenvat: 0, duty: 0, cess: 0, hcess: 0, other: 0
        };

        const updatedRows = rows.map((item, idx) => {
            const packs = num(item.packs);
            const bagWt = num(item.avg_content);
            const existingTotalKgs = num(item.total_kgs);
            const rateInput = num(item.rate);
            const rowFreight = packs * freightPerBag;
            const productName = String(item.product_description || item.Product?.product_name || '').toLowerCase();
            const is68Product = productName.includes('68');

            // 2. FLOW: rate_after_tax
            const rateAfterTax = rateInput + (rateInput * taxPercentage / 100);

            // Keep the existing formula for 68 products; other products use packs x bag weight.
            const totalKgs = is68Product ? existingTotalKgs : (packs * bagWt);

            // 3. FLOW: total_invoice_amount (Inclusive of Tax)
            const rawTotalInvoiceAmount = is68Product
                ? (10 * packs * rateInput)
                : (totalKgs * rateInput);
            const totalInvoiceAmount = is68Product ? rawTotalInvoiceAmount : Math.round(rawTotalInvoiceAmount);

            // 4. FLOW: charity
            let charity = 0;
            const charityPerBale = salesType === 'GST SALES'
                ? 3
                : num(item.charity_per_bale || config.charity_value || 0);
            if (salesType === 'GST SALES') {
                charity = totalKgs * charityPerBale;
            } else {
                charity = totalInvoiceAmount * (charityPerBale / 100);
            }

            // 5. FLOW: divisor and base_amount (Back-calculating Taxable value)
            const taxDivisor = 1 + (taxPercentage / 100);
            const baseAmount = taxDivisor > 0 ? (totalInvoiceAmount / taxDivisor) : totalInvoiceAmount;

            // 6. FLOW: gst_amount
            const rawGstAmount = (baseAmount * taxPercentage) / 100;
            const gstAmount = is68Product ? rawGstAmount : Math.round(rawGstAmount);

            // 7. FLOW: TCS Amount (Calculated from Gross Invoice Amount)
            const tcsAmount = (totalInvoiceAmount * tcsPer) / 100;

            // 8. FLOW: accessible_value (Stripping components from Total)
            const rawAccessibleValue = totalInvoiceAmount - rowFreight - charity - gstAmount;
            const accessibleValue = is68Product ? rawAccessibleValue : Math.round(rawAccessibleValue);
            const vatPer = num(item.vat_per || config.vat_percentage);
            const cenvatRowPer = num(item.cenvat_per || cenvatPer);
            const dutyRowPer = num(item.duty_per || dutyPer);
            const cessRowPer = num(item.cess_per || cessPer);
            const hcessRowPer = num(item.hcess_per || hcessPer);
            const vatAmount = (accessibleValue * vatPer) / 100;
            const cenvatAmount = (accessibleValue * cenvatRowPer) / 100;
            const dutyAmount = (accessibleValue * dutyRowPer) / 100;
            const cessAmount = (accessibleValue * cessRowPer) / 100;
            const hcessAmount = (accessibleValue * hcessRowPer) / 100;
            const otherAmount = num(item.other_per) > 0
                ? (accessibleValue * num(item.other_per)) / 100
                : num(item.other_amt);

            hTotals.assess += accessibleValue;
            hTotals.charity += charity;
            hTotals.freight += rowFreight;
            hTotals.gst += gstAmount;
            hTotals.tcs += tcsAmount;
            hTotals.gross += totalInvoiceAmount;
            hTotals.vat = (hTotals.vat || 0) + vatAmount;
            hTotals.cenvat += cenvatAmount;
            hTotals.duty += dutyAmount;
            hTotals.cess += cessAmount;
            hTotals.hcess += hcessAmount;
            hTotals.other += otherAmount;

            return {
                ...item,
                total_kgs: money(totalKgs),
                charity_per_bale: money(charityPerBale),
                gst_per: displayGstPer,
                sgst_per: sgstPer,
                cgst_per: cgstPer,
                igst_per: igstPer,
                vat_per: vatPer,
                cenvat_per: cenvatRowPer,
                duty_per: dutyRowPer,
                cess_per: cessRowPer,
                hcess_per: hcessRowPer,
                tcs_per: tcsPer,
                charity_amt: money(charity),
                freight_amt: money(rowFreight),
                // Handle SGST/CGST split or IGST
                igst_amt: igstPer > 0 ? money(gstAmount) : 0,
                sgst_amt: sgstPer > 0 ? money(gstAmount / 2) : 0,
                cgst_amt: cgstPer > 0 ? money(gstAmount / 2) : 0,
                gst_amt: igstPer > 0 ? 0 : money(gstAmount),
                vat_amt: money(vatAmount),
                cenvat_amt: money(cenvatAmount),
                duty_amt: money(dutyAmount),
                cess_amt: money(cessAmount),
                hr_sec_cess_amt: money(hcessAmount),
                tcs_amt: money(tcsAmount),
                other_amt: money(otherAmount),
                assessable_value: money(accessibleValue),
                rounded_off: num(item.rounded_off || 0),
                final_value: money(totalInvoiceAmount)
            };
        });

        // 9. GRAND TOTAL (Net Amount): Gross Invoice Amount MINUS TCS
        const finalGross = hTotals.gross;
        const amountAfterTcs = finalGross - hTotals.tcs;
        const finalNetAmount = Math.round(amountAfterTcs);
        const calculatedRoundOff = finalNetAmount - amountAfterTcs;

        setFormData(prev => ({
            ...prev,
            total_assessable: money(hTotals.assess),
            total_charity: money(hTotals.charity),
            freight_charges: num(hFreight),
            // Display full GST amount as the combined CGST + SGST value.
            total_gst: igstPer > 0 ? 0 : money(hTotals.gst),
            total_igst: igstPer > 0 ? money(hTotals.gst) : 0,
            total_sgst: sgstPer > 0 ? money(hTotals.gst / 2) : 0,
            total_cgst: cgstPer > 0 ? money(hTotals.gst / 2) : 0,
            total_vat: money(hTotals.vat || 0),
            total_cenvat: money(hTotals.cenvat),
            total_duty: money(hTotals.duty),
            total_cess: money(hTotals.cess),
            total_hr_sec_cess: money(hTotals.hcess),
            total_tcs: money(hTotals.tcs),
            total_other: money(hTotals.other),
            sub_total: money(finalGross),
            // 🟢 Round off is calculated after TCS deduction
            round_off: money(calculatedRoundOff),
            net_amount: finalNetAmount
        }));


        return updatedRows;
    }, [listData.types, formData.freight_charges, formData.sales_type]);

    useEffect(() => {
        if (!formData.invoice_type_id || gridRows.length === 0) return;
        setGridRows(prev => runCalculations(prev, formData.invoice_type_id, formData.freight_charges, formData.sales_type));
    }, [formData.invoice_type_id, formData.sales_type, formData.freight_charges, runCalculations]);

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

    // FIX: Restoring missing handleLoadSync to stop the ReferenceError
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
    const handleLoadSync = (loadId) => {
        const load = listData.loads.find(l => l.id === parseInt(loadId));
        if (!load) return;

        const updatedForm = {
            ...formData,
            load_id: load.id,
            transport_id: load.transport_id,
            vehicle_no: load.vehicle_no,
            delivery: load.delivery,
            lr_no: load.lr_no,
            lr_date: load.lr_date,
            ebill_no: load.insurance_no,
            freight_charges: num(load.freight),
            removal_time: load.out_time || '',
            prepare_time: load.in_time || ''
        };
        setFormData(updatedForm);

        setGridRows(prev => {
            const updatedRows = prev.map(r => {
                const bags = num(load.no_of_bags);
                const kgs = num(r.total_kgs);
                return {
                    ...r,
                    packs: bags,
                    avg_content: bags > 0 ? (kgs / bags).toFixed(3) : 0
                };
            });
            return runCalculations(updatedRows, updatedForm.invoice_type_id, load.freight, updatedForm.sales_type);
        });
    };

    // ==========================================
    // 4. HANDLERS
    // ==========================================
    const handleOrderSync = async (e) => {
        const val = e.target.value;
        if (!val) return;

        const [source, orderNo] = val.split('|');
        let order = source === 'WITH'
            ? listData.orders.find(o => String(o.order_no) === String(orderNo))
            : listData.directOrders.find(o => String(o.order_no) === String(orderNo));
        if (!order) {
            alert("Selected order could not be found.");
            e.target.value = "";
            return;
        }

        const config = listData.types.find(t => t.id === parseInt(formData.invoice_type_id));
        if (!config) { alert("Select Invoice Type first."); e.target.value = ""; return; }

        const load = listData.loads.find(l => l.id === parseInt(formData.load_id));
        let details = source === 'WITH' ? order.OrderDetails || [] : order.DirectInvoiceDetails || [];
        if (details.length === 0 && order.id) {
            const res = source === 'WITH'
                ? await transactionsAPI.orders.getById(order.id)
                : await transactionsAPI.directInvoices.getById(order.id);
            order = res.data.data || order;
            details = source === 'WITH' ? order.OrderDetails || [] : order.DirectInvoiceDetails || [];
        }
        if (details.length === 0) {
            alert("No detail rows found for this order.");
            e.target.value = "";
            return;
        }

        console.log(`%c 📑 SYNCING ORDER: ${orderNo} `, "background: #2563eb; color: #fff; font-weight: bold; padding: 4px;");
        console.log("Raw Order Details from DB:", details);

        const newRows = details.map(d => normalizeInvoiceRow(d, { order, source, config, load }));

        setGridRows(runCalculations([...gridRows, ...newRows], formData.invoice_type_id, formData.freight_charges, formData.sales_type));
        setActiveTab('detail');
        e.target.value = "";
    };

    const updateGrid = (idx, field, val) => {
        setGridRows(prev => {
            const updated = [...prev];
            const row = { ...updated[idx], [field]: val };

            if (field === 'packs') {
                row.total_kgs = num(val) * num(row.avg_content);
                console.log(`%c PACKS CHANGED: ${row.product_description}`, "color: #f59e0b;");
                console.log(`New Kgs: ${val} packs x ${row.avg_content}kg = ${row.total_kgs}`);
            }

            if (field === 'total_kgs') {
                const p = num(row.packs);
                row.avg_content = p > 0 ? (num(val) / p).toFixed(3) : 0;
                console.log(`%c KGS CHANGED: ${row.product_description}`, "color: #f59e0b;");
                console.log(`New Avg Content: ${val}kg / ${p} packs = ${row.avg_content}`);
            }

            if (field === 'broker_code1') {
                row.broker_code = val;
            }

            updated[idx] = row;
            return runCalculations(updated, formData.invoice_type_id, formData.freight_charges, formData.sales_type);
        });
    };

    const valueOrFallback = (value, fallback = '') => (
        value === undefined || value === null || value === '' ? fallback : value
    );

    const firstValue = (...values) => {
        for (const value of values) {
            if (value !== undefined && value !== null && value !== '') return value;
        }
        return '';
    };

    const findProductForRow = (row) => (
        row.Product ||
        row.product ||
        row.ProductDetail ||
        listData.products.find(p => String(p.id) === String(row.product_id))
    );

    const normalizeInvoiceRow = (row, options = {}) => {
        const { order = {}, source = '', config = {}, load = null } = options;
        const product = findProductForRow(row);
        const broker = listData.brokers.find(b => String(b.id) === String(order.broker_id));
        const orderNo = firstValue(row.order_no, order.order_no);
        const orderType = firstValue(row.order_type, source === 'WITH' ? 'WITH_ORDER' : source === 'WITHOUT' ? 'WITHOUT_ORDER' : '');
        const packs = num(load?.no_of_bags) > 0
            ? num(load.no_of_bags)
            : (num(firstValue(row.packs, row.qty, row.quantity)) || 0);
        const avgContent = num(firstValue(row.avg_content, row.bag_wt, product?.pack_nett_wt));
        const totalKgs = num(firstValue(row.total_kgs, row.kgs, row.net_weight)) || (packs * avgContent);

        return {
            ...row,
            order_no: orderNo,
            order_type: orderType,
            product_id: firstValue(row.product_id, product?.id),
            product_description: firstValue(row.product_description, product?.product_name, product?.short_description),
            packs,
            packing_type: firstValue(row.packing_type, product?.packing_type, 'BAGS'),
            total_kgs: totalKgs,
            avg_content: packs > 0 ? (totalKgs / packs).toFixed(3) : num(avgContent).toFixed(3),
            rate: num(firstValue(row.rate, row.rate_cr, row.rate_imm)),
            rate_per: firstValue(row.rate_per, product?.rate_per, 'KG'),
            identification_mark: firstValue(row.identification_mark, ''),
            charity_per_bale: num(firstValue(row.charity_per_bale, formData.sales_type === 'GST SALES' ? 3 : config.charity_value)),
            broker_code: firstValue(row.broker_code, row.broker_code1, broker?.broker_code),
            broker_code1: firstValue(row.broker_code1, row.broker_code, broker?.broker_code),
            broker_code2: firstValue(row.broker_code2, ''),
            broker_percentage: num(firstValue(row.broker_percentage, broker?.commission_pct)),
            broker_percentage2: num(firstValue(row.broker_percentage2, 0)),
            from_no: firstValue(row.from_no, ''),
            to_no: firstValue(row.to_no, ''),
            lot_no: firstValue(row.lot_no, ''),
            resale: num(firstValue(row.resale, 0)),
            convert_to_hank: num(firstValue(row.convert_to_hank, 0)),
            convert_to_cone: num(firstValue(row.convert_to_cone, 0)),
            gst_per: num(firstValue(row.gst_per, config.gst_percentage)),
            sgst_per: num(firstValue(row.sgst_per, config.sgst_percentage)),
            cgst_per: num(firstValue(row.cgst_per, config.cgst_percentage)),
            igst_per: num(firstValue(row.igst_per, config.igst_percentage)),
            vat_per: num(firstValue(row.vat_per, config.vat_percentage)),
            cenvat_per: num(firstValue(row.cenvat_per, config.cenvat_percentage)),
            duty_per: num(firstValue(row.duty_per, config.duty_percentage)),
            cess_per: num(firstValue(row.cess_per, config.cess_percentage)),
            hcess_per: num(firstValue(row.hcess_per, config.hr_sec_cess_percentage)),
            tcs_per: num(firstValue(row.tcs_per, config.tcs_percentage)),
            other_per: num(firstValue(row.other_per, 0)),
            other_amt: num(firstValue(row.other_amt, 0)),
            freight_amt: num(firstValue(row.freight_amt, 0)),
            rounded_off: num(firstValue(row.rounded_off, 0)),
            discount_percentage: num(firstValue(row.discount_percentage, 0))
        };
    };

    const hydrateInvoiceForEdit = (invoice) => {
        const party = invoice.Party || listData.parties.find(p => p.id === parseInt(invoice.party_id));
        const load = listData.loads.find(l => l.id === parseInt(invoice.load_id));
        const invoiceType = listData.types.find(t => t.id === parseInt(invoice.invoice_type_id));
        const salesType = valueOrFallback(invoice.sales_type, invoiceType?.sales_type || emptyInvoice.sales_type);

        const header = {
            ...invoice,
            sales_type: salesType,
            invoice_type_id: valueOrFallback(invoice.invoice_type_id, ''),
            addr1: valueOrFallback(invoice.addr1, party?.addr1 || ''),
            addr2: valueOrFallback(invoice.addr2, party?.addr2 || ''),
            addr3: valueOrFallback(invoice.addr3, party?.addr3 || ''),
            transport_id: valueOrFallback(invoice.transport_id, load?.transport_id || ''),
            vehicle_no: valueOrFallback(invoice.vehicle_no, load?.vehicle_no || ''),
            delivery: valueOrFallback(invoice.delivery, load?.delivery || ''),
            lr_no: valueOrFallback(invoice.lr_no, load?.lr_no || ''),
            lr_date: valueOrFallback(invoice.lr_date, load?.lr_date || ''),
            ebill_no: valueOrFallback(invoice.ebill_no, load?.insurance_no || ''),
            freight_charges: valueOrFallback(invoice.freight_charges, load ? num(load.freight) : 0),
            removal_time: valueOrFallback(invoice.removal_time, load?.out_time || ''),
            prepare_time: valueOrFallback(invoice.prepare_time, load?.in_time || '')
        };

        const details = (
            invoice.InvoiceDetails ||
            invoice.Details ||
            invoice.details ||
            []
        ).map(row => normalizeInvoiceRow(row, { config: invoiceType, load }));

        return { header, details };
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
                <button onClick={() => { setFormData({ ...emptyInvoice, invoice_no: (listData.history.length + 1).toString() }); setGridRows([]); setActiveTab('head'); setIsModalOpen(true); }} className="bg-blue-600 text-white px-8 py-2 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all uppercase text-xs flex items-center gap-2"><Plus size={18} /> New Invoice</button>
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
                        {currentItems.map(item => (
                            <tr
                                key={item.id}
                                className="hover:bg-blue-50 cursor-pointer"
                                onClick={async () => {
                                    try {
                                        const res = await transactionsAPI.invoices.getById(item.id);
                                        const invoice = res.data.data;
                                        const { header, details } = hydrateInvoiceForEdit(invoice);

                                        setGridRows(
                                            runCalculations(
                                                details,
                                                header.invoice_type_id,
                                                header.freight_charges,
                                                header.sales_type
                                            )
                                        );
                                        setFormData(header);
                                        setActiveTab('detail');

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
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wide">
                        Showing {filteredInvoices.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1}
                        {' '}to {Math.min(currentPage * itemsPerPage, filteredInvoices.length)}
                        {' '}of {filteredInvoices.length} entries
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                            className="p-2 border border-slate-300 rounded bg-white disabled:opacity-40 hover:bg-blue-50 transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="px-3 text-xs font-black text-slate-600">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                            className="p-2 border border-slate-300 rounded bg-white disabled:opacity-40 hover:bg-blue-50 transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* PREPARATION MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-[1150px] flex flex-col overflow-hidden border border-slate-300 h-[96vh]">

                        {/* <div className="bg-white p-2 border-b border-slate-300 flex justify-between items-center shadow-sm">
                            <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><Layers size={16}/> Invoice Preparation</span>
                            <button onClick={() => setIsModalOpen(false)} className="text-white bg-red-500 hover:bg-red-600 px-2 rounded font-bold">×</button>
                        </div> */}

                        <div className="bg-[#2557A7] p-4 text-white">
                            <h2 className="text-xl font-black">Invoice</h2>
                            <p className="text-[13px] opacity-95 uppercase font-bold tracking-wide">To Add, Modify Invoice details.</p>
                        </div>

                        <div className="flex bg-[#D9E5F7] pt-2 px-4 gap-1">
                            {['head', 'detail'].map(t => (
                                <button key={t} onClick={() => setActiveTab(t)} className={`px-6 py-2 text-sm font-black border border-b-0 rounded-t-md transition-all ${activeTab === t ? 'bg-white text-blue-800 border-slate-500 shadow-sm' : 'bg-[#EBF2FA] text-slate-700 border-slate-300'}`}>
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
                                                invoice_type_id: '' // 🟢 Clear selected ID when type changes
                                            })}
                                        />
                                        <RowSelect
                                            label="Invoice Type"
                                            value={formData.invoice_type_id}
                                            options={filteredInvoiceTypes.map(t => ({
                                                value: t.id,
                                                label: t.type_name
                                            }))}
                                            onChange={e => setFormData({
                                                ...formData,
                                                invoice_type_id: e.target.value
                                            })}
                                        />
                                        <RowSelect label="Party name" value={formData.party_id} options={listData.parties.map(p => ({ value: p.id, label: p.account_name }))} onChange={e => handleAccountSync(e.target.value)} />
                                        <div className="flex flex-col gap-1 ml-[120px]">
                                            <input readOnly value={formData.addr1} className="border border-slate-400 p-2 text-[13px] bg-[#F5F8FA] font-bold outline-none text-center" />
                                            <input readOnly value={formData.addr2} className="border border-slate-400 p-2 text-[13px] bg-[#F5F8FA] font-bold outline-none text-center" />
                                            <input readOnly value={formData.addr3} className="border border-slate-400 p-2 text-[13px] bg-[#F5F8FA] font-bold outline-none text-center" />
                                        </div>
                                        <div className="flex items-center gap-8 ml-[120px] py-1">
                                            <div className="flex items-center gap-2"><span className="text-[13px] font-black text-slate-800">Credit days</span><input type="number" className="border border-slate-400 w-20 p-2 text-sm text-center font-black" value={formData.credit_days} onChange={e => setFormData({ ...formData, credit_days: e.target.value })} /></div>
                                            <div className="flex items-center gap-2"><span className="text-[13px] font-black text-slate-800">Interest %</span><input type="number" className="border border-slate-400 w-20 p-2 text-sm text-center font-black" value={formData.interest_percentage} onChange={e => setFormData({ ...formData, interest_percentage: e.target.value })} /></div>
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
                                    <div className="col-span-4 bg-[#F5F8FA] border border-slate-400 p-5 flex flex-col gap-1.5 rounded shadow-inner">
                                        <h3 className="text-sm font-black text-slate-800 mb-2 border-b border-slate-400 pb-2 uppercase tracking-wide text-center">Invoice Summary</h3>
                                        <TotalRow label="Assessable Value" value={formData.total_assessable} />
                                        <TotalRow label="Charity" value={formData.total_charity} />
                                        <TotalRow label="VAT" value={formData.total_vat} />
                                        <TotalRow label="CENVAT" value={formData.total_cenvat} />
                                        <TotalRow label="Duty" value={formData.total_duty} />
                                        <TotalRow label="CESS" value={formData.total_cess} />
                                        <TotalRow label="H.S. CESS" value={formData.total_hr_sec_cess} />

                                        <TotalRow label="GST" value={formData.total_gst} />
                                        <TotalRow label="IGST" value={formData.total_igst} />

                                        <TotalRow label="Freight" value={formData.freight_charges} />
                                        <TotalRow label="Other" value={formData.total_other} />

                                        <div className="mt-auto pt-4 border-t-2 border-slate-400 space-y-1.5">
                                            <TotalRow label="Gross Total" value={formData.sub_total} />

                                            {/* 🟢 TCS moved here to show it is part of the final deduction process */}
                                            <div className="flex justify-between items-center text-[13px] py-1 px-2 bg-red-50 rounded border border-red-200">
                                                <span className="font-black text-red-600 uppercase tracking-tighter">(-) TCS</span>
                                                <input
                                                    readOnly
                                                    value={num(formData.total_tcs).toLocaleString()}
                                                    className="w-32 border border-red-300 text-center p-1.5 font-mono bg-white outline-none font-black text-red-600"
                                                />
                                            </div>

                                            <TotalRow label="Round off" value={formData.round_off} />

                                            <div className="flex justify-between items-center py-2 px-2 bg-white border border-slate-400 mt-2 shadow-sm">
                                                <span className="text-sm font-black uppercase text-slate-800">Net Amount</span>
                                                <span className="text-2xl font-black font-mono text-blue-800">₹ {num(formData.net_amount).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* TAB 2: DETAIL MATRIX */
                                <div className="space-y-4 h-full flex flex-col overflow-hidden">
                                    <div className="bg-[#EBF2FA] p-3 border border-slate-300 flex items-center justify-between rounded shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[13px] font-black text-slate-800">Select with order No.</span>
                                            <select className="border border-slate-400 text-sm p-2 min-w-[200px] font-black outline-none text-center bg-white" onChange={handleOrderSync}>
                                                <option value="">-- Order No --</option>
                                                {listData.orders.map(o => <option key={o.id} value={`WITH|${o.order_no}`}>{o.order_no}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[13px] font-black text-slate-800">Select without order No.</span>
                                            <select className="border border-slate-400 text-sm p-2 min-w-[200px] font-black outline-none text-center bg-white" onChange={handleOrderSync}>
                                                <option value="">-- Direct Doc --</option>
                                                {listData.directOrders.map(o => <option key={o.id} value={`WITHOUT|${o.order_no}`}>{o.order_no}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex-1 border border-slate-300 overflow-x-auto bg-[#F5F8FA]">
                                        <table className="min-w-[9800px] text-[13px] border-collapse bg-white">
                                            <thead className="bg-blue-50 sticky top-0 z-10 border-b-2 border-slate-500 text-slate-900">
                                                <tr className="h-12">
                                                    <th className="p-3 border-r w-10"></th>
                                                    <th className="p-3 border-r w-32 text-center">OrderNo</th>
                                                    <th className="p-3 border-r w-80 text-center">Product Description</th>
                                                    <th className="p-3 border-r w-24 text-center">Packs</th>
                                                    <th className="p-3 border-r w-32 text-center">Packing Type</th>
                                                    <th className="p-3 border-r w-32 text-center">Total Kgs</th>
                                                    <th className="p-3 border-r w-32 text-center">Avg Content</th>
                                                    <th className="p-3 border-r w-32 text-center">Rate</th>
                                                    <th className="p-3 border-r w-24 text-center">Rate Per</th>
                                                    <th className="p-3 border-r w-40 text-center">Identification Marks</th>
                                                    <th className="p-3 border-r w-32 text-center">Assess Value</th>
                                                    <th className="p-3 border-r w-28 text-center">Charity / Bale</th>
                                                    <th className="p-3 border-r w-32 text-center">Charity</th>
                                                    <th className="p-3 border-r w-24 text-center">GST%</th>
                                                    <th className="p-3 border-r w-32 text-center">GST</th>
                                                    <th className="p-3 border-r w-24 text-center">SGST%</th>
                                                    <th className="p-3 border-r w-32 text-center">SGST</th>
                                                    <th className="p-3 border-r w-24 text-center">CGST%</th>
                                                    <th className="p-3 border-r w-32 text-center">CGST</th>
                                                    <th className="p-3 border-r w-24 text-center">IGST%</th>
                                                    <th className="p-3 border-r w-32 text-center">IGST</th>
                                                    <th className="p-3 border-r w-24 text-center">Tax%</th>
                                                    <th className="p-3 border-r w-32 text-center">Tax</th>
                                                    <th className="p-3 border-r w-24 text-center">CENVAT%</th>
                                                    <th className="p-3 border-r w-32 text-center">CENVAT</th>
                                                    <th className="p-3 border-r w-24 text-center">Duty%</th>
                                                    <th className="p-3 border-r w-32 text-center">Duty</th>
                                                    <th className="p-3 border-r w-24 text-center">Cess%</th>
                                                    <th className="p-3 border-r w-32 text-center">Cess</th>
                                                    <th className="p-3 border-r w-32 text-center">Freight</th>
                                                    <th className="p-3 border-r w-24 text-center">H.S.Cess%</th>
                                                    <th className="p-3 border-r w-32 text-center">H.S.Cess</th>
                                                    <th className="p-3 border-r w-24 text-center">TCS%</th>
                                                    <th className="p-3 border-r w-32 text-center">TCS</th>
                                                    <th className="p-3 border-r w-24 text-center">Others%</th>
                                                    <th className="p-3 border-r w-32 text-center">Others</th>
                                                    <th className="p-3 border-r w-32 text-center">Round Off</th>
                                                    <th className="p-3 border-r w-32 text-center">Total Value</th>
                                                    <th className="p-3 border-r w-36 text-center">Order Type</th>
                                                    <th className="p-3 border-r w-28 text-center">Broker1 %</th>
                                                    <th className="p-3 border-r w-28 text-center">Broker2 %</th>
                                                    <th className="p-3 border-r w-28 text-center">From No</th>
                                                    <th className="p-3 border-r w-28 text-center">To No</th>
                                                    <th className="p-3 border-r w-28 text-center">Lot No</th>
                                                    <th className="p-3 border-r w-32 text-center">BrokerCode1</th>
                                                    <th className="p-3 border-r w-32 text-center">BrokerCode2</th>
                                                    <th className="p-3 border-r w-28 text-center">Re Sale</th>
                                                    <th className="p-3 border-r w-32 text-center">Conv To Hank</th>
                                                    <th className="p-3 border-r w-32 text-center">Conv To Cone</th>
                                                    <th className="p-3 text-center w-24">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-300">
                                                {gridRows.map((r, i) => (
                                                    <tr key={i} className="h-12 hover:bg-blue-50 font-black text-slate-900">
                                                        <td className="p-2 border-r text-center text-slate-300">›</td>
                                                        <td className="p-2 border-r text-center text-blue-800 font-mono bg-slate-50">{r.order_no}</td>
                                                        <td className="p-2 border-r text-center uppercase text-slate-800 bg-slate-50">{r.product_description}</td>
                                                        <td className="p-0 border-r w-24">
                                                            <input
                                                                type="number"
                                                                className="w-full h-full p-2 text-center bg-pink-50 outline-none focus:bg-pink-100 font-black"
                                                                value={r.packs}
                                                                onChange={e => updateGrid(i, 'packs', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="p-0 border-r w-32">
                                                            <input
                                                                type="text"
                                                                className="w-full h-full p-2 text-center bg-white outline-none uppercase font-bold"
                                                                value={r.packing_type || ''}
                                                                onChange={e => updateGrid(i, 'packing_type', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="p-0 border-r w-32">
                                                            <input
                                                                type="number"
                                                                className="w-full h-full p-2 text-center text-blue-700 font-black outline-none bg-blue-50"
                                                                value={r.total_kgs}
                                                                onChange={e => updateGrid(i, 'total_kgs', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="p-0 border-r w-32">
                                                            <input type="number" className="w-full h-full p-2 text-center bg-emerald-50 text-emerald-700 outline-none font-black"
                                                                value={r.avg_content || 0} readOnly />
                                                        </td>
                                                        <td className="p-0 border-r w-32">
                                                            <input
                                                                type="number"
                                                                className="w-full h-full p-2 text-center outline-none bg-white font-black"
                                                                value={r.rate}
                                                                onChange={e => updateGrid(i, 'rate', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="p-0 border-r w-24"><input type="text" className="w-full h-full p-2 text-center outline-none bg-white uppercase font-bold" value={r.rate_per || ''} onChange={e => updateGrid(i, 'rate_per', e.target.value)} /></td>
                                                        <td className="p-1 border-r"><input type="text" className="w-full p-2 text-[13px] border border-slate-300 rounded font-black uppercase text-center" value={r.identification_mark || ''} onChange={e => updateGrid(i, 'identification_mark', e.target.value)} /></td>
                                                        <td className="p-2 border-r text-center bg-blue-100 text-blue-800">{num(r.assessable_value).toFixed(2)}</td>
                                                        <td className="p-0 border-r w-28"><input type="number" className="w-full h-full p-2 text-center outline-none bg-white font-black" value={r.charity_per_bale || 0} onChange={e => updateGrid(i, 'charity_per_bale', e.target.value)} /></td>
                                                        <td className="p-0 border-r w-32">
                                                            <input
                                                                type="number"
                                                                className="w-full h-full p-2 text-center text-orange-600 outline-none bg-white font-black"
                                                                value={num(r.charity_amt)}
                                                                onChange={e => updateGrid(i, 'charity_amt', e.target.value)}
                                                            />
                                                        </td>
                                                        {renderPairCell(r, i, 'gst_per', 'gst_amt', true, updateGrid)}
                                                        {renderPairCell(r, i, 'sgst_per', 'sgst_amt', true, updateGrid)}
                                                        {renderPairCell(r, i, 'cgst_per', 'cgst_amt', true, updateGrid)}
                                                        {renderPairCell(r, i, 'igst_per', 'igst_amt', true, updateGrid)}
                                                        {renderPairCell(r, i, 'vat_per', 'vat_amt', true, updateGrid)}
                                                        {renderPairCell(r, i, 'cenvat_per', 'cenvat_amt', true, updateGrid)}
                                                        {renderPairCell(r, i, 'duty_per', 'duty_amt', true, updateGrid)}
                                                        {renderPairCell(r, i, 'cess_per', 'cess_amt', true, updateGrid)}
                                                        <td className="p-1 border-r"><input type="number" className="w-full p-2 text-center outline-none" value={r.freight_amt || 0} onChange={e => updateGrid(i, 'freight_amt', e.target.value)} /></td>
                                                        {renderPairCell(r, i, 'hcess_per', 'hr_sec_cess_amt', true, updateGrid)}
                                                        {renderPairCell(r, i, 'tcs_per', 'tcs_amt', true, updateGrid)}
                                                        {renderPairCell(r, i, 'other_per', 'other_amt', true, updateGrid, "text-slate-700", true)}
                                                        <td className="p-1 border-r"><input type="number" className="w-full p-2 text-center outline-none" value={r.rounded_off || 0} onChange={e => updateGrid(i, 'rounded_off', e.target.value)} /></td>
                                                        <td className="p-2 border-r text-center bg-emerald-50 text-emerald-800">{num(r.final_value).toFixed(2)}</td>
                                                        <td className="p-2 border-r text-center bg-slate-50">{r.order_type}</td>
                                                        <td className="p-1 border-r"><input type="number" className="w-full p-2 text-center outline-none" value={r.broker_percentage || 0} onChange={e => updateGrid(i, 'broker_percentage', e.target.value)} /></td>
                                                        <td className="p-1 border-r"><input type="number" className="w-full p-2 text-center outline-none" value={r.broker_percentage2 || 0} onChange={e => updateGrid(i, 'broker_percentage2', e.target.value)} /></td>
                                                        <td className="p-1 border-r"><input type="text" className="w-full p-2 text-center outline-none uppercase" value={r.from_no || ''} onChange={e => updateGrid(i, 'from_no', e.target.value)} /></td>
                                                        <td className="p-1 border-r"><input type="text" className="w-full p-2 text-center outline-none uppercase" value={r.to_no || ''} onChange={e => updateGrid(i, 'to_no', e.target.value)} /></td>
                                                        <td className="p-1 border-r"><input type="text" className="w-full p-2 text-center outline-none uppercase" value={r.lot_no || ''} onChange={e => updateGrid(i, 'lot_no', e.target.value)} /></td>
                                                        <td className="p-1 border-r"><input type="text" className="w-full p-2 text-center outline-none uppercase" value={r.broker_code1 || r.broker_code || ''} onChange={e => updateGrid(i, 'broker_code1', e.target.value)} /></td>
                                                        <td className="p-1 border-r"><input type="text" className="w-full p-2 text-center outline-none uppercase" value={r.broker_code2 || ''} onChange={e => updateGrid(i, 'broker_code2', e.target.value)} /></td>
                                                        <td className="p-1 border-r"><input type="number" className="w-full p-2 text-center outline-none" value={r.resale || 0} onChange={e => updateGrid(i, 'resale', e.target.value)} /></td>
                                                        <td className="p-1 border-r"><input type="number" className="w-full p-2 text-center outline-none" value={r.convert_to_hank || 0} onChange={e => updateGrid(i, 'convert_to_hank', e.target.value)} /></td>
                                                        <td className="p-1 border-r"><input type="number" className="w-full p-2 text-center outline-none" value={r.convert_to_cone || 0} onChange={e => updateGrid(i, 'convert_to_cone', e.target.value)} /></td>
                                                        <td className="p-2 text-center">
                                                            <button onClick={() => setGridRows(gridRows.filter((_, idx) => idx !== i))}>
                                                                <MinusCircle size={22} className="text-red-500 hover:scale-110 transition-transform" />
                                                            </button>
                                                        </td>
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
                                <button
                                    onClick={exportToJSON}
                                    className="bg-indigo-600 text-white border border-indigo-700 px-4 py-1.5 text-[10px] font-black flex items-center gap-1.5 hover:bg-indigo-700 shadow-sm transition-all rounded active:scale-95"
                                >
                                    <FileJson size={14} className="text-indigo-100" />
                                    EXPORT JSON
                                </button>
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
        <label className="w-[120px] text-[13px] font-black text-slate-800">{label}</label>
        <input {...props} className={`border border-slate-400 p-2 text-[13px] text-center font-black outline-none focus:border-blue-600 shadow-inner ${width} ${color}`} />
    </div>
);

const RowSelect = ({ label, options, width = "w-full", ...props }) => (
    <div className="flex items-center">
        <label className="w-[120px] text-[13px] font-black text-slate-800">{label}</label>
        <select {...props} className={`border border-slate-400 p-2 text-[13px] text-center font-black outline-none focus:border-blue-600 bg-white ${width}`}>
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
        <div className="flex justify-between items-center text-[13px] py-1 px-2 hover:bg-white rounded">
            <span className="font-black text-slate-700 uppercase tracking-normal">
                {label}
            </span>
            <input
                readOnly
                value={displayValue}
                className="w-32 border border-slate-400 text-center p-1.5 font-mono bg-white outline-none font-black shadow-inner"
            />
        </div>
    );
};

const FooterBtn = ({ label, icon }) => (
    <button className="bg-white border border-slate-400 px-3 py-2 text-[12px] font-black flex items-center gap-1.5 hover:bg-slate-50 shadow-sm transition-colors">
        <span className="text-blue-700">{icon}</span> {label}
    </button>
);

const renderPairCell = (row, idx, perKey, amtKey, isEditable, updateGrid, color = "text-blue-600", amtEditable = false) => (
    <>
        <td className="p-1 border-r bg-white">
            <input
                type="number"
                step="0.01"
                disabled={!isEditable}
                className={`w-full p-2.5 text-center text-[13px] font-black border-none outline-none focus:bg-yellow-50 ${color} disabled:bg-slate-50`}
                value={row[perKey] || 0}
                onChange={(e) => updateGrid(idx, perKey, e.target.value)}
            />
        </td>
        <td className={`p-1 border-r text-center font-black bg-slate-50 ${color}`}>
            {amtEditable ? (
                <input
                    type="number"
                    step="0.01"
                    className={`w-full p-2.5 text-center text-[13px] font-black border-none outline-none focus:bg-yellow-50 bg-white ${color}`}
                    value={row[amtKey] || 0}
                    onChange={(e) => updateGrid(idx, amtKey, e.target.value)}
                />
            ) : (
                num(row[amtKey]).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            )}
        </td>
    </>
);
export default InvoicePreparation;
