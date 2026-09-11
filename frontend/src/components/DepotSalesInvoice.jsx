import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { mastersAPI, transactionsAPI } from '../service/api';
import { getNextInvoiceSequence, getPrefixForParty, getNextDepotInvoiceSequence } from '../service/utils';
import {
    Save, FileText, Calculator, Plus, MinusCircle,
    Layers, Activity, Search, Hash, Printer,
    Warehouse, X, Database, CheckCircle, Trash2, Square, CheckSquare,
    FileSpreadsheet, UploadCloud
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { evaluate } from "mathjs";
import logoImage from '../assets/logo.jpeg';
import { useFilter } from '../context/FilterContext';
import LocalSearchBar from './LocalSearchBar';

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
const money = (v) => Math.round(num(v)).toString();
const toNullableDateTime = (value) => {
    if (!value || value === 'Invalid date') return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return value;
};
const imageUrlToDataUrl = async (url) => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};
const fmtIN = (val, digits = 2) => {
    const n = Number(val);
    if (isNaN(n)) return digits === 0 ? '0' : '0.00';
    return n.toLocaleString('en-IN', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
};

const fmtInvoiceDate = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const yr = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${yr}`;
};

const numberToWords = (amount) => {
    const numVal = Math.round(Number(amount) || 0);
    if (numVal === 0) return "ZERO RUPEES ONLY.";

    const ones = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN",
        "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
    const tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];

    const convertChunk = (n) => {
        if (n === 0) return "";
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
        if (n < 1000) return ones[Math.floor(n / 100)] + " HUNDRED" + (n % 100 ? " AND " + convertChunk(n % 100) : "");
        return "";
    };

    let str = "";
    const crore = Math.floor(numVal / 10000000);
    const lakh = Math.floor((numVal % 10000000) / 100000);
    const thousand = Math.floor((numVal % 100000) / 1000);
    const hundred = numVal % 1000;

    if (crore) str += convertChunk(crore) + " CRORE ";
    if (lakh) str += convertChunk(lakh) + (lakh > 1 ? " LAKHS " : " LAKH ");
    if (thousand) str += convertChunk(thousand) + " THOUSAND ";
    if (hundred) {
        if (hundred < 100 && str.trim().length > 0) {
            str += "AND " + convertChunk(hundred) + " ";
        } else {
            str += convertChunk(hundred) + " ";
        }
    }

    return str.trim() + " ONLY.";
};

// =====================================================
// EXACT TAX INVOICE PRINT VIEW (DEPOT SALES)
// =====================================================
const ModernPrintView = ({ data, listData, getHSN }) => {
    if (!data) return null;

    const party = listData?.parties?.find(p => String(p.id) === String(data.party_id)) || data.Party || {};
    const config = listData?.types?.find(t => String(t.id) === String(data.invoice_type_id)) || {};
    const gstPer = num(config.gst_percentage);
    let cgstPer = num(config.cgst_percentage);
    let sgstPer = num(config.sgst_percentage);
    let igstPer = num(config.igst_percentage);
    const tcsPer = num(config.tcs_percentage);

    if (igstPer === 0 && cgstPer === 0 && sgstPer === 0 && gstPer > 0) {
        cgstPer = gstPer / 2;
        sgstPer = gstPer / 2;
    }

    const totalGst = num(data.total_gst);
    let totalCgst = num(data.total_cgst);
    let totalSgst = num(data.total_sgst);
    let totalIgst = num(data.total_igst);

    if (igstPer === 0 && totalCgst === 0 && totalSgst === 0 && totalGst > 0) {
        totalCgst = totalGst / 2;
        totalSgst = totalGst / 2;
    }

    const items = (data.Details || data.InvoiceDetails || []).filter(Boolean);
    const totalBags = items.reduce((sum, r) => sum + num(r.packs), 0);
    const totalWeight = items.reduce((sum, r) => sum + num(r.total_kgs), 0);
    const totalAssessable = items.reduce((sum, r) => sum + num(r.assessable_value || (num(r.total_kgs) * num(r.rate))), 0);

    const productDescs = [...new Set(items.map(r => r.product_description || (listData?.products?.find(p => String(p.id) === String(r.product_id))?.short_description)).filter(Boolean))];
    const hsnCodes = [...new Set(items.map(r => (getHSN ? getHSN(r.product_id) : '') || r.hsn || '').filter(Boolean))];
    const netAmount = num(data.final_invoice_value || data.net_amount || data.sub_total || totalAssessable);

    return (
        <div id="printable-invoice-wrapper" className="p-4 bg-white text-black font-sans max-w-[210mm] mx-auto text-xs leading-normal">
            {/* Top Row: Checkboxes & TAX INVOICE Title */}
            <div className="relative mb-2">
                <div className="text-center pt-2">
                    <h1 className="text-xl font-bold tracking-wider">TAX INVOICE</h1>
                </div>
                <div className="absolute right-0 top-0 text-[10px] font-bold space-y-0.5">
                    <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 border border-black inline-block"></span>
                        <span>ORIGINAL FOR BUYER</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 border border-black inline-block"></span>
                        <span>DUPLICATE FOR TRANSPORTER</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 border border-black inline-block"></span>
                        <span>TRIPLICATE FOR FILE COPY</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 border border-black inline-block"></span>
                        <span>EXTRA COPY</span>
                    </div>
                </div>
            </div>

            {/* Main Outer Box */}
            <div className="border border-black">
                {/* 1. Company Details Header Box */}
                <div className="border-b border-black p-3 relative flex justify-between items-start">
                    <div className="flex-1 text-center pr-24 pl-10">
                        <h2 className="text-base font-black uppercase tracking-wide">KAYAAR EXPORTS PRIVATE LIMITED</h2>
                        <p className="text-[11px] leading-tight mt-0.5">
                            D.No: 43/5, Railway Feeder Road,<br />
                            K.R. Nagar -628 503, Kovilpatti -Taluk<br />
                            Tuticorin Dist., Tamilnadu, India
                        </p>
                        <p className="text-[11px] font-medium mt-0.5">(04632) - 248258, 94432 38761</p>
                        <p className="text-[11px] font-medium">E-Mail : ttnkrgroup@gmail.com</p>
                        <p className="text-[11px] font-bold mt-0.5">GSTIN : 33AAACK4468M1ZA</p>
                    </div>

                    {/* OEKO-TEX framed badge */}
                    <div className="border border-black p-1.5 text-center text-[9px] w-44 shrink-0 bg-white">
                        <div className="font-bold text-[10px]">OEKO-TEX ®</div>
                        <div className="text-[7.5px] uppercase font-bold text-slate-700">CONFIDENCE IN TEXTILES</div>
                        <div className="font-bold text-[9px]">STANDARD 100</div>
                        <div className="text-[8px] font-bold">18.HIN.60427 HOHENSTEIN HTTI</div>
                        <div className="text-[7px] leading-tight">Tested for harmful substances</div>
                        <div className="text-[7px]">www.oeko-tex.com/standard100</div>
                    </div>

                    {/* PAN & CIN bottom row of company box */}
                    <div className="absolute bottom-1 left-3 right-3 flex justify-between text-[10px] font-bold">
                        <span>PAN : AAACK4468M</span>
                        <span>CIN : U51101TN1991PTC020933</span>
                    </div>
                </div>

                {/* 2. Party & Invoice Meta (2-Column Grid) */}
                <div className="border-b border-black grid grid-cols-12 min-h-[110px]">
                    {/* Left Column: Party Name & Address */}
                    <div className="col-span-7 p-2.5 border-r border-black flex flex-col justify-between">
                        <div>
                            <div className="font-bold text-[11px]">Party Name & Address</div>
                            <div className="font-black text-sm uppercase mt-0.5">{party.account_name || data.party_name || '-'}</div>
                            <div className="text-[11px] leading-tight mt-1 uppercase">
                                {data.addr1 && <div>{data.addr1}</div>}
                                {data.addr2 && <div>{data.addr2}</div>}
                                {data.addr3 && <div>{data.addr3}</div>}
                            </div>
                        </div>
                        <div className="font-bold text-[11px] mt-2">
                            GST No: <span className="font-mono">{party.gst_no || data.gst_no || '-'}</span>
                        </div>
                    </div>

                    {/* Right Column: Invoice Meta Table */}
                    <div className="col-span-5 p-2 text-[11px]">
                        <table className="w-full">
                            <tbody>
                                <tr>
                                    <td className="font-bold py-0.5">Invoice No</td>
                                    <td className="font-bold py-0.5 w-4">:</td>
                                    <td className="font-bold py-0.5 text-right font-mono">{data.invoice_no || '-'}</td>
                                </tr>
                                <tr>
                                    <td className="font-bold py-0.5">Invoice Dt</td>
                                    <td className="font-bold py-0.5">:</td>
                                    <td className="font-bold py-0.5 text-right">{fmtInvoiceDate(data.date)}</td>
                                </tr>
                                <tr>
                                    <td className="font-bold py-0.5">E-Way Bill No</td>
                                    <td className="font-bold py-0.5">:</td>
                                    <td className="font-bold py-0.5 text-right font-mono">{data.ebill_no || '-'}</td>
                                </tr>
                                <tr>
                                    <td className="font-bold py-0.5">Vehicle No</td>
                                    <td className="font-bold py-0.5">:</td>
                                    <td className="font-bold py-0.5 text-right uppercase font-mono">{data.vehicle_no || '-'}</td>
                                </tr>
                                <tr>
                                    <td className="font-bold py-0.5">Delivery At</td>
                                    <td className="font-bold py-0.5">:</td>
                                    <td className="font-bold py-0.5 text-right uppercase">{data.delivery || '-'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 3. Description Header Bar */}
                <div className="border-b border-black grid grid-cols-12 text-[11px] font-bold text-center">
                    <div className="col-span-7 py-1 border-r border-black">DESCRIPTION OF GOODS</div>
                    <div className="col-span-5 py-1"></div>
                </div>

                {/* 4. Column Headers */}
                <div className="border-b border-black grid grid-cols-12 text-[11px] font-bold text-center">
                    <div className="col-span-2 py-1.5 border-r border-black">No of Bags</div>
                    <div className="col-span-2 py-1.5 border-r border-black">Net Weight</div>
                    <div className="col-span-3 py-1.5 border-r border-black">S.L No</div>
                    <div className="col-span-2 py-1.5 border-r border-black">Rate Per Kgs</div>
                    <div className="col-span-3 py-1.5">Assessable Value</div>
                </div>

                {/* 5. Item Rows (No extra aggregation row inside table) */}
                <div className="border-b border-black">
                    {items.map((item, idx) => {
                        const rowWeight = num(item.total_kgs);
                        const rowAssessable = num(item.assessable_value || (rowWeight * num(item.rate)));
                        const assessableRatePerKg = rowWeight > 0 ? (rowAssessable / rowWeight) : num(item.rate);
                        return (
                            <div key={idx} className="grid grid-cols-12 text-[11px] py-1 border-b border-black/20 last:border-b-0">
                                <div className="col-span-2 text-center font-bold border-r border-black px-1">{item.packs}</div>
                                <div className="col-span-2 text-center font-bold border-r border-black px-1">{fmtIN(rowWeight, 2)}</div>
                                <div className="col-span-3 text-center border-r border-black px-1 font-mono">{[item.from_no, item.to_no].filter(Boolean).join(' - ') || item.sl_no || '-'}</div>
                                <div className="col-span-2 text-right font-bold border-r border-black px-2">{fmtIN(assessableRatePerKg, 2)}</div>
                                <div className="col-span-3 text-right font-bold px-3">{fmtIN(rowAssessable, 2)}</div>
                            </div>
                        );
                    })}
                </div>

                {/* 6. Split Box: Description (Left) & Taxes/Charges (Right) */}
                <div className="border-b border-black grid grid-cols-12 min-h-[140px]">
                    {/* Left Column */}
                    <div className="col-span-7 p-3 border-r border-black flex flex-col justify-between">
                        <div>
                            {productDescs.map((desc, i) => (
                                <div key={i} className="font-black text-xs uppercase mb-1">{desc}</div>
                            ))}
                            <div className="font-bold text-[11px] mt-2">
                                HSN CODE: {hsnCodes.join(', ') || '52052790'}
                            </div>
                        </div>
                        <div className="text-[10px] font-normal pt-4">
                            Whether the Tax Payable on Reverse Charges Basis ? &nbsp;&nbsp;&nbsp;&nbsp; Yes / No
                        </div>
                    </div>

                    {/* Right Column (Taxes, Charges & Net Amount) */}
                    <div className="col-span-5 text-[11px]">
                        <table className="w-full">
                            <tbody>
                                <tr className="border-b border-black/20">
                                    <td className="p-1.5 pl-3 font-bold">TOTAL ASSESSABLE AMOUNT</td>
                                    <td className="p-1.5 pr-3 text-right font-bold">{fmtIN(data.total_assessable || totalAssessable, 2)}</td>
                                </tr>
                                {num(data.total_charity) > 0 && (
                                    <tr className="border-b border-black/20">
                                        <td className="p-1.5 pl-3 font-bold">CHARITY</td>
                                        <td className="p-1.5 pr-3 text-right font-bold">{fmtIN(data.total_charity, 2)}</td>
                                    </tr>
                                )}
                                {num(data.freight || data.freight_charges) > 0 && (
                                    <tr className="border-b border-black/20">
                                        <td className="p-1.5 pl-3 font-bold">FREIGHT</td>
                                        <td className="p-1.5 pr-3 text-right font-bold">{fmtIN(data.freight || data.freight_charges, 2)}</td>
                                    </tr>
                                )}
                                <tr className="border-b border-black/20">
                                    <td className="p-1.5 pl-3 font-medium">C.G.S.T &nbsp;&nbsp; : &nbsp; {cgstPer.toFixed(2)} %</td>
                                    <td className="p-1.5 pr-3 text-right font-medium">{totalCgst > 0 ? fmtIN(totalCgst, 2) : ''}</td>
                                </tr>
                                <tr className="border-b border-black/20">
                                    <td className="p-1.5 pl-3 font-medium">S.G.S.T &nbsp;&nbsp; : &nbsp; {sgstPer.toFixed(2)} %</td>
                                    <td className="p-1.5 pr-3 text-right font-medium">{totalSgst > 0 ? fmtIN(totalSgst, 2) : ''}</td>
                                </tr>
                                <tr className="border-b border-black/20">
                                    <td className="p-1.5 pl-3 font-medium">I.G.S.T &nbsp;&nbsp; : &nbsp; {igstPer.toFixed(2)} %</td>
                                    <td className="p-1.5 pr-3 text-right font-medium">{totalIgst > 0 ? fmtIN(totalIgst, 2) : ''}</td>
                                </tr>
                                <tr className="border-t border-b border-black font-bold">
                                    <td className="p-1.5 pl-3"></td>
                                    <td className="p-1.5 pr-3 text-right">{fmtIN(data.sub_total || (totalAssessable + num(data.total_charity) + num(data.freight || data.freight_charges) + num(data.total_gst) + num(data.total_cgst) + num(data.total_sgst) + num(data.total_igst)), 2)}</td>
                                </tr>
                                <tr className="border-b border-black">
                                    <td className="p-1.5 pl-3 font-medium">TCS &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; : &nbsp; {tcsPer.toFixed(3)} %</td>
                                    <td className="p-1.5 pr-3 text-right font-medium">{fmtIN(data.total_tcs || 0, 2)}</td>
                                </tr>
                                <tr className="font-black text-xs">
                                    <td className="p-2 pl-3">Net Amount</td>
                                    <td className="p-2 pr-3 text-right">{fmtIN(netAmount, 2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 7. Rupees in Words Full Bar */}
                <div className="border-b border-black p-2 text-[11px] font-bold">
                    <span className="mr-3">Rupees :</span>
                    <span className="uppercase tracking-wide">{numberToWords(netAmount)}</span>
                </div>

                {/* 8. Declarations & Signatures Box */}
                <div className="grid grid-cols-12 min-h-[100px]">
                    {/* Left Column */}
                    <div className="col-span-7 p-2.5 border-r border-black flex flex-col justify-between">
                        <div className="text-[10px] leading-tight text-slate-800">
                            Certified that the particulars given above are true and Correct and Amount indicated represents the price actually charged and that there are no following of additional consideration directly or indirectly from the buyer
                        </div>
                        <div className="font-bold text-[10px] mt-1">E.& O.E</div>
                        <div className="flex justify-between text-[11px] font-bold mt-6 px-4">
                            <span>Prepared by</span>
                            <span>Checked by</span>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="col-span-5 p-2.5 flex flex-col justify-between text-center">
                        <div className="font-bold text-[11px]">For KAYAAR EXPORTS PRIVATE LIMITED</div>
                        <div className="font-bold text-[11px] mt-12">Director/Authorised Signatory</div>
                    </div>
                </div>
            </div>
        </div>
    );
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
        products: [], orders: [], history: [], brokers: [],
        invoices: [], loads: [], directInvoices: []
    });
    const [formData, setFormData] = useState(emptyInvoice);
    const [gridRows, setGridRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('head');
    const { searchQuery: searchValue, searchField, fromDate, toDate, resetFilters, sortField, setSortField, sortOrder, setSortOrder } = useFilter();
    const [searchCondition, setSearchCondition] = useState('Like');

    // Excel Import States
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importLoading, setImportLoading] = useState(false);
    const [importInvoices, setImportInvoices] = useState([]);
    const [importDepotId, setImportDepotId] = useState('');

    const handleSort = (field) => {
        if (sortField === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    // Pagination (registry)
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [printData, setPrintData] = useState(null);

    const getHSN = useCallback((productId) => {
        const product = listData.products.find(p => String(p.id) === String(productId));
        return product?.printing_tariff_desc || '';
    }, [listData.products]);

    const handlePrint = (item) => {
        setPrintData(item);
        setTimeout(() => {
            window.print();
        }, 800);
    };

    // Add this near your other useMemo/useEffect hooks
    const filteredInvoiceTypes = useMemo(() => {
        if (!formData.sales_type) return [];

        return listData.types.filter(type => {
            // This compares the 'sales_type' field inside your tbl_InvoiceTypes
            // directly with the 'sales_type' selected in the UI dropdown.
            return String(type.sales_type).trim().toUpperCase() === String(formData.sales_type).trim().toUpperCase();
        });
    }, [listData.types, formData.sales_type]);
    useEffect(() => {
        if (!formData.invoice_type_id || formData.id) return;

        setGridRows(prev =>
            runCalculations(prev, formData.invoice_type_id, formData)
        );
    }, [formData.invoice_type_id]);

    // ==========================================
    // 2. MATH ENGINE - FREIGHT NOW SYNCED FROM DETAILS
    // ==========================================
    const runCalculations = useCallback((rows, typeId, currentFormData) => {
        if (!typeId) return rows;
        const config = listData.types.find(t => t.id === parseInt(typeId));
        if (!config) return rows;

        const isForward = String(config.round_off_direction || config.calculation_type || '').trim().toLowerCase() === 'forward';

        let hTotals = {
            assess: 0, charity: 0, freight: 0, gst: 0, tcs: 0, gross: 0,
            cenvat: 0, duty: 0, cess: 0, hcess: 0, other: 0, vat: 0,
            sgst: 0, cgst: 0, igst: 0, disc: 0, net: 0
        };

        const gstPer = num(config.gst_percentage);
        let sgstPer = num(config.sgst_percentage);
        let cgstPer = num(config.cgst_percentage);
        const igstPer = num(config.igst_percentage);

        if (igstPer === 0 && sgstPer === 0 && cgstPer === 0 && gstPer > 0) {
            sgstPer = gstPer / 2;
            cgstPer = gstPer / 2;
        }

        const splitGstPer = sgstPer + cgstPer;
        const taxPercentage = igstPer > 0 ? igstPer : (splitGstPer > 0 ? splitGstPer : gstPer);

        const salesType = currentFormData.sales_type;

        const updatedRows = rows.map((item) => {
            const product = listData.products.find(p => p.id === parseInt(item.product_id));
            const productName = String(item.product_description || product?.product_name || '').toLowerCase();
            const is68Product = productName.includes('68');

            const packs = num(item.packs);
            const bagWt = num(item.avg_content);
            const rateInput = num(item.rate);
            const totalKgs = is68Product ? num(item.total_kgs) : (packs * bagWt);

            const charityPerBale = salesType === 'GST SALES' || salesType === "DEPOT SALES" ? 3 : num(item.charity_per_bale || config.charity_value || 0);
            let charity = 0;
            if (salesType === 'GST SALES' || salesType === "DEPOT SALES" || config.charity_checked) {
                charity = totalKgs * charityPerBale;
            } else {
                charity = 0;
            }

            let assessableValue = 0;
            let gstAmount = 0;
            let igstAmount = 0;
            let sgstAmount = 0;
            let cgstAmount = 0;
            let vat = 0;
            let cenvat = 0;
            let duty = 0;
            let cess = 0;
            let hcess = 0;
            let basis = 0;
            let discAmt = 0;
            let rowTotal = 0;
            let totalInvoiceAmount = 0;
            let tcs = 0;

            if (isForward) {
                // FORWARD CALCULATION FLOW:
                assessableValue = is68Product ? (10 * packs * rateInput) : (totalKgs * rateInput);
                gstAmount = (assessableValue * taxPercentage) / 100;
                igstAmount = igstPer > 0 ? (assessableValue * igstPer / 100) : 0;
                sgstAmount = igstPer > 0 ? 0 : (sgstPer > 0 ? (assessableValue * sgstPer / 100) : (gstAmount / 2));
                cgstAmount = igstPer > 0 ? 0 : (cgstPer > 0 ? (assessableValue * cgstPer / 100) : (gstAmount / 2));
                vat = (assessableValue * num(item.vat_per)) / 100;
                cenvat = (assessableValue * num(item.cenvat_per)) / 100;
                duty = (assessableValue * num(item.duty_per)) / 100;
                cess = (assessableValue * num(item.cess_per)) / 100;
                hcess = (assessableValue * num(item.hcess_per)) / 100;

                const totalTax = (igstPer > 0 ? igstAmount : (sgstAmount + cgstAmount)) + vat + cenvat + duty + cess + hcess + num(item.other_amt);
                basis = assessableValue + totalTax + charity + num(item.freight_amt);
                discAmt = (num(item.discount_percentage) * basis) / 100;
                rowTotal = basis - discAmt;
                totalInvoiceAmount = rowTotal;
                tcs = (totalInvoiceAmount * num(item.tcs_per)) / 100;
            } else {
                // REVERSE CALCULATION FLOW:
                const rawTotalInvoiceAmount = is68Product ? (10 * packs * rateInput) : (totalKgs * rateInput);
                totalInvoiceAmount = is68Product ? rawTotalInvoiceAmount : Math.round(rawTotalInvoiceAmount);

                const taxDivisor = 1 + (taxPercentage / 100);
                const baseAmount = taxDivisor > 0 ? (totalInvoiceAmount / taxDivisor) : totalInvoiceAmount;
                gstAmount = (baseAmount * taxPercentage) / 100;
                assessableValue = totalInvoiceAmount - num(item.freight_amt) - charity - gstAmount;

                vat = (assessableValue * num(item.vat_per)) / 100;
                cenvat = (assessableValue * num(item.cenvat_per)) / 100;
                duty = (assessableValue * num(item.duty_per)) / 100;
                cess = (assessableValue * num(item.cess_per)) / 100;
                hcess = (assessableValue * num(item.hcess_per)) / 100;
                tcs = (totalInvoiceAmount * num(item.tcs_per)) / 100;

                basis = assessableValue + vat + cenvat + duty + cess + hcess + gstAmount + tcs + charity + num(item.other_amt) + num(item.freight_amt);
                discAmt = (num(item.discount_percentage) * basis) / 100;
                rowTotal = basis - discAmt;

                igstAmount = igstPer > 0 ? gstAmount : 0;
                sgstAmount = igstPer > 0 ? 0 : (sgstPer > 0 ? (gstAmount * sgstPer / taxPercentage) : (gstAmount / 2));
                cgstAmount = igstPer > 0 ? 0 : (cgstPer > 0 ? (gstAmount * cgstPer / taxPercentage) : (gstAmount / 2));
            }

            hTotals.assess += assessableValue;
            hTotals.charity += charity;
            hTotals.freight += num(item.freight_amt);
            hTotals.gst += gstAmount;
            hTotals.cgst += cgstAmount;
            hTotals.sgst += sgstAmount;
            hTotals.igst += igstAmount;
            hTotals.tcs += tcs;
            hTotals.gross += totalInvoiceAmount;
            hTotals.vat += vat;
            hTotals.cenvat += cenvat;
            hTotals.duty += duty;
            hTotals.cess += cess;
            hTotals.hcess += hcess;
            hTotals.other += num(item.other_amt);
            hTotals.disc += discAmt;
            hTotals.net += rowTotal;

            return {
                ...item,
                packs: packs,
                avg_content: bagWt,
                total_kgs: totalKgs,
                assessable_value: assessableValue,
                charity_amt: charity,
                gst_per: gstPer,
                sgst_per: sgstPer,
                cgst_per: cgstPer,
                igst_per: igstPer,
                gst_amt: igstPer > 0 ? 0 : gstAmount,
                sgst_amt: sgstAmount,
                cgst_amt: cgstAmount,
                igst_amt: igstAmount,
                vat_amt: vat,
                cenvat_amt: cenvat,
                duty_amt: duty,
                cess_amt: cess,
                hr_sec_cess_amt: hcess,
                tcs_amt: tcs,
                discount_amt: discAmt,
                sub_total: basis,
                final_value: rowTotal
            };
        });

        const finalRawTotal = hTotals.gross + num(currentFormData.pf_amount);
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
            total_gst: igstPer > 0 ? 0 : money(hTotals.gst),
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

        return updatedRows; // Return the updated rows
    }, [listData.types, listData.products]);
    // ==========================================
    // 3. EXPORT TO PDF - COMPACT TAX INVOICE FORMAT
    // ==========================================
    const exportToPDF = async () => {
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const data = formData;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 8;
        const right = pageWidth - margin;
        const contentWidth = pageWidth - (margin * 2);
        const midX = margin + 114;

        const fmt = (v, digits = 2) => {
            const n = Number(v);
            if (isNaN(n)) return digits === 0 ? '0' : '0.00';
            return n.toLocaleString('en-IN', {
                minimumFractionDigits: digits,
                maximumFractionDigits: digits
            });
        };

        const safe = (value, fallback = '') => {
            const text = value === null || value === undefined ? '' : String(value).trim();
            return text || fallback;
        };

        const party = listData.parties.find(p => String(p.id) === String(data.party_id)) || data.Party || {};
        const config = listData.types.find(t => String(t.id) === String(data.invoice_type_id)) || {};
        const items = gridRows.length ? gridRows : (data.Details || data.InvoiceDetails || []);

        const gstPer = num(config.gst_percentage);
        let cgstPer = num(config.cgst_percentage) || (items.length ? num(items[0]?.cgst_per) : 0);
        let sgstPer = num(config.sgst_percentage) || (items.length ? num(items[0]?.sgst_per) : 0);
        let igstPer = num(config.igst_percentage) || (items.length ? num(items[0]?.igst_per) : 0);
        const tcsPer = num(config.tcs_percentage) || (items.length ? num(items[0]?.tcs_per) : 0);

        if (igstPer === 0 && cgstPer === 0 && sgstPer === 0 && gstPer > 0) {
            cgstPer = gstPer / 2;
            sgstPer = gstPer / 2;
        }

        const totalGst = num(data.total_gst) || items.reduce((sum, r) => sum + num(r.gst_amt), 0);
        let totalCgst = num(data.total_cgst) || items.reduce((sum, r) => sum + num(r.cgst_amt), 0);
        let totalSgst = num(data.total_sgst) || items.reduce((sum, r) => sum + num(r.sgst_amt), 0);
        let totalIgst = num(data.total_igst) || items.reduce((sum, r) => sum + num(r.igst_amt), 0);

        if (igstPer > 0 && totalIgst === 0 && totalGst > 0) {
            totalIgst = totalGst;
        } else if (igstPer === 0 && totalCgst === 0 && totalSgst === 0 && totalGst > 0) {
            totalCgst = totalGst / 2;
            totalSgst = totalGst / 2;
        }

        const totalAssessable = items.reduce((sum, r) => sum + num(r.assessable_value || (num(r.total_kgs) * num(r.rate))), 0);

        const getHSN = (productId) => {
            const product = listData.products.find(p => String(p.id) === String(productId));
            return product?.printing_tariff_desc || '';
        };
        const getProductShortDesc = (productId) => {
            const product = listData.products.find(p => String(p.id) === String(productId));
            return product?.short_description || '';
        };

        const productDescs = [...new Set(items.map(r => r.product_description || getProductShortDesc(r.product_id)).filter(Boolean))];
        const hsnCodes = [...new Set(items.map(r => getHSN(r.product_id)).filter(Boolean))];
        const netAmount = num(data.final_invoice_value || data.net_amount || data.sub_total || totalAssessable);

        doc.setTextColor(0);
        doc.setDrawColor(0);
        doc.setLineWidth(0.2);

        // 1. Top Checkboxes & TAX INVOICE Title
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text("TAX INVOICE", pageWidth / 2, 17, { align: "center" });

        const checkbox = (label, x, y) => {
            doc.rect(x, y - 2.8, 3, 3);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);
            doc.text(label, x + 4.5, y);
        };

        checkbox("ORIGINAL FOR BUYER", right - 48, 8);
        checkbox("DUPLICATE FOR TRANSPORTER", right - 48, 12);
        checkbox("TRIPLICATE FOR FILE COPY", right - 48, 16);
        checkbox("EXTRA COPY", right - 48, 20);

        // 2. Company Header Box
        let y = 23;
        const companyHeight = 44;
        doc.rect(margin, y, contentWidth, companyHeight);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.text("KAYAAR EXPORTS PRIVATE LIMITED", margin + (contentWidth / 2) - 15, y + 6, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text("D.No: 43/5, Railway Feeder Road,", margin + (contentWidth / 2) - 15, y + 10.5, { align: "center" });
        doc.text("K.R. Nagar -628 503, Kovilpatti -Taluk", margin + (contentWidth / 2) - 15, y + 14.5, { align: "center" });
        doc.text("Tuticorin Dist., Tamilnadu, India", margin + (contentWidth / 2) - 15, y + 18.5, { align: "center" });
        doc.text("(04632) - 248258, 94432 38761", margin + (contentWidth / 2) - 15, y + 23, { align: "center" });
        doc.text("E-Mail : ttnkrgroup@gmail.com", margin + (contentWidth / 2) - 15, y + 27, { align: "center" });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("GSTIN : 33AAACK4468M1ZA", margin + (contentWidth / 2) - 15, y + 32, { align: "center" });

        // OEKO-TEX Box on right
        const certX = right - 46;
        const certW = 43;
        const certH = 30;
        doc.rect(certX, y + 3, certW, certH);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.text("OEKO-TEX ®", certX + (certW / 2), y + 7.5, { align: "center" });
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "normal");
        doc.text("CONFIDENCE IN TEXTILES", certX + (certW / 2), y + 11.5, { align: "center" });
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text("STANDARD 100", certX + (certW / 2), y + 16, { align: "center" });
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.text("18.HIN.60427 HOHENSTEIN HTTI", certX + (certW / 2), y + 20.5, { align: "center" });
        doc.setFontSize(5.2);
        doc.text("Tested for harmful substances", certX + (certW / 2), y + 25, { align: "center" });
        doc.text("www.oeko-tex.com/standard100", certX + (certW / 2), y + 29, { align: "center" });

        // PAN & CIN bottom row
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text("PAN : AAACK4468M", margin + 3, y + 40.5);
        doc.text("CIN : U51101TN1991PTC020933", right - 3, y + 40.5, { align: "right" });

        // 3. Party Details & Invoice Details Box
        y += companyHeight;
        const partyHeight = 38;
        doc.rect(margin, y, contentWidth, partyHeight);
        doc.line(midX, y, midX, y + partyHeight);

        // Left Side: Party
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text("Party Name & Address", margin + 3, y + 5);

        doc.setFontSize(9);
        doc.text(safe(party.account_name || data.party_name, "N/A").toUpperCase(), margin + 3, y + 10);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        const addressLines = [data.addr1, data.addr2, data.addr3].filter(Boolean);
        addressLines.slice(0, 3).forEach((line, idx) => {
            doc.text(safe(line).toUpperCase(), margin + 3, y + 14.5 + (idx * 4.2));
        });

        doc.setFont("helvetica", "bold");
        doc.text(`GST No: ${safe(party.gst_no || data.gst_no, "N/A")}`, margin + 3, y + 33.5);

        // Right Side: Invoice Meta
        const metaX = midX + 3;
        const metaValX = right - 3;
        const labelRow = (lbl, val, rowY, isBoldVal = true) => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.text(lbl, metaX, rowY);
            doc.text(":", metaX + 26, rowY);
            doc.setFont("helvetica", isBoldVal ? "bold" : "normal");
            doc.text(safe(val, "-"), metaValX, rowY, { align: "right" });
        };

        labelRow("Invoice No", data.invoice_no, y + 6);
        labelRow("Invoice Dt", fmtInvoiceDate(data.date), y + 12);
        labelRow("E-Way Bill No", data.ebill_no, y + 18);
        labelRow("Vehicle No", safe(data.vehicle_no).toUpperCase(), y + 24);
        labelRow("Delivery At", safe(data.delivery).toUpperCase(), y + 30);

        // 4. Description Bar & Table Header
        y += partyHeight;
        doc.rect(margin, y, contentWidth, 6.5);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("DESCRIPTION OF GOODS", margin + (midX - margin) / 2, y + 4.5, { align: "center" });

        y += 6.5;
        const colW = [24, 30, 44, 34, contentWidth - (24 + 30 + 44 + 34)]; // sums to contentWidth (194)
        const tableBody = (items.length ? items : [{}]).map(item => {
            const rowWeight = num(item.total_kgs);
            const rowAssessable = num(item.assessable_value || (rowWeight * num(item.rate)));
            const assessableRatePerKg = rowWeight > 0 ? (rowAssessable / rowWeight) : num(item.rate);
            return [
                String(item.packs || ''),
                fmt(rowWeight, 2),
                [item.from_no, item.to_no].filter(Boolean).join(" - ") || item.sl_no || '-',
                fmt(assessableRatePerKg, 2),
                fmt(rowAssessable, 2)
            ];
        });

        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            tableWidth: contentWidth,
            head: [["No of Bags", "Net Weight", "S.L No", "Rate Per Kgs", "Assessable Value"]],
            body: tableBody,
            theme: "grid",
            styles: {
                font: "helvetica",
                fontSize: 8,
                textColor: 0,
                lineColor: 0,
                lineWidth: 0.2,
                cellPadding: 2,
                minCellHeight: 7,
                valign: "middle"
            },
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: 0,
                fontStyle: "bold",
                halign: "center",
                fontSize: 7.5
            },
            bodyStyles: {
                fontStyle: "bold",
                halign: "center"
            },
            columnStyles: {
                0: { cellWidth: colW[0], halign: "center" },
                1: { cellWidth: colW[1], halign: "center" },
                2: { cellWidth: colW[2], halign: "center" },
                3: { cellWidth: colW[3], halign: "right" },
                4: { cellWidth: colW[4], halign: "right" }
            }
        });

        y = doc.lastAutoTable.finalY;

        // 5. Split Box: Description & Taxes
        const splitH = 58;
        doc.rect(margin, y, contentWidth, splitH);
        doc.line(midX, y, midX, y + splitH);

        // Left Side: Goods Description
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        let descY = y + 6;
        productDescs.forEach(desc => {
            doc.text(safe(desc).toUpperCase(), margin + 3, descY);
            descY += 4.5;
        });

        doc.setFontSize(7.5);
        doc.text(`HSN CODE: ${hsnCodes.join(", ") || "52052790"}`, margin + 3, y + 20);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text("Whether the Tax Payable on Reverse Charges Basis ?    Yes / No", margin + 3, y + splitH - 4);

        // Right Side: Tax & Charge Rows
        const rightLabelX = midX + 3;
        const rightValX = right - 3;
        let taxY = y + 5;
        const taxLineHeight = 5.2;

        const renderTaxRow = (lbl, val, isBold = false) => {
            doc.setFont("helvetica", isBold ? "bold" : "normal");
            doc.setFontSize(7.5);
            doc.text(lbl, rightLabelX, taxY);
            if (val !== undefined && val !== null && val !== '') {
                doc.text(fmt(val, 2), rightValX, taxY, { align: "right" });
            }
            taxY += taxLineHeight;
        };

        renderTaxRow("TOTAL ASSESSABLE", data.total_assessable || totalAssessable, true);
        if (num(data.total_charity) > 0) {
            renderTaxRow("CHARITY", data.total_charity, true);
        }
        if (num(data.freight || data.freight_charges) > 0) {
            renderTaxRow("FREIGHT", data.freight || data.freight_charges, true);
        }
        renderTaxRow(`C.G.S.T   :   ${cgstPer.toFixed(2)} %`, totalCgst > 0 ? totalCgst : '');
        renderTaxRow(`S.G.S.T   :   ${sgstPer.toFixed(2)} %`, totalSgst > 0 ? totalSgst : '');
        renderTaxRow(`I.G.S.T   :   ${igstPer.toFixed(2)} %`, totalIgst > 0 ? totalIgst : '');

        // Subtotal divider line with clean spacing
        taxY += 1;
        doc.line(midX, taxY - 1.5, right, taxY - 1.5);
        taxY += 2;
        renderTaxRow("", data.sub_total || (totalAssessable + num(data.total_charity) + num(data.freight || data.freight_charges) + num(data.total_gst) + num(data.total_cgst) + num(data.total_sgst) + num(data.total_igst)), true);

        renderTaxRow(`TCS         :   ${tcsPer.toFixed(3)} %`, data.total_tcs || 0);

        // Net Amount divider line with generous clearance
        taxY += 1;
        doc.line(midX, taxY - 1.5, right, taxY - 1.5);
        taxY += 3.8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text("Net Amount", rightLabelX, taxY);
        doc.text(fmt(netAmount, 2), rightValX, taxY, { align: "right" });

        // 6. Rupees in Words Box
        y += splitH;
        const wordsH = 8;
        doc.rect(margin, y, contentWidth, wordsH);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text("Rupees :", margin + 3, y + 5.5);
        doc.text(numberToWords(netAmount), margin + 18, y + 5.5);

        // 7. Declaration & Signatures Box
        y += wordsH;
        const signH = 34;
        doc.rect(margin, y, contentWidth, signH);
        doc.line(midX, y, midX, y + signH);

        // Left Side Declaration
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        const decText = "Certified that the particulars given above are true and Correct and Amount indicated represents the price actually charged and that there are no following of additional consideration directly or indirectly from the buyer";
        doc.text(doc.splitTextToSize(decText, midX - margin - 6), margin + 3, y + 4.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.text("E.& O.E", margin + 3, y + 17);

        doc.text("Prepared by", margin + 15, y + signH - 4);
        doc.text("Checked by", margin + 65, y + signH - 4);

        // Right Side Signature
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text("For KAYAAR EXPORTS PRIVATE LIMITED", midX + (right - midX) / 2, y + 5.5, { align: "center" });
        doc.text("Director/Authorised Signatory", midX + (right - midX) / 2, y + signH - 4, { align: "center" });

        doc.save(`${data.invoice_no || 'invoice'}.pdf`);
    };
    const exportToJSON = () => {
        // 1. Find the Depot Name from the list based on selection
        const selectedDepot = listData.depots.find(d => d.id === parseInt(formData.depot_id));
        const depotName = selectedDepot ? selectedDepot.account_name : "INV";

        // 2. Generate Initials (e.g., "Depot Mumbai" -> "DM")
        const shortName = depotName
            .split(' ')                  // Split by space ["Depot", "Mumbai"]
            .filter(word => word.length > 0)
            .map(word => word[0])        // Take first letter ["D", "M"]
            .join('')                    // Join them "DM"
            .toUpperCase();              // Ensure uppercase

        // 3. Construct Filename: [Initials]-[InvoiceNo].json
        const invNo = formData.invoice_no || '000';
        const fileName = formData.invoice_no ? `${formData.invoice_no}.json` : 'depot_invoice.json';

        // 4. Data Preparation
        const exportData = {
            ...formData,
            Details: gridRows
        };

        // 5. Blob and Download execution
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = fileName; // Uses the generated name (e.g., DM-101.json)

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
    // ==========================================
    // 4. DATA LOAD
    // ==========================================
    const init = async () => {
        setLoading(true);
        try {
            const [
                invoiceTypesRes,
                accountsRes,
                transportsRes,
                productsRes,
                brokersRes,
                ordersRes,
                depotSalesRes,
                invoicesRes,
                despatchRes,
                directInvoicesRes
            ] = await Promise.all([
                mastersAPI.invoiceTypes.getAll(),
                mastersAPI.accounts.getAll(),
                mastersAPI.transports.getAll(),
                mastersAPI.products.getAll(),
                mastersAPI.brokers.getAll(),
                transactionsAPI.orders.getAll(),
                transactionsAPI.depotSales.getAll(),
                transactionsAPI.invoices.getAll(),
                transactionsAPI.despatch.getAll(),
                transactionsAPI.directInvoices.getAll()
            ]);
            const accs = accountsRes.data.data || [];

            setListData({
                types: invoiceTypesRes.data.data || [],
                parties: accs.filter(a => a.account_group?.toUpperCase() === 'DEBTORS - DEPOT - PARTIES'),
                depots: accs.filter(a => a.account_group?.toUpperCase() === 'DEBTORS - DEPOT - SALES'),
                transports: transportsRes.data.data || [],
                products: productsRes.data.data || [],
                orders: ordersRes.data.data || [],
                history: depotSalesRes.data.data || [],
                brokers: brokersRes.data.data || [],
                invoices: invoicesRes.data.data || [],
                loads: despatchRes.data.data || [],
                directInvoices: directInvoicesRes.data.data || []
            });
        } catch (e) {
            console.error("REST Init Error:", e);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { 
        init(); 
        resetFilters([
            { value: 'invoice_no', label: 'Invoice No' },
            { value: 'depot', label: 'Depot Name' },
            { value: 'party', label: 'Party Name' }
        ], 'invoice_no', true);
    }, []);
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

        const order = source === 'WITH'
            ? listData.orders.find(o => o.order_no === orderNo)
            : listData.directInvoices.find(o => o.order_no === orderNo);

        if (!order) return;

        const details = order?.OrderDetails || order?.DirectInvoiceDetails || order?.Details || order?.details || [];

        // 🔵 AUTO FILL HEADER
        const party = order.Party || {};
        const broker = order.Broker || {};

        setFormData(prev => ({
            ...prev,
            header_locked: true
        }));

        // 🔵 CREATE GRID ROWS
        const newRows = details.map(d => {
            const packs = d.packs || d.qty || 0;
            const bagWt = d.bag_wt || 0;

            return {
                order_no: orderNo,
                order_type: source === 'WITH' ? 'WITH_ORDER' : 'WITHOUT_ORDER',
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
            runCalculations([...gridRows, ...newRows], formData.invoice_type_id, formData)
        );

        e.target.value = "";
    };
    const updateGrid = (idx, field, val) => {
        setGridRows(prev => {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], [field]: val };
            return runCalculations(updated, formData.invoice_type_id, formData);
        });
    };
    const handleSave = async () => {
        if (!formData.depot_id || gridRows.length === 0) return;

        setSubmitLoading(true);
        try {
            const { id, ...header } = formData;

            // Construct the payload with proper formatting
            const payload = {
                ...header,
                invoice_type_id: header.invoice_type_id ? Number(header.invoice_type_id) : null,
                removal_time: toNullableDateTime(header.removal_time),
                depot_id: header.depot_id ? Number(header.depot_id) : null,
                party_id: header.party_id ? Number(header.party_id) : null,
                broker_id: header.broker_id ? Number(header.broker_id) : null,
                transport_id: header.transport_id ? Number(header.transport_id) : null,
                credit_days: Number(header.credit_days) || 0,
                interest_pct: Number(header.interest_pct) || 0,
                total_assessable: Number(header.total_assessable) || 0,
                total_charity: Number(header.total_charity) || 0,
                total_vat: Number(header.total_vat) || 0,
                total_cenvat: Number(header.total_cenvat) || 0,
                total_duty: Number(header.total_duty) || 0,
                total_cess: Number(header.total_cess) || 0,
                total_hr_sec_cess: Number(header.total_hr_sec_cess) || 0,
                total_gst: Number(header.total_gst) || 0,
                total_sgst: Number(header.total_sgst) || 0,
                total_cgst: Number(header.total_cgst) || 0,
                total_igst: Number(header.total_igst) || 0,
                total_discount: Number(header.total_discount) || 0,
                total_other: Number(header.total_other) || 0,
                pf_amount: Number(header.pf_amount) || 0,
                freight: Number(header.freight) || 0,
                sub_total: Number(header.sub_total) || 0,
                round_off: Number(header.round_off) || 0,
                final_invoice_value: Number(header.final_invoice_value) || 0,
                Details: gridRows.map((r) => ({
                    ...r,
                    product_id: r.product_id ? Number(r.product_id) : null,
                    packs: Number(r.packs) || 0,
                    total_kgs: Number(r.total_kgs) || 0,
                    avg_content: Number(r.avg_content) || 0,
                    broker_percentage: Number(r.broker_percentage) || 0,
                    rate: Number(r.rate) || 0,
                    resale: Number(r.resale) || 0,
                    convert_to_hank: Number(r.convert_to_hank) || 0,
                    convert_to_cone: Number(r.convert_to_cone) || 0,
                    assessable_value: Number(r.assessable_value) || 0,
                    charity_amt: Number(r.charity_amt) || 0,
                    vat_per: Number(r.vat_per) || 0,
                    vat_amt: Number(r.vat_amt) || 0,
                    cenvat_per: Number(r.cenvat_per) || 0,
                    cenvat_amt: Number(r.cenvat_amt) || 0,
                    duty_per: Number(r.duty_per) || 0,
                    duty_amt: Number(r.duty_amt) || 0,
                    cess_per: Number(r.cess_per) || 0,
                    cess_amt: Number(r.cess_amt) || 0,
                    hcess_per: Number(r.hcess_per) || 0,
                    hcess_amt: Number(r.hcess_amt) || 0,
                    gst_per: Number(r.gst_per) || 0,
                    gst_amt: Number(r.gst_amt) || 0,
                    sgst_per: Number(r.sgst_per) || 0,
                    sgst_amt: Number(r.sgst_amt) || 0,
                    cgst_per: Number(r.cgst_per) || 0,
                    cgst_amt: Number(r.cgst_amt) || 0,
                    igst_per: Number(r.igst_per) || 0,
                    igst_amt: Number(r.igst_amt) || 0,
                    tcs_per: Number(r.tcs_per) || 0,
                    tcs_amt: Number(r.tcs_amt) || 0,
                    discount_percentage: Number(r.discount_percentage) || 0,
                    discount_amt: Number(r.discount_amt) || 0,
                    other_amt: Number(r.other_amt) || 0,
                    freight_amt: Number(r.freight_amt) || 0,
                    sub_total: Number(r.sub_total) || 0,
                    rounded_off: Number(r.rounded_off) || 0,
                    final_value: Number(r.final_value) || 0
                }))
            };

            if (formData.id) {
                await transactionsAPI.depotSales.update(formData.id, payload);
            } else {
                await transactionsAPI.depotSales.create(payload);
            }

            await init();
            setIsModalOpen(false);
        } catch (e) {
            console.error("Save Error: " + e.message);
        } finally {
            setSubmitLoading(false);
        }
    };

    const loadInvoice = async (id) => {
        try {
            setSubmitLoading(true);
            const data = await transactionsAPI.depotSales.getOne(id);
            const full = data.data.data;
            if (!full) return;

            const formatted = {
                ...full,
                removal_time: full.removal_time
                    ? String(full.removal_time).replace(' ', 'T').slice(0, 16)
                    : '',
                addr1: full.addr1 || full.Party?.addr1 || '',
                addr2: full.addr2 || full.Party?.addr2 || '',
                addr3: full.addr3 || full.Party?.addr3 || ''
            };

            setFormData(formatted);
            const rows = full.DepotSalesDetails || [];
            setGridRows(rows);
            setIsModalOpen(true);
        } catch (err) {
            console.error("Error loading depot sales invoice:", err);
            alert("Failed to load invoice details");
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleRowClick = (item) => {
        if (isSelectionMode) {
            setSelectedIds(prev =>
                prev.includes(item.id)
                    ? prev.filter(id => id !== item.id)
                    : [...prev, item.id]
            );
        } else {
            loadInvoice(item.id);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to permanently delete the ${selectedIds.length} selected depot invoices? This action cannot be undone.`)) {
            return;
        }

        setSubmitLoading(true);
        try {
            await transactionsAPI.depotSales.bulkDelete(selectedIds);
            setSelectedIds([]);
            setIsSelectionMode(false);
            await init();
        } catch (e) {
            console.error("Bulk delete error:", e);
            alert("Error performing bulk delete");
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleExcelImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xls,.xlsx';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            setImportLoading(true);
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    const parsedList = [];

                    for (let i = 0; i < rawRows.length; i++) {
                        const row = rawRows[i];
                        if (!row || row.length === 0) continue;

                        const col0 = row[0];
                        const invNum = parseInt(col0, 10);
                        if (isNaN(invNum) || invNum <= 0) continue;

                        let dateVal = row[1];
                        let partyName = String(row[2] || '').trim();
                        let count = String(row[3] || '').trim();

                        let isDepotSheetLayout = false;
                        if (typeof row[4] === 'number' && typeof row[5] === 'number') {
                            isDepotSheetLayout = true;
                        }

                        let formattedDate = null;
                        let packs = 0;
                        let totalKgs = 0;
                        let assessableValue = 0;
                        let charity = 0;
                        let subTotal = 0;
                        let gst = 0;
                        let invoiceValue = 0;
                        let addr1 = '';
                        let addr2 = '';
                        let addr3 = '';
                        let place = '';
                        let cst_no = '';
                        let gst_no = '';

                        if (isDepotSheetLayout) {
                            if (dateVal instanceof Date) {
                                formattedDate = dateVal.toISOString().split('T')[0];
                            } else if (typeof dateVal === 'number') {
                                const parsedDate = new Date((dateVal - 25569) * 86400 * 1000);
                                if (!isNaN(parsedDate.getTime())) {
                                    formattedDate = parsedDate.toISOString().split('T')[0];
                                }
                            } else if (typeof dateVal === 'string') {
                                const cleanDate = dateVal.split('T')[0];
                                if (cleanDate && !isNaN(Date.parse(cleanDate))) {
                                    formattedDate = cleanDate;
                                }
                            }
                            if (!formattedDate) {
                                formattedDate = new Date().toISOString().split('T')[0];
                            }

                            partyName = String(row[2] || '').trim();
                            count = String(row[3] || '').trim();
                            packs = num(row[4]);
                            totalKgs = num(row[5]);
                            assessableValue = num(row[6]);
                            charity = num(row[7]);
                            subTotal = num(row[8]);
                            gst = num(row[9]);
                            invoiceValue = num(row[10]);
                            addr1 = String(row[11] || '').trim();
                            if (addr1 === '-' || addr1 === '0') addr1 = '';
                            addr2 = String(row[12] || '').trim();
                            if (addr2 === '-' || addr2 === '0') addr2 = '';
                            addr3 = String(row[13] || '').trim();
                            if (addr3 === '-' || addr3 === '0') addr3 = '';
                            place = String(row[14] || '').trim();
                            if (place === '-' || place === '---') place = '';
                            cst_no = String(row[15] || '').trim();
                            if (cst_no === '-' || cst_no === '0') cst_no = '';
                            gst_no = String(row[16] || '').trim();
                            if (gst_no === '-' || gst_no === '0') gst_no = '';
                        } else {
                            dateVal = row[13];
                            if (dateVal instanceof Date) {
                                formattedDate = dateVal.toISOString().split('T')[0];
                            } else if (typeof dateVal === 'number') {
                                const parsedDate = new Date((dateVal - 25569) * 86400 * 1000);
                                if (!isNaN(parsedDate.getTime())) {
                                    formattedDate = parsedDate.toISOString().split('T')[0];
                                }
                            } else if (typeof dateVal === 'string') {
                                const cleanDate = dateVal.split('T')[0];
                                if (cleanDate && !isNaN(Date.parse(cleanDate))) {
                                    formattedDate = cleanDate;
                                }
                            }
                            if (!formattedDate) {
                                formattedDate = new Date().toISOString().split('T')[0];
                            }

                            partyName = String(row[1] || '').trim();
                            count = String(row[2] || '').trim();
                            packs = num(row[3]);
                            totalKgs = num(row[4]);
                            invoiceValue = num(row[8]);
                            assessableValue = invoiceValue;
                            subTotal = invoiceValue;
                            addr1 = String(row[14] || '').trim();
                            addr2 = String(row[15] || '').trim();
                            addr3 = String(row[16] || '').trim();
                            place = String(row[17] || '').trim();
                        }

                        const cleanParty = partyName.trim().toLowerCase();
                        if (!cleanParty || cleanParty === 'total' || cleanParty === 'grand total' || cleanParty === 'sub total') continue;

                        const rate = totalKgs > 0 ? (assessableValue / totalKgs) : 0;
                        const avgContent = packs > 0 && totalKgs > 0 ? (totalKgs / packs) : 0;

                        parsedList.push({
                            excelInvNo: String(col0),
                            date: formattedDate,
                            partyName,
                            product_name: count,
                            count,
                            packs,
                            total_kgs: totalKgs,
                            avg_content: avgContent,
                            rate,
                            assessable_value: assessableValue,
                            charity_amt: charity,
                            sub_total: subTotal,
                            gst_amt: gst,
                            final_value: invoiceValue,
                            addr1,
                            addr2,
                            addr3,
                            place,
                            cst_no,
                            gst_no,
                            rows: [{
                                product_name: count,
                                packs,
                                total_kgs: totalKgs,
                                avg_content: avgContent,
                                rate,
                                assessable_value: assessableValue,
                                charity_amt: charity,
                                sub_total: subTotal,
                                gst_amt: gst,
                                final_value: invoiceValue
                            }]
                        });
                    }

                    if (parsedList.length === 0) {
                        alert("No valid invoice data rows found in the selected Excel file.");
                        return;
                    }

                    setImportInvoices(parsedList);
                    if (listData.depots.length > 0 && !importDepotId) {
                        setImportDepotId(listData.depots[0].id);
                    }
                    setImportModalOpen(true);
                } catch (err) {
                    console.error("Excel parse error:", err);
                    alert("Failed to parse Excel file. Please verify file format.");
                } finally {
                    setImportLoading(false);
                }
            };
            reader.onerror = () => {
                alert("Failed to read Excel file.");
                setImportLoading(false);
            };
            reader.readAsArrayBuffer(file);
        };
        input.click();
    };

    const handleConfirmImport = async () => {
        if (!importDepotId) {
            alert("Please select a Depot Name before importing.");
            return;
        }

        setImportLoading(true);
        try {
            const payload = {
                depot_id: Number(importDepotId),
                invoices: importInvoices
            };
            const res = await transactionsAPI.depotSales.bulkImportSave(payload);
            alert(res.data.message || "Depot Sales Bulk Import Completed Successfully!");
            setImportModalOpen(false);
            setImportInvoices([]);
            await init();
        } catch (err) {
            console.error("Import save error:", err);
            alert(err.response?.data?.error || "Import failed during saving.");
        } finally {
            setImportLoading(false);
        }
    };

    const filteredHistory = useMemo(() => {
        let history = Array.isArray(listData.history) ? listData.history : [];

        if (fromDate) {
            history = history.filter(item => item.date >= fromDate);
        }
        if (toDate) {
            history = history.filter(item => item.date <= toDate);
        }

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
            })
            .sort((a, b) => {
                let aVal, bVal;
                if (sortField === 'invoice_no') {
                    aVal = String(a.invoice_no || '');
                    bVal = String(b.invoice_no || '');
                    return sortOrder === 'asc'
                        ? aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' })
                        : bVal.localeCompare(aVal, undefined, { numeric: true, sensitivity: 'base' });
                } else if (sortField === 'date') {
                    aVal = new Date(a.date || 0).getTime();
                    bVal = new Date(b.date || 0).getTime();
                } else if (sortField === 'depot') {
                    aVal = String(a.Depot?.account_name || '');
                    bVal = String(b.Depot?.account_name || '');
                    return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                } else if (sortField === 'party') {
                    aVal = String(a.Party?.account_name || '');
                    bVal = String(b.Party?.account_name || '');
                    return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                } else {
                    aVal = a.id || 0;
                    bVal = b.id || 0;
                }

                if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
                return 0;
            });
    }, [listData.history, searchValue, searchField, searchCondition, fromDate, toDate, sortField, sortOrder]);

    useEffect(() => {
        setPage(1);
    }, [searchValue, searchField, searchCondition]);

    const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
    const pagedHistory = useMemo(() => {
        const safePage = Math.min(page, totalPages);
        const start = (safePage - 1) * pageSize;
        return filteredHistory.slice(start, start + pageSize);
    }, [filteredHistory, page, pageSize, totalPages]);

    return (
        <div className="min-h-screen bg-slate-100 p-6 font-sans">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Warehouse className="text-blue-600" /> Depot Sales Registry
                </h1>
                <div className="flex items-center gap-2">
                    {!isSelectionMode ? (
                        <button
                            onClick={() => setIsSelectionMode(true)}
                            className="bg-white border border-slate-300 text-slate-700 px-5 py-2 rounded-lg font-bold uppercase text-xs flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
                        >
                            Select Multiple
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }}
                                className="bg-white border border-slate-300 text-slate-700 px-5 py-2 rounded-lg font-bold uppercase text-xs flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
                            >
                                Clear Selection
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                disabled={selectedIds.length === 0}
                                className="bg-red-600 text-white px-5 py-2 rounded-lg font-bold uppercase text-xs flex items-center gap-2 shadow-md hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Trash2 size={16} /> Delete Selected ({selectedIds.length})
                            </button>
                        </div>
                    )}
                    <button
                        onClick={handleExcelImport}
                        disabled={importLoading}
                        className="bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold uppercase text-xs flex items-center gap-2 shadow-md hover:bg-emerald-700 transition-all disabled:opacity-50"
                    >
                        <FileSpreadsheet size={16} /> {importLoading ? 'Reading...' : 'Import Excel'}
                    </button>
                    <button
                        onClick={() => {
                            const seq = getNextDepotInvoiceSequence(listData.history, '', '');
                            setFormData({ ...emptyInvoice, invoice_no: seq.toString(), header_locked: false });
                            setGridRows([]); setIsModalOpen(true);
                        }}
                        className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold uppercase text-xs flex items-center gap-2 shadow-md hover:bg-blue-700"
                    >
                        <Plus size={16} /> New Depot Invoice
                    </button>
                </div>
            </div>
            
            <LocalSearchBar searchCondition={searchCondition} setSearchCondition={setSearchCondition} />

            {/* Search Bar - Handled in Sidebar */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-6 flex justify-end items-center">
                <div className="bg-blue-50 text-blue-700 border border-blue-200 px-6 py-1.5 rounded text-xs font-bold">
                    {filteredHistory.length} Matches
                </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex flex-col">
                    <table className="w-full text-left">
                        <thead className="bg-slate-900 text-white text-[10px] uppercase font-bold tracking-wider">
                            <tr>
                                {isSelectionMode && <th className="p-3 w-12 text-center">Select</th>}
                                <th className="p-3 cursor-pointer select-none" onClick={() => handleSort('invoice_no')}>
                                    Inv # {sortField === 'invoice_no' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th className="p-3 cursor-pointer select-none" onClick={() => handleSort('date')}>
                                    Date {sortField === 'date' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th className="p-3 cursor-pointer select-none" onClick={() => handleSort('depot')}>
                                    Depot {sortField === 'depot' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th className="p-3 cursor-pointer select-none" onClick={() => handleSort('party')}>
                                    Party {sortField === 'party' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th className="p-3 text-right">Net Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">

                            {pagedHistory.map(item => (
                                <tr key={item.id} className={`hover:bg-blue-50 cursor-pointer ${selectedIds.includes(item.id) ? 'bg-blue-100/50' : ''}`} onClick={() => handleRowClick(item)}>
                                    {isSelectionMode && (
                                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                            {selectedIds.includes(item.id) ? (
                                                <CheckSquare size={18} className="text-blue-600 mx-auto" />
                                            ) : (
                                                <Square size={18} className="text-slate-300 mx-auto" />
                                            )}
                                        </td>
                                    )}
                                    <td className="p-3 font-bold text-blue-600 font-mono">{item.invoice_no}</td>
                                    <td className="p-3 text-slate-500 font-sans">{item.date}</td>
                                    <td className="p-3 uppercase text-xs font-semibold">{item.Depot?.account_name}</td>
                                    <td className="p-3 uppercase font-bold text-xs">{item.Party?.account_name}</td>
                                    <td className="p-3 text-right font-black font-mono">₹{parseFloat(item.final_invoice_value).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 🟢 START: PAGINATION CONTROLS */}
            <div className="flex justify-between items-center mt-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-slate-600">
                        Page {page} of {totalPages}
                    </span>
                    <select
                        value={pageSize}
                        onChange={e => {
                            setPageSize(Number(e.target.value));
                            setPage(1); // Reset to first page on page size change
                        }}
                        className="border border-slate-300 p-1 text-xs font-bold rounded"
                    >
                        <option value={10}>10 per page</option>
                        <option value={20}>20 per page</option>
                        <option value={50}>50 per page</option>
                        <option value={100}>100 per page</option>
                    </select>
                </div>


                <div className="flex gap-2">
                    <button
                        onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                        disabled={page === 1}
                        className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={page === totalPages}
                        className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                    >
                        Next
                    </button>
                </div>
            </div>
            {/* 🟢 END: PAGINATION CONTROLS */}


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
                                                // { value: 'GST SALES', label: 'GST SALES' },
                                                { value: 'DEPOT SALES', label: 'DEPOT SALES' },
                                                // { value: 'DIRECT SALES', label: 'DIRECT SALES' }
                                            ]}
                                            onChange={e => setFormData({
                                                ...formData,
                                                sales_type: e.target.value,
                                                invoice_type_id: '' // 🟢 Clear selected ID to prevent invalid mapping
                                            })}
                                        />
                                        <RowSelect label="Invoice Type" isSearchable={false} value={formData.invoice_type_id} options={filteredInvoiceTypes.map(t => ({ value: t.id, label: t.type_name }))} onChange={e => setFormData({ ...formData, invoice_type_id: e.target.value })} />
                                        <RowSelect label="Depot Name" value={formData.depot_id} options={listData.depots.map(d => ({ value: d.id, label: d.account_name }))}
                                            onChange={e => {
                                                const depotId = parseInt(e.target.value);
                                                const depotAcc = listData.depots.find(d => d.id === depotId);
                                                const partyAcc = listData.parties.find(p => p.id === parseInt(formData.party_id));

                                                const historyExcludingCurrent = formData.id 
                                                    ? listData.history.filter(item => item.id !== formData.id)
                                                    : listData.history;
                                                const seq = getNextDepotInvoiceSequence(
                                                    historyExcludingCurrent,
                                                    depotAcc?.account_name || '',
                                                    partyAcc?.account_name || ''
                                                );
                                                const updatedInvNo = seq.toString();

                                                setFormData(prev => ({
                                                    ...prev,
                                                    depot_id: e.target.value,
                                                    invoice_no: updatedInvNo
                                                }));
                                            }}
                                        />
                                        <RowSelect label="Party Name" value={formData.party_id} disabled={formData.header_locked} options={listData.parties.map(p => ({ value: p.id, label: p.account_name }))}
                                            onChange={e => {
                                                const partyId = parseInt(e.target.value);
                                                const acc = listData.parties.find(a => a.id === partyId);
                                                console.log("Selected Party:", acc);
                                                if (!acc) return;

                                                const depotAcc = listData.depots.find(d => d.id === parseInt(formData.depot_id));

                                                const historyExcludingCurrent = formData.id 
                                                    ? listData.history.filter(item => item.id !== formData.id)
                                                    : listData.history;
                                                const seq = getNextDepotInvoiceSequence(
                                                    historyExcludingCurrent,
                                                    depotAcc?.account_name || '',
                                                    acc.account_name || ''
                                                );
                                                const updatedInvNo = seq.toString();

                                                setFormData(prev => ({
                                                    ...prev,
                                                    party_id: partyId,
                                                    addr1: acc.addr1 ?? '',
                                                    addr2: acc.addr2 ?? '',
                                                    addr3: acc.addr3 ?? '',
                                                    invoice_no: updatedInvNo
                                                }));
                                            }}
                                        />

                                        <RowInput label="Address 1" value={formData.addr1} readOnly={formData.header_locked} onChange={e => setFormData({ ...formData, addr1: e.target.value })} />
                                        <RowInput label="Address 2" value={formData.addr2} readOnly={formData.header_locked} onChange={e => setFormData({ ...formData, addr2: e.target.value })} />
                                        <RowInput label="Address 3" value={formData.addr3} readOnly={formData.header_locked} onChange={e => setFormData({ ...formData, addr3: e.target.value })} />
                                        <div className="grid grid-cols-3 gap-2">
                                            <RowInput label="Credit Days" type="number" value={formData.credit_days} onChange={e => setFormData({ ...formData, credit_days: e.target.value })} />
                                            <RowInput label="Interest %" type="number" value={formData.interest_pct} onChange={e => setFormData({ ...formData, interest_pct: e.target.value })} />
                                            {/* Pay Mode dropdown exists below */}
                                            <div />
                                        </div>

                                        <RowSelect label="Agent Name" value={formData.broker_id} options={listData.brokers.map(b => ({ value: b.id, label: b.broker_name }))} onChange={e => setFormData({ ...formData, broker_id: e.target.value })} />
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
                                        <h3 className="text-[10px] text-blue-800 mb-1 border-b pb-1 uppercase tracking-tighter font-black">Aggregate Value</h3>

                                        <TotalRow label="Assessable Value" value={formData.total_assessable} />
                                        <TotalRow label="Charity" value={formData.total_charity} />

                                        {/* GST Group */}
                                        <div className="bg-blue-50/30 p-0.5 rounded border border-blue-100 my-0.5">
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
                                        <TotalRow label="TCS Amount" value={formData.total_tcs} color="text-amber-700" />
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
                                    <div className="bg-[#EBF2FA] p-3 border border-slate-300 flex items-center justify-between rounded shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <span className="text-[10px] font-black uppercase text-blue-700">Sync Mill Order:</span>
                                            <select onChange={handleOrderSync} className="border border-slate-300 text-[11px] p-1 w-72 font-bold rounded bg-white">
                                                 <option value="">-- Choose Order --</option>
                                                 {listData.orders.map(o => <option key={`with-${o.id}`} value={`WITH|${o.order_no}`}>{o.order_no}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-[10px] font-black uppercase text-blue-700">Sync Direct Doc:</span>
                                            <select onChange={handleOrderSync} className="border border-slate-300 text-[11px] p-1 w-72 font-bold rounded bg-white">
                                                 <option value="">-- Direct Doc --</option>
                                                 {listData.directInvoices.map(o => <option key={`without-${o.id}`} value={`WITHOUT|${o.order_no}`}>{o.order_no}</option>)}
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
                                                    {/* Row 2: Sub-headers - UPDATED TO 11 PAIRS */}
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
                                <button
                                    onClick={() => handlePrint({ ...formData, Details: gridRows, InvoiceDetails: gridRows })}
                                    disabled={gridRows.length === 0}
                                    className="bg-indigo-600 text-white px-5 py-2 text-[11px] font-black rounded flex items-center gap-2 shadow hover:bg-indigo-700 transition-all"
                                >
                                    <Printer size={16} /> PRINT INVOICE
                                </button>
                                <button onClick={exportToPDF} disabled={gridRows.length === 0} className="bg-emerald-600 text-white px-6 py-2 text-[11px] font-black rounded flex items-center gap-2 shadow hover:bg-emerald-700">
                                    <FileText size={16} /> DOWNLOAD PDF
                                </button>
                            </div>
                            <button
                                onClick={exportToJSON}
                                disabled={gridRows.length === 0 || !formData.depot_id}
                                className="bg-indigo-600 text-white px-6 py-2 text-[11px] font-black rounded flex items-center gap-2 shadow hover:bg-indigo-700 transition-all active:scale-95 disabled:bg-slate-400 disabled:cursor-not-allowed"
                            >
                                <Calculator size={16} /> JSON EXPORT
                            </button>
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

            {/* 🟢 START: EXCEL IMPORT MODAL */}
            {importModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[1200px] flex flex-col overflow-hidden border border-slate-300 max-h-[92vh]">
                        {/* Header */}
                        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                                    <FileSpreadsheet size={20} />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold uppercase tracking-wider">Import Depot Sales Excel</h2>
                                    <p className="text-xs text-slate-400 font-medium">Select target Depot and review parsed sales invoices</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setImportModalOpen(false); setImportInvoices([]); }}
                                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
                            {/* Depot Selector Card */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="flex-1 w-full md:w-auto">
                                    <label className="block text-xs font-black uppercase text-slate-700 tracking-wider mb-1.5">
                                        Target Depot Name <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={importDepotId}
                                        onChange={(e) => setImportDepotId(e.target.value)}
                                        className="w-full md:w-80 h-10 bg-white border border-slate-300 rounded-lg px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">-- Select Depot --</option>
                                        {listData.depots.map(d => (
                                            <option key={d.id} value={d.id}>{d.account_name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Summary Stats */}
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-center shadow-sm">
                                        <span className="text-[10px] font-black uppercase text-slate-400 block">Total Records</span>
                                        <span className="text-sm font-black text-slate-800">{importInvoices.length}</span>
                                    </div>
                                    <div className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-center shadow-sm">
                                        <span className="text-[10px] font-black uppercase text-slate-400 block">Total Bags</span>
                                        <span className="text-sm font-black text-blue-600">
                                            {importInvoices.reduce((sum, i) => sum + num(i.packs), 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-center shadow-sm">
                                        <span className="text-[10px] font-black uppercase text-slate-400 block">Total Kgs</span>
                                        <span className="text-sm font-black text-emerald-600">
                                            {importInvoices.reduce((sum, i) => sum + num(i.total_kgs), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-center shadow-sm">
                                        <span className="text-[10px] font-black uppercase text-slate-400 block">Total Value</span>
                                        <span className="text-sm font-black text-purple-600">
                                            ₹{importInvoices.reduce((sum, i) => sum + num(i.final_value), 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Table Preview */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm flex-1">
                                <div className="max-h-96 overflow-y-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold sticky top-0 z-10">
                                            <tr>
                                                <th className="p-3">#</th>
                                                <th className="p-3">Inv No</th>
                                                <th className="p-3">Date</th>
                                                <th className="p-3">Party Name</th>
                                                <th className="p-3">Count / Product</th>
                                                <th className="p-3 text-center">Bags</th>
                                                <th className="p-3 text-right">Kgs</th>
                                                <th className="p-3 text-right">Assessable (₹)</th>
                                                <th className="p-3 text-right">Charity (₹)</th>
                                                <th className="p-3 text-right">GST (₹)</th>
                                                <th className="p-3 text-right">Final Value (₹)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                            {importInvoices.map((inv, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="p-2.5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                                                    <td className="p-2.5 font-bold font-mono text-blue-600">{inv.excelInvNo}</td>
                                                    <td className="p-2.5 text-slate-600">{inv.date}</td>
                                                    <td className="p-2.5 font-bold uppercase">{inv.partyName}</td>
                                                    <td className="p-2.5 font-semibold text-slate-600">{inv.count || inv.product_name}</td>
                                                    <td className="p-2.5 text-center font-bold">{inv.packs}</td>
                                                    <td className="p-2.5 text-right font-mono">{num(inv.total_kgs).toFixed(2)}</td>
                                                    <td className="p-2.5 text-right font-mono">₹{num(inv.assessable_value).toLocaleString()}</td>
                                                    <td className="p-2.5 text-right font-mono">₹{num(inv.charity_amt).toLocaleString()}</td>
                                                    <td className="p-2.5 text-right font-mono">₹{num(inv.gst_amt).toLocaleString()}</td>
                                                    <td className="p-2.5 text-right font-mono font-bold text-slate-900">₹{num(inv.final_value).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-between items-center shrink-0 px-6">
                            <button
                                onClick={() => { setImportModalOpen(false); setImportInvoices([]); }}
                                className="bg-white border border-slate-300 px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmImport}
                                disabled={importLoading || !importDepotId || importInvoices.length === 0}
                                className="bg-emerald-600 text-white px-8 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-emerald-700 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <CheckCircle size={16} />
                                {importLoading ? 'Importing...' : `Confirm & Save (${importInvoices.length} Invoices)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* 🟢 END: EXCEL IMPORT MODAL */}

            {/* PRINT CONTAINER - OFF-SCREEN BUT VISIBLE TO PRINTER */}
            {printData && (
                <div id="printable-invoice-wrapper">
                    <ModernPrintView data={printData} listData={listData} getHSN={getHSN} />
                </div>
            )}

            {/* PRINT STYLES - CLEAN A4 BILL ONLY */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #printable-invoice-wrapper,
                    #printable-invoice-wrapper * {
                        visibility: visible !important;
                    }
                    #printable-invoice-wrapper {
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 8mm;
                    }
                }
            `}</style>
        </div>
    );
}
// --- ERP HELPERS ---
const RowInput = ({ label, width = "w-full", color = "bg-white", ...props }) => (
    <div className="flex items-center"><label className="w-[140px] text-[10px] font-black text-slate-700 uppercase tracking-tighter">{label}</label><input {...props} className={`border border-slate-300 p-1 px-2 text-[11px] font-bold outline-none rounded-sm shadow-sm ${width} ${color}`} /></div>
);
const RowSelect = ({ label, options = [], width = "w-full", value, onChange, disabled, isSearchable = true, ...props }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const containerRef = React.useRef(null);

    const selectedOption = options.find(o => String(o.value) === String(value));

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm("");
        }
    }, [isOpen]);

    const filteredOptions = options.filter(o => 
        String(o.label || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex items-center relative" ref={containerRef}>
            <label className="w-[140px] text-[10px] font-black text-slate-700 uppercase tracking-tighter">{label}</label>
            <div className={`${width} relative`}>
                <div 
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    className={`border border-slate-300 p-1 px-2 text-[11px] font-bold rounded-sm shadow-sm cursor-pointer bg-white min-h-[24px] flex items-center justify-between ${disabled ? "bg-slate-100 cursor-not-allowed opacity-60" : ""}`}
                >
                    <span className="truncate">{selectedOption ? selectedOption.label : "-- Select --"}</span>
                    <span className="text-slate-400 text-[8px] ml-1">▼</span>
                </div>
                
                {isOpen && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-300 rounded shadow-lg z-50 max-h-60 overflow-y-auto">
                        {isSearchable && (
                            <div className="p-1 border-b sticky top-0 bg-white">
                                <input 
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Search..."
                                    className="w-full border-2 border-slate-700 bg-slate-100 p-1 text-[10px] rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-900"
                                    onClick={e => e.stopPropagation()}
                                />
                            </div>
                        )}
                        <div className="max-h-48 overflow-y-auto">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map(o => (
                                    <div 
                                        key={o.value}
                                        onClick={() => {
                                            onChange?.({ target: { value: o.value } });
                                            setIsOpen(false);
                                        }}
                                        className={`p-1.5 px-2 text-[11px] hover:bg-blue-500 hover:text-white cursor-pointer ${String(o.value) === String(value) ? "bg-blue-100 font-black" : ""}`}
                                    >
                                        {o.label}
                                    </div>
                                ))
                            ) : (
                                <div className="p-2 text-slate-400 text-center text-[10px]">No results found</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
const TotalRow = ({ label, value, isEditable = false, onChange, color = "text-slate-900" }) => (
    <div className="flex justify-between items-center text-[10px] py-0.5 px-2 hover:bg-white rounded transition-colors">
        <span className="font-black text-slate-500 uppercase tracking-tighter">{label}</span>
        <input
            readOnly={!isEditable}
            value={Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            onChange={e => onChange?.(e.target.value)}
            className={`w-32 border border-slate-300 text-right p-0.5 font-mono text-[11px] font-black outline-none rounded shadow-inner ${color} ${isEditable ? 'bg-white border-blue-400' : 'bg-slate-50'}`}
        />
    </div>
);
const renderPairCell = (row, idx, perKey, amtKey, isEditable, updateGrid, color = "text-blue-600") => (
    <>
        <td className="p-1 border-r text-slate-400"><input type="number" step="0.01" disabled={!isEditable} className={`w-full p-2 text-center font-black border rounded bg-white outline-none focus:border-blue-500 ${color} disabled:bg-slate-100 disabled:border-transparent`} value={row[perKey] || 0} onChange={(e) => updateGrid(idx, perKey, e.target.value)} /></td>
        <td className={`p-2 border-r text-center font-black bg-slate-50 ${color}`}>{num(row[amtKey]).toFixed(2)}</td>
    </>
);

export default DepotSalesInvoice;
