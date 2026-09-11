import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { mastersAPI, transactionsAPI } from '../service/api';
import { getNextInvoiceSequence, getPrefixForParty } from '../service/utils';
import * as XLSX from 'xlsx';
import {
    Save, FileText, Calculator, RefreshCw, X, Plus,
    Database, MinusCircle, Box, Layers, Activity, Lock,
    ShoppingCart, ChevronDown, Clock, Truck, User,
    Search, Hash, Info, MapPin, Printer, FileJson, FileSpreadsheet,
    ChevronLeft, ChevronRight, Trash2, Square, CheckSquare
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { evaluate } from "mathjs"
import logoImage from '../assets/logo.jpeg';
import { useFilter } from '../context/FilterContext';
import LocalSearchBar from './LocalSearchBar';

// =====================================================
// SAFE NUMBER HELPERS (PREVENT NaN + DECIMAL ISSUES)
// =====================================================
const num = (v) => {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
};

const money = (v) => Number((num(v)).toFixed(2));

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


// =====================================================
// INDIAN RUPEES TO WORDS & FORMATTERS
// =====================================================
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
// EXACT TAX INVOICE PRINT VIEW (MATCHES SPECIFICATION)
// =====================================================
const ModernPrintView = ({ data, listData, getHSN }) => {
    if (!data) return null;

    const party = listData?.parties?.find(p => String(p.id) === String(data.party_id)) || data.Party || {};
    const config = listData?.types?.find(t => String(t.id) === String(data.invoice_type_id)) || {};
    const items = (data.Details || data.InvoiceDetails || []).filter(Boolean);

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
    const totalBags = items.reduce((sum, r) => sum + num(r.packs), 0);
    const totalWeight = items.reduce((sum, r) => sum + num(r.total_kgs), 0);
    const totalAssessable = items.reduce((sum, r) => sum + num(r.assessable_value || (num(r.total_kgs) * num(r.rate))), 0);
    const avgRate = totalWeight > 0 ? (totalAssessable / totalWeight) : 0;

    const productDescs = [...new Set(items.map(r => r.product_description || (listData?.products?.find(p => String(p.id) === String(r.product_id))?.short_description)).filter(Boolean))];
    const hsnCodes = [...new Set(items.map(r => (getHSN ? getHSN(r.product_id) : '') || r.hsn || '').filter(Boolean))];
    const roundedAssessable = Math.round(num(data.total_assessable || totalAssessable));
    const roundedCharity = Math.round(num(data.total_charity));
    const roundedFreight = Math.round(num(data.freight_charges));
    const roundedCgst = totalCgst > 0 ? Math.round(totalCgst) : 0;
    const roundedSgst = totalSgst > 0 ? Math.round(totalSgst) : 0;
    const roundedIgst = totalIgst > 0 ? Math.round(totalIgst) : 0;
    const roundedSubTotal = roundedAssessable + roundedCharity + roundedFreight + roundedCgst + roundedSgst + roundedIgst;
    const roundedTcs = Math.round(num(data.total_tcs || 0));
    const roundedNetAmount = roundedSubTotal - roundedTcs;

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

                {/* 5. Item Rows */}
                <div className="border-b border-black">
                    {items.map((item, idx) => {
                        const rowWeight = num(item.total_kgs);
                        const rowAssessable = Math.round(num(item.assessable_value || (rowWeight * num(item.rate))));
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
                                    <td className="p-1.5 pr-3 text-right font-bold">{fmtIN(roundedAssessable, 2)}</td>
                                </tr>
                                {roundedCharity > 0 && (
                                    <tr className="border-b border-black/20">
                                        <td className="p-1.5 pl-3 font-bold">CHARITY</td>
                                        <td className="p-1.5 pr-3 text-right font-bold">{fmtIN(roundedCharity, 2)}</td>
                                    </tr>
                                )}
                                {roundedFreight > 0 && (
                                    <tr className="border-b border-black/20">
                                        <td className="p-1.5 pl-3 font-bold">FREIGHT</td>
                                        <td className="p-1.5 pr-3 text-right font-bold">{fmtIN(roundedFreight, 2)}</td>
                                    </tr>
                                )}
                                <tr className="border-b border-black/20">
                                    <td className="p-1.5 pl-3 font-medium">C.G.S.T &nbsp;&nbsp; : &nbsp; {cgstPer.toFixed(2)} %</td>
                                    <td className="p-1.5 pr-3 text-right font-medium">{roundedCgst > 0 ? fmtIN(roundedCgst, 2) : ''}</td>
                                </tr>
                                <tr className="border-b border-black/20">
                                    <td className="p-1.5 pl-3 font-medium">S.G.S.T &nbsp;&nbsp; : &nbsp; {sgstPer.toFixed(2)} %</td>
                                    <td className="p-1.5 pr-3 text-right font-medium">{roundedSgst > 0 ? fmtIN(roundedSgst, 2) : ''}</td>
                                </tr>
                                <tr className="border-b border-black/20">
                                    <td className="p-1.5 pl-3 font-medium">I.G.S.T &nbsp;&nbsp; : &nbsp; {igstPer.toFixed(2)} %</td>
                                    <td className="p-1.5 pr-3 text-right font-medium">{roundedIgst > 0 ? fmtIN(roundedIgst, 2) : ''}</td>
                                </tr>
                                <tr className="border-t border-b border-black font-bold">
                                    <td className="p-1.5 pl-3"></td>
                                    <td className="p-1.5 pr-3 text-right">{fmtIN(roundedSubTotal, 2)}</td>
                                </tr>
                                <tr className="border-b border-black">
                                    <td className="p-1.5 pl-3 font-medium">TCS &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; : &nbsp; {tcsPer.toFixed(3)} %</td>
                                    <td className="p-1.5 pr-3 text-right font-medium">{fmtIN(roundedTcs, 2)}</td>
                                </tr>
                                <tr className="font-black text-xs">
                                    <td className="p-2 pl-3">Net Amount</td>
                                    <td className="p-2 pr-3 text-right">{fmtIN(roundedNetAmount, 2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 7. Rupees in Words Full Bar */}
                <div className="border-b border-black p-2 text-[11px] font-bold">
                    <span className="mr-3">Rupees :</span>
                    <span className="uppercase tracking-wide">{numberToWords(roundedNetAmount)}</span>
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
    const { searchQuery: searchValue, searchField, fromDate, toDate, resetFilters, sortField, setSortField, sortOrder, setSortOrder } = useFilter();
    const [searchCondition, setSearchCondition] = useState('Like');
    const handleSort = (field) => {
        if (sortField === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };
    const [printData, setPrintData] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [importLoading, setImportLoading] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importInvoices, setImportInvoices] = useState([]);
    const [importDespatches, setImportDespatches] = useState([]);
    const [importStep, setImportStep] = useState(1);
    const [importGlobalTransportId, setImportGlobalTransportId] = useState('');
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

        if (fromDate) {
            result = result.filter(item => item.date >= fromDate);
        }
        if (toDate) {
            result = result.filter(item => item.date <= toDate);
        }

        const term = searchValue.toLowerCase().trim();
        const filtered = result.filter(item => {
            let fieldValue = '';
            if (searchField === 'invoice_no') fieldValue = String(item.invoice_no || '');
            if (searchField === 'date') fieldValue = String(item.date || '');
            if (searchField === 'party') fieldValue = String(item.Party?.account_name || '');
            if (searchField === 'status') fieldValue = item.is_approved ? 'APPROVED' : 'PENDING';
            const value = fieldValue.toLowerCase();
            return searchCondition === 'Equal' ? value === term : value.includes(term);
        });

        filtered.sort((a, b) => {
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

        return filtered;
    }, [listData.history, searchValue, searchField, searchCondition, fromDate, toDate, sortField, sortOrder]);

    const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage) || 1;
    const currentItems = filteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchField, searchCondition, searchValue]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    // =====================================================
    // EXPORT PDF - COMPACT TAX INVOICE FORMAT
    // =====================================================
    const getHSN = (productId) => {
        const prod = listData.products.find(p => String(p.id) === String(productId));
        return prod?.printing_tariff_desc || '';
    };
    const getProductShortDesc = (productId) => {
        const prod = listData.products.find(p => String(p.id) === String(productId));
        return prod?.short_description || '';
    };
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

        const totalBags = items.reduce((sum, r) => sum + num(r.packs), 0);
        const totalWeight = items.reduce((sum, r) => sum + num(r.total_kgs), 0);
        const totalAssessable = items.reduce((sum, r) => sum + num(r.assessable_value || (num(r.total_kgs) * num(r.rate))), 0);
        const avgRate = totalWeight > 0 ? (totalAssessable / totalWeight) : 0;

        const productDescs = [...new Set(items.map(r => r.product_description || getProductShortDesc(r.product_id)).filter(Boolean))];
        const hsnCodes = [...new Set(items.map(r => getHSN(r.product_id)).filter(Boolean))];
        const netAmount = num(data.net_amount || data.sub_total || totalAssessable);

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
            const rowAssessable = Math.round(num(item.assessable_value || (rowWeight * num(item.rate))));
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

        const roundedAssessable = Math.round(num(data.total_assessable || totalAssessable));
        const roundedCharity = Math.round(num(data.total_charity));
        const roundedFreight = Math.round(num(data.freight_charges));
        const roundedCgst = totalCgst > 0 ? Math.round(totalCgst) : 0;
        const roundedSgst = totalSgst > 0 ? Math.round(totalSgst) : 0;
        const roundedIgst = totalIgst > 0 ? Math.round(totalIgst) : 0;
        const roundedSubTotal = roundedAssessable + roundedCharity + roundedFreight + roundedCgst + roundedSgst + roundedIgst;
        const roundedTcs = Math.round(num(data.total_tcs || 0));
        const roundedNetAmount = roundedSubTotal - roundedTcs;

        renderTaxRow("TOTAL ASSESSABLE", roundedAssessable, true);
        if (roundedCharity > 0) {
            renderTaxRow("CHARITY", roundedCharity, true);
        }
        if (roundedFreight > 0) {
            renderTaxRow("FREIGHT", roundedFreight, true);
        }
        renderTaxRow(`C.G.S.T   :   ${cgstPer.toFixed(2)} %`, roundedCgst > 0 ? roundedCgst : '');
        renderTaxRow(`S.G.S.T   :   ${sgstPer.toFixed(2)} %`, roundedSgst > 0 ? roundedSgst : '');
        renderTaxRow(`I.G.S.T   :   ${igstPer.toFixed(2)} %`, roundedIgst > 0 ? roundedIgst : '');

        // Subtotal divider line with clean spacing
        taxY += 1;
        doc.line(midX, taxY - 1.5, right, taxY - 1.5);
        taxY += 2;
        renderTaxRow("", roundedSubTotal, true);

        renderTaxRow(`TCS         :   ${tcsPer.toFixed(3)} %`, roundedTcs);

        // Net Amount divider line with generous clearance
        taxY += 1;
        doc.line(midX, taxY - 1.5, right, taxY - 1.5);
        taxY += 3.8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text("Net Amount", rightLabelX, taxY);
        doc.text(fmt(roundedNetAmount, 2), rightValX, taxY, { align: "right" });

        // 6. Rupees in Words Box
        y += splitH;
        const wordsH = 8;
        doc.rect(margin, y, contentWidth, wordsH);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text("Rupees :", margin + 3, y + 5.5);
        doc.text(numberToWords(roundedNetAmount), margin + 18, y + 5.5);

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

    const exportToExcel = () => {
        if (!formData) return;
        const party = listData.parties.find(p => String(p.id) === String(formData.party_id)) || formData.Party || {};
        const transport = listData.transports.find(t => String(t.id) === String(formData.transport_id)) || formData.Transport || {};

        const wsData = [
            ["KAYAAR EXPORTS PRIVATE LIMITED"],
            ["TAX INVOICE"],
            ["D.No: 43/5, Railway Feeder Road, K.R. Nagar - 628 503, Kovilpatti - Taluk, Tuticorin Dist., Tamilnadu, India"],
            ["Phone: (04632) - 248258, 9443238761 | Email: ttnkrgroup@gmail.com | GSTIN: 33AAACK4468M1ZA"],
            [],
            ["Invoice No", formData.invoice_no || 'DRAFT', "", "Invoice Date", formData.date || ''],
            ["E-Way Bill No", formData.ebill_no || '', "", "Vehicle No", formData.vehicle_no || ''],
            ["Party Name", party.account_name || '', "", "Party GSTIN", party.gst_no || ''],
            ["Delivery At", formData.delivery || '', "", "Transport", transport.account_name || ''],
            [],
            ["S.No", "Description of Goods", "HSN Code", "Bags/Packs", "Total Kgs", "From-To", "Rate/Kg", "Assessable Value"],
            ...(gridRows.map((row, idx) => {
                const rowWeight = num(row.total_kgs);
                const rowAssessable = Math.round(num(row.assessable_value || (rowWeight * num(row.rate))));
                const assessableRatePerKg = rowWeight > 0 ? (rowAssessable / rowWeight) : num(row.rate);
                return [
                    idx + 1,
                    row.product_description || (listData.products.find(p => String(p.id) === String(row.product_id))?.product_name || ''),
                    getHSN(row.product_id),
                    num(row.packs),
                    rowWeight,
                    `${row.from_no || ''} - ${row.to_no || ''}`,
                    Number(assessableRatePerKg.toFixed(2)),
                    rowAssessable
                ];
            })),
            [],
            ["", "", "", "", "", "Assessable Value", "", Math.round(num(formData.total_assessable))],
            ["", "", "", "", "", "Charity", "", Math.round(num(formData.total_charity))],
            ["", "", "", "", "", "Freight Charges", "", Math.round(num(formData.freight_charges))],
            ["", "", "", "", "", "Total GST", "", Math.round(num(formData.total_gst) + num(formData.total_sgst) + num(formData.total_cgst) + num(formData.total_igst))],
            ["", "", "", "", "", "Round Off", "", 0],
            ["", "", "", "", "", "Grand Total", "", Math.round(num(formData.net_amount))],
            [],
            ["Amount Chargeable (in words):", numberToWords(Math.round(num(formData.net_amount)))]
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Invoice");
        XLSX.writeFile(wb, `Kayaar_Exports_Invoice_${formData.invoice_no || 'Draft'}.xlsx`);
    };

    const exportFilteredInvoicesToExcel = () => {
        if (!filteredInvoices.length) return;
        const wsData = [
            ["KAYAAR EXPORTS PRIVATE LIMITED"],
            ["INVOICE REGISTER / LIST"],
            ["GSTIN: 33AAACK4468M1ZA | Kovilpatti, Tamil Nadu"],
            [],
            ["Inv No", "Date", "Party Name", "Sales Type", "Vehicle No", "Assessable Val", "GST Total", "Grand Total", "Status"],
            ...filteredInvoices.map(inv => [
                inv.invoice_no || '',
                inv.date || '',
                inv.Party?.account_name || '',
                inv.sales_type || '',
                inv.vehicle_no || '',
                num(inv.total_assessable),
                num(inv.total_gst) + num(inv.total_sgst) + num(inv.total_cgst) + num(inv.total_igst),
                num(inv.net_amount),
                inv.is_approved ? 'Approved' : 'Pending'
            ])
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Invoices");
        XLSX.writeFile(wb, `Kayaar_Exports_Invoices_${new Date().toISOString().split('T')[0]}.xlsx`);
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

        const isForward = String(config.round_off_direction || config.calculation_type || '').trim().toLowerCase() === 'forward';

        // 1. FLOW: Get Tax and TCS Percentages
        const gstPer = num(config.gst_percentage);
        let sgstPer = num(config.sgst_percentage);
        let cgstPer = num(config.cgst_percentage);
        const igstPer = num(config.igst_percentage);
        const cenvatPer = num(config.cenvat_percentage);
        const dutyPer = num(config.duty_percentage);
        const cessPer = num(config.cess_percentage);
        const hcessPer = num(config.hr_sec_cess_percentage);
        const tcsPer = num(config.tcs_percentage || 0);

        if (igstPer === 0 && cgstPer === 0 && sgstPer === 0 && gstPer > 0) {
            cgstPer = gstPer / 2;
            sgstPer = gstPer / 2;
        }

        // Total tax percentage (Sum of SGST+CGST or just IGST)
        const splitGstPer = sgstPer + cgstPer;
        const taxPercentage = igstPer > 0 ? igstPer : (splitGstPer > 0 ? splitGstPer : gstPer);
        const displayGstPer = splitGstPer > 0 ? splitGstPer : gstPer;

        const totalBags = rows.reduce((sum, r) => sum + num(r.packs), 0);
        const load = formData.load_id ? listData.loads.find(l => l.id === parseInt(formData.load_id)) : null;
        let freightPerBag = 0;
        if (num(hFreight) > 0) {
            freightPerBag = totalBags > 0 ? num(hFreight) / totalBags : 0;
        } else if (load) {
            freightPerBag = num(load.freight_per_bag) > 0
                ? num(load.freight_per_bag)
                : (num(load.no_of_bags) > 0 ? num(load.freight) / num(load.no_of_bags) : 0);
        } else {
            freightPerBag = totalBags > 0 ? num(hFreight) / totalBags : 0;
        }

        console.log(`%c >>> CALCULATION START [Mode: ${isForward ? 'FORWARD' : 'REVERSE'}, Tax: ${taxPercentage}%, TCS: ${tcsPer}%] <<< `, "background: #000; color: #fff;");

        let hTotals = {
            assess: 0, charity: 0, freight: 0, gst: 0, tcs: 0, gross: 0,
            cenvat: 0, duty: 0, cess: 0, hcess: 0, other: 0,
            cgst: 0, sgst: 0, igst: 0, vat: 0
        };

        const updatedRows = rows.map((item, idx) => {
            const packs = num(item.packs);
            const bagWt = num(item.avg_content);
            const existingTotalKgs = num(item.total_kgs);
            const rateInput = num(item.rate);
            const rowFreight = packs * freightPerBag;
            const productName = String(item.product_description || item.Product?.product_name || '').toLowerCase();
            const is68Product = productName.includes('68');

            // Keep the existing total_kgs if it is already provided to prevent rounding off; otherwise use packs x bag weight.
            const totalKgs = existingTotalKgs > 0 ? existingTotalKgs : (packs * bagWt);

            const vatPer = num(item.vat_per || config.vat_percentage);
            const cenvatRowPer = num(item.cenvat_per || cenvatPer);
            const dutyRowPer = num(item.duty_per || dutyPer);
            const cessRowPer = num(item.cess_per || cessPer);
            const hcessRowPer = num(item.hcess_per || hcessPer);

            const charityPerBale = (salesType === 'GST SALES' || salesType === "DEPOT SALES")
                ? 3
                : num(item.charity_per_bale || config.charity_value || 0);

            let charity = 0;
            let assessableValue = 0;
            let gstAmount = 0;
            let igstAmount = 0;
            let sgstAmount = 0;
            let cgstAmount = 0;
            let vatAmount = 0;
            let cenvatAmount = 0;
            let dutyAmount = 0;
            let cessAmount = 0;
            let hcessAmount = 0;
            let otherAmount = 0;
            let totalInvoiceAmount = 0;
            let tcsAmount = 0;

            if (isForward) {
                // 🟢 FORWARD CALCULATION FLOW:
                // 1. Assessable Value = Rate * Total Net Weight (or 10 * packs * rate for 68 product)
                assessableValue = Math.round(is68Product
                    ? (10 * packs * rateInput)
                    : (totalKgs * rateInput));

                // 2. Charity
                if (salesType === 'GST SALES' || salesType === "DEPOT SALES" || config.charity_checked) {
                    charity = Math.round(totalKgs * charityPerBale);
                } else {
                    charity = 0;
                }

                const roundedRowFreight = Math.round(rowFreight);

                // 3. Taxes calculated on Assessable Value and rounded
                gstAmount = Math.round((assessableValue * taxPercentage) / 100);
                igstAmount = igstPer > 0 ? Math.round(assessableValue * igstPer / 100) : 0;
                sgstAmount = igstPer > 0 ? 0 : (sgstPer > 0 ? Math.round(assessableValue * sgstPer / 100) : Math.round(gstAmount / 2));
                cgstAmount = igstPer > 0 ? 0 : (cgstPer > 0 ? Math.round(assessableValue * cgstPer / 100) : Math.round(gstAmount / 2));

                vatAmount = Math.round((assessableValue * vatPer) / 100);
                cenvatAmount = Math.round((assessableValue * cenvatRowPer) / 100);
                dutyAmount = Math.round((assessableValue * dutyRowPer) / 100);
                cessAmount = Math.round((assessableValue * cessRowPer) / 100);
                hcessAmount = Math.round((assessableValue * hcessRowPer) / 100);
                otherAmount = Math.round(num(item.other_per) > 0
                    ? (assessableValue * num(item.other_per)) / 100
                    : num(item.other_amt));

                const totalTax = (igstPer > 0 ? igstAmount : (sgstAmount + cgstAmount)) + vatAmount + cenvatAmount + dutyAmount + cessAmount + hcessAmount + otherAmount;

                // 4. Total Invoice Value = Assessable Value + Tax Amounts + Freight + Charity
                totalInvoiceAmount = assessableValue + totalTax + roundedRowFreight + charity;
                tcsAmount = Math.round((totalInvoiceAmount * tcsPer) / 100);
            } else {
                // 🔵 REVERSE CALCULATION FLOW (Current Back-calculating Flow):
                const rawTotalInvoiceAmount = is68Product
                    ? (10 * packs * rateInput)
                    : (totalKgs * rateInput);
                totalInvoiceAmount = Math.round(rawTotalInvoiceAmount);

                if (salesType === 'GST SALES' || salesType === "DEPOT SALES") {
                    charity = Math.round(totalKgs * charityPerBale);
                } else {
                    charity = 0;
                }

                const roundedRowFreight = Math.round(rowFreight);
                const taxDivisor = 1 + (taxPercentage / 100);
                const baseAmount = taxDivisor > 0 ? ((totalInvoiceAmount - roundedRowFreight - charity) / taxDivisor) : (totalInvoiceAmount - roundedRowFreight - charity);

                const rawGstAmount = (baseAmount * taxPercentage) / 100;
                gstAmount = Math.round(rawGstAmount);
                tcsAmount = Math.round((totalInvoiceAmount * tcsPer) / 100);

                assessableValue = totalInvoiceAmount - roundedRowFreight - charity - gstAmount;

                vatAmount = Math.round((assessableValue * vatPer) / 100);
                cenvatAmount = Math.round((assessableValue * cenvatRowPer) / 100);
                dutyAmount = Math.round((assessableValue * dutyRowPer) / 100);
                cessAmount = Math.round((assessableValue * cessRowPer) / 100);
                hcessAmount = Math.round((assessableValue * hcessRowPer) / 100);
                otherAmount = Math.round(num(item.other_per) > 0
                    ? (assessableValue * num(item.other_per)) / 100
                    : num(item.other_amt));

                igstAmount = igstPer > 0 ? gstAmount : 0;
                sgstAmount = igstPer > 0 ? 0 : (sgstPer > 0 ? Math.round(gstAmount * sgstPer / taxPercentage) : Math.round(gstAmount / 2));
                cgstAmount = igstPer > 0 ? 0 : (cgstPer > 0 ? Math.round(gstAmount * cgstPer / taxPercentage) : Math.round(gstAmount / 2));
            }

            const rowFreightRounded = Math.round(rowFreight);
            hTotals.assess += assessableValue;
            hTotals.charity += charity;
            hTotals.freight += rowFreightRounded;
            hTotals.gst += (igstPer > 0 ? 0 : (sgstAmount + cgstAmount));
            hTotals.cgst += cgstAmount;
            hTotals.sgst += sgstAmount;
            hTotals.igst += igstAmount;
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
                total_kgs: totalKgs,
                charity_per_bale: charityPerBale,
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
                charity_amt: charity,
                freight_amt: rowFreightRounded,
                // Handle SGST/CGST split or IGST
                igst_amt: igstAmount,
                sgst_amt: sgstAmount,
                cgst_amt: cgstAmount,
                gst_amt: igstPer > 0 ? 0 : (sgstAmount + cgstAmount),
                vat_amt: vatAmount,
                cenvat_amt: cenvatAmount,
                duty_amt: dutyAmount,
                cess_amt: cessAmount,
                hr_sec_cess_amt: hcessAmount,
                tcs_amt: tcsAmount,
                other_amt: otherAmount,
                assessable_value: assessableValue,
                rounded_off: num(item.rounded_off || 0),
                final_value: totalInvoiceAmount
            };
        });

        // 9. GRAND TOTAL (Net Amount): Gross Invoice Amount MINUS TCS
        const totalTaxSum = (igstPer > 0 ? hTotals.igst : (hTotals.cgst + hTotals.sgst)) + hTotals.vat + hTotals.cenvat + hTotals.duty + hTotals.cess + hTotals.hcess + hTotals.other;
        const finalGross = hTotals.assess + hTotals.charity + hTotals.freight + totalTaxSum;
        const finalNetAmount = finalGross - hTotals.tcs;

        setFormData(prev => ({
            ...prev,
            total_assessable: hTotals.assess,
            total_charity: hTotals.charity,
            freight_charges: load ? hTotals.freight : Math.round(num(hFreight)),
            // Display full GST amount as the combined CGST + SGST value.
            total_gst: igstPer > 0 ? 0 : (hTotals.cgst + hTotals.sgst),
            total_igst: igstPer > 0 ? hTotals.igst : 0,
            total_sgst: hTotals.sgst,
            total_cgst: hTotals.cgst,
            total_vat: hTotals.vat || 0,
            total_cenvat: hTotals.cenvat,
            total_duty: hTotals.duty,
            total_cess: hTotals.cess,
            total_hr_sec_cess: hTotals.hcess,
            total_tcs: hTotals.tcs,
            total_other: hTotals.other,
            sub_total: finalGross,
            round_off: '0.00',
            net_amount: finalNetAmount
        }));

        return updatedRows;
    }, [listData.types, listData.loads, formData.freight_charges, formData.sales_type, formData.load_id]);

    useEffect(() => {
        if (gridRows.length === 0) return;
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

            const seq = getNextInvoiceSequence(historyData, '');
            setFormData(prev => ({ ...prev, invoice_no: seq.toString() }));
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    useEffect(() => { 
        init(); 
        resetFilters([
            { value: 'invoice_no', label: 'Invoice No' },
            { value: 'date', label: 'Invoice Date' },
            { value: 'party', label: 'Party Name' },
            { value: 'status', label: 'Status' }
        ], 'invoice_no', true);
    }, []);

    // ==========================================
    // 4. HANDLERS
    // ==========================================

    // FIX: Restoring missing handleLoadSync to stop the ReferenceError
    const handleAccountSync = (accId) => {
        const partyId = parseInt(accId);
        const acc = listData.parties.find(a => a.id === partyId);
        if (!acc) return;

        setFormData(prev => {
            let updatedInvNo = prev.invoice_no;
            const prefix = getPrefixForParty(acc.account_name);
            const historyExcludingCurrent = prev.id 
                ? listData.history.filter(item => item.id !== prev.id)
                : listData.history;
            const seq = getNextInvoiceSequence(historyExcludingCurrent, prefix, acc.account_name);
            updatedInvNo = prefix ? `${prefix}${seq}` : seq.toString();
            return {
                ...prev,
                party_id: partyId,
                addr1: acc.addr1 || '',
                addr2: acc.addr2 || '',
                addr3: acc.addr3 || '',
                invoice_no: updatedInvNo
            };
        });
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

        if (field === 'avg_content') {
            row.total_kgs = num(row.packs) * num(val);
            console.log(`%c AVG CONTENT CHANGED: ${row.product_description}`, "color: #f59e0b;");
            console.log(`New Kgs: ${row.packs} packs x ${val}kg = ${row.total_kgs}`);
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
        const { order = {}, source = '', config = {}, load = null, isEditHydration = false } = options;
        const product = findProductForRow(row);
        const broker = listData.brokers.find(b => String(b.id) === String(order.broker_id));
        const orderNo = firstValue(row.order_no, order.order_no);
        const orderType = firstValue(row.order_type, source === 'WITH' ? 'WITH_ORDER' : source === 'WITHOUT' ? 'WITHOUT_ORDER' : '');
        const packs = isEditHydration
            ? (num(firstValue(row.packs, row.qty, row.quantity)) || 0)
            : (num(load?.no_of_bags) > 0 ? num(load.no_of_bags) : (num(firstValue(row.packs, row.qty, row.quantity)) || 0));
        const avgContent = num(firstValue(row.avg_content, row.bag_wt, product?.pack_nett_wt));
        const totalKgs = num(firstValue(row.total_kgs, row.kgs, row.net_weight)) || (packs * avgContent);

        const {
            id: sourceDetailId,
            invoice_id: sourceInvoiceId,
            direct_invoice_id: sourceDirectInvoiceId,
            createdAt: sourceCreatedAt,
            updatedAt: sourceUpdatedAt,
            Product: sourceProduct,
            product: sourceProductLower,
            Header: sourceHeader,
            ...editableRow
        } = row;

        return {
            ...editableRow,
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
            charity_per_bale: num(firstValue(row.charity_per_bale, formData.sales_type === 'GST SALES' || formData.sales_type === "DEPOT SALES" ? 3 : config.charity_value)),
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
        ).map(row => normalizeInvoiceRow(row, { config: invoiceType, load, isEditHydration: true }));

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
            alert(e.response?.data?.error || "Error saving invoice");

        } finally {

            setSubmitLoading(false);

        }
    };

    const handleDelete = async () => {
        if (!formData.id) return;
        if (!window.confirm("Are you sure you want to permanently delete this invoice? This action will restore product stocks and despatch counts, and cannot be undone.")) {
            return;
        }

        setSubmitLoading(true);
        try {
            await transactionsAPI.invoices.delete(formData.id);
            setIsModalOpen(false);
            await init();
            setGridRows([]);
        } catch (e) {
            console.error("Delete error:", e);
            alert(e.response?.data?.error || "Error deleting invoice");
        } finally {
            setSubmitLoading(false);
        }
    };

    const loadInvoice = async (id) => {
        try {
            const res = await transactionsAPI.invoices.getById(id);
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
            setActiveTab('head');
            setIsModalOpen(true);
        } catch (err) {
            console.error("Error loading invoice:", err);
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
        if (!window.confirm(`Are you sure you want to permanently delete the ${selectedIds.length} selected invoices? This action will restore product stocks and despatch counts, and cannot be undone.`)) {
            return;
        }

        setSubmitLoading(true);
        try {
            await transactionsAPI.invoices.bulkDelete(selectedIds);
            setSelectedIds([]);
            setIsSelectionMode(false);
            await init();
        } catch (e) {
            console.error("Bulk delete error:", e);
            alert(e.response?.data?.error || "Error performing bulk delete");
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleBulkImportApril = () => {
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

                    const dataRows = [];
                    for (let i = 2; i < rawRows.length; i++) {
                        const row = rawRows[i];
                        if (!row || row.length === 0) continue;
                        
                        const invNo = row[0];
                        const partyName = row[1];
                        const prodName = row[2];
                        const dateVal = row[13];

                        if (invNo === undefined || invNo === null || String(invNo).trim() === '') continue;
                        if (!partyName || String(partyName).trim() === '') continue;
                        if (!prodName || String(prodName).trim() === '') continue;
                        if (!dateVal) continue;
                        
                        const cleanInvNo = String(invNo).trim().toLowerCase();
                        const cleanPartyName = String(partyName || '').trim().toLowerCase();
                        
                        // Skip header rows
                        if (cleanInvNo === 'invoice no' || cleanInvNo === 'invoiceno' || cleanPartyName === 'party name') {
                            continue;
                        }
                        
                        if (cleanInvNo.includes('total') || cleanPartyName === 'total' || cleanPartyName === 'grand total' || cleanPartyName === 'sub total' || cleanPartyName === '607200') {
                            continue;
                        }
                        dataRows.push(row);
                    }

                    const invoicesMap = new Map();
                    const parsedInvoices = [];

                    for (const row of dataRows) {
                        const excelInvNo = String(row[0]).trim();
                        let dateVal = row[13];
                        let formattedDate = null;

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
                            continue;
                        }

                        const partyName = String(row[1]).trim();

                        const packs = num(row[3]);
                        const totalKgs = num(row[4]);
                        const value = num(row[8]);
                        const freight = num(row[7]);

                        const prodNameForRate = String(row[2]).trim().toLowerCase();
                        const is68Product = prodNameForRate.includes('68');

                        const rate = is68Product
                            ? (packs > 0 ? (value / (10 * packs)) : 0)
                            : (totalKgs > 0 ? (value / totalKgs) : 0);

                        parsedInvoices.push({
                            excelInvNo,
                            date: formattedDate,
                            partyName,
                            address: [row[14], row[15], row[16]]
                                .filter(Boolean)
                                .map(s => String(s).trim())
                                .join(', '),
                            place: String(row[17] || '').trim(),
                            cst_gst: [row[18], row[19]]
                                .filter(Boolean)
                                .map(s => String(s).trim())
                                .join(', '),

                            rows: [{
                                product_name: String(row[2]).trim(),
                                packs,
                                total_kgs: totalKgs,
                                freight,
                                rate,
                                value,
                                avg_content: totalKgs > 0 && packs > 0
                                    ? (totalKgs / packs)
                                    : 0
                            }]
                        });
                    }
                    
                    const despatchMap = new Map();
                    for (const inv of parsedInvoices) {
                        for (const row of inv.rows) {
                            const key = `${inv.date}_${row.product_name}`;
                            if (!despatchMap.has(key)) {
                                despatchMap.set(key, {
                                    key,
                                    date: inv.date,
                                    product_name: row.product_name,
                                    no_of_bags: 0,
                                    freight: 0,
                                    transport_id: '',
                                    vehicle_no: 'TN 34 X 9117',
                                    lr_date: inv.date
                                });
                            }
                            const group = despatchMap.get(key);
                            group.no_of_bags += row.packs;
                            group.freight += row.freight;
                        }
                    }
                    const parsedDespatches = Array.from(despatchMap.values());

                    setImportInvoices(parsedInvoices);
                    setImportDespatches(parsedDespatches);
                    setImportGlobalTransportId('');
                    setImportStep(1);
                    setImportModalOpen(true);

                } catch (err) {
                    console.error("Excel parse error:", err);
                    alert("Failed to parse Excel file.");
                } finally {
                    setImportLoading(false);
                }
            };
            reader.onerror = () => {
                alert("Failed to read file.");
                setImportLoading(false);
            };
            reader.readAsArrayBuffer(file);
        };
        input.click();
    };

    const handleConfirmImport = async () => {
        // Validation: Verify a Transport carrier is selected for the entire dataset
        const finalDespatches = importDespatches.map(d => ({
            ...d,
            transport_id: d.transport_id || importGlobalTransportId
        }));
        const missingTransport = finalDespatches.some(d => !d.transport_id);
        if (missingTransport) {
            alert("Please select a Transport Carrier for the entire import before confirming.");
            return;
        }

        setImportLoading(true);
        try {
            const payload = {
                despatches: finalDespatches,
                invoices: importInvoices
            };
            const res = await transactionsAPI.invoices.bulkImportSave(payload);
            alert(res.data.message || "Bulk Import Completed Successfully!");
            setImportModalOpen(false);
            await init();
        } catch (err) {
            console.error("Import save error:", err);
            alert(err.response?.data?.error || "Import failed during saving.");
        } finally {
            setImportLoading(false);
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
                <div className="flex items-center gap-2">
                    {!isSelectionMode ? (
                        <button
                            onClick={() => setIsSelectionMode(true)}
                            className="bg-white border border-slate-300 text-slate-700 px-6 py-2 rounded-xl font-bold hover:bg-slate-50 transition-all uppercase text-xs flex items-center gap-2"
                        >
                            Select Multiple
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }}
                                className="bg-white border border-slate-300 text-slate-700 px-6 py-2 rounded-xl font-bold hover:bg-slate-50 transition-all uppercase text-xs flex items-center gap-2"
                            >
                                Clear Selection
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                disabled={selectedIds.length === 0}
                                className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-red-700 transition-all uppercase text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Trash2 size={16} /> Delete Selected ({selectedIds.length})
                            </button>
                        </div>
                    )}
                    <button
                        onClick={handleBulkImportApril}
                        disabled={importLoading}
                        className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg hover:bg-emerald-700 transition-all uppercase text-xs flex items-center gap-2 disabled:opacity-65"
                    >
                        <RefreshCw size={16} className={importLoading ? 'animate-spin' : ''} />
                        {importLoading ? 'IMPORTING...' : 'IMPORT EXCEL'}
                    </button>
                    <button
                        onClick={exportFilteredInvoicesToExcel}
                        disabled={filteredInvoices.length === 0}
                        className="bg-teal-700 text-white px-6 py-2 rounded-xl font-bold shadow-lg hover:bg-teal-800 transition-all uppercase text-xs flex items-center gap-2 disabled:opacity-50"
                    >
                        <FileSpreadsheet size={16} />
                        EXPORT EXCEL
                    </button>
                    <button onClick={() => { setFormData({ ...emptyInvoice, invoice_no: getNextInvoiceSequence(listData.history, '').toString() }); setGridRows([]); setActiveTab('head'); setIsModalOpen(true); }} className="bg-blue-600 text-white px-8 py-2 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all uppercase text-xs flex items-center gap-2"><Plus size={18} /> New Invoice</button>
                </div>
            </div>
            
            <LocalSearchBar searchCondition={searchCondition} setSearchCondition={setSearchCondition} />

            {/* Search Bar - Handled in Sidebar */}
            <div className="bg-white p-3 rounded-xl border border-slate-300 shadow-sm mb-4 flex justify-end items-center">
                <div className="bg-blue-50 text-blue-700 border border-blue-200 px-4 py-1.5 rounded text-xs font-bold">
                    {filteredInvoices.length} Matches
                </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-blue-700 text-white text-[10px] uppercase font-black tracking-widest">
                        <tr>
                            {isSelectionMode && <th className="p-6 w-12 text-center">Select</th>}
                            <th className="p-6 cursor-pointer select-none" onClick={() => handleSort('invoice_no')}>
                                InvoiceNo {sortField === 'invoice_no' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                            </th>
                            <th className="p-6 cursor-pointer select-none" onClick={() => handleSort('date')}>
                                Date {sortField === 'date' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                            </th>
                            <th className="p-6 cursor-pointer select-none" onClick={() => handleSort('party')}>
                                Party {sortField === 'party' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                            </th>
                            <th className="p-6 select-none">
                                Yarn / Description
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-sm font-mono">
                        {currentItems.map(item => (
                            <tr
                                key={item.id}
                                className={`hover:bg-blue-50 cursor-pointer ${selectedIds.includes(item.id) ? 'bg-blue-100/50' : ''}`}
                                onClick={() => handleRowClick(item)}
                            >
                                {isSelectionMode && (
                                    <td className="p-6 text-center" onClick={(e) => e.stopPropagation()}>
                                        {selectedIds.includes(item.id) ? (
                                            <CheckSquare size={18} className="text-blue-600 mx-auto" />
                                        ) : (
                                            <Square size={18} className="text-slate-300 mx-auto" />
                                        )}
                                    </td>
                                )}
                                <td className="p-6 font-bold text-blue-600">
                                    {item.invoice_no}
                                </td>

                                <td className="p-6">{item.date}</td>

                                <td className="p-6 font-bold uppercase">
                                    {item.Party?.account_name}
                                </td>

                                <td className="p-6 text-slate-600">
                                    {item.InvoiceDetails?.[0]?.product_description || '-'}
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
                    <div className="bg-[#D9E5F7] rounded-lg shadow-2xl w-full max-w-[1250px] flex flex-col overflow-hidden border border-slate-400 h-[98vh]">

                        <div className="bg-[#FCD166] p-1.5 border-b border-slate-400 flex justify-between items-center">
                            <span className="text-[13px] font-bold text-slate-700 ml-2 flex items-center gap-2"><Layers size={14} /> Invoice Preparation</span>
                            <button onClick={() => setIsModalOpen(false)} className="bg-red-500 text-white px-2 rounded font-bold">×</button>
                        </div>

                        <div className="flex bg-[#D9E5F7] pt-2 px-4 gap-1">
                            {['head', 'detail'].map(t => (
                                <button key={t} onClick={() => setActiveTab(t)} className={`px-6 py-1 text-[11px] font-bold border border-b-0 rounded-t-md ${activeTab === t ? 'bg-white text-blue-700 border-slate-400' : 'bg-[#EBF2FA] text-slate-500 border-slate-300'}`}>
                                    {t.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 bg-white mx-4 mb-4 border border-slate-400 p-5 overflow-hidden flex flex-col">
                            {activeTab === 'head' ? (
                                <div className="grid grid-cols-12 gap-6 h-full overflow-y-auto">
                                    <div className="col-span-8 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <RowInput label="Invoice No." value={formData.invoice_no} readOnly color="bg-slate-50" />
                                            <RowSelect label="Load No" value={formData.load_id} options={listData.loads.map(l => ({ value: l.id, label: l.load_no }))} onChange={e => handleLoadSync(e.target.value)} width="w-44" />
                                        </div>
                                        <RowInput label="Date" type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                                        <RowSelect
                                            label="Sales Type"
                                            value={formData.sales_type}
                                            options={[
                                                { value: 'GST SALES', label: 'GST SALES' },
                                                // { value: 'DEPOT SALES', label: 'DEPOT SALES' },
                                                { value: 'DIRECT SALES', label: 'DIRECT SALES' },
                                            ]}
                                            onChange={e => setFormData({
                                                ...formData,
                                                sales_type: e.target.value,
                                                invoice_type_id: '' // 🟢 Clear selected ID when type changes
                                            })}
                                        />
                                        <RowSelect
                                            label="Invoice Type"
                                            isSearchable={false}
                                            value={formData.invoice_type_id}
                                            options={filteredInvoiceTypes.map(t => ({
                                                value: t.id,
                                                label: `${t.type_name} [${t.round_off_direction || t.calculation_type || 'Reverse'}]`
                                            }))}
                                            onChange={e => setFormData({
                                                ...formData,
                                                invoice_type_id: e.target.value
                                            })}
                                        />
                                        <RowSelect label="Party name" value={formData.party_id} options={listData.parties.map(p => ({ value: p.id, label: p.account_name }))} onChange={e => handleAccountSync(e.target.value)} />
                                        <div className="flex flex-col gap-1 ml-[140px]">
                                            <input readOnly value={formData.addr1} className="border border-slate-300 p-1 px-2 text-[11px] bg-slate-50 font-bold outline-none" />
                                            <input readOnly value={formData.addr2} className="border border-slate-300 p-1 px-2 text-[11px] bg-slate-50 font-bold outline-none" />
                                            <input readOnly value={formData.addr3} className="border border-slate-300 p-1 px-2 text-[11px] bg-slate-50 font-bold outline-none" />
                                        </div>
                                        <div className="flex items-center gap-8 ml-[140px] py-1">
                                            <div className="flex items-center gap-2"><span className="text-[10px] font-black text-slate-700 uppercase">Credit days</span><input type="number" className="border border-slate-300 w-20 p-1 text-sm text-center font-bold" value={formData.credit_days} onChange={e => setFormData({ ...formData, credit_days: e.target.value })} /></div>
                                            <div className="flex items-center gap-2"><span className="text-[10px] font-black text-slate-700 uppercase">Interest %</span><input type="number" className="border border-slate-300 w-20 p-1 text-sm text-center font-bold" value={formData.interest_percentage} onChange={e => setFormData({ ...formData, interest_percentage: e.target.value })} /></div>
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
                                            <RowSelect label="PayMode" value={formData.pay_mode} options={[{ value: 'CREDIT', label: 'CREDIT' }, { value: 'IMMEDIATE', label: 'IMMEDIATE' }]} onChange={e => setFormData({ ...formData, pay_mode: e.target.value })} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <RowInput label="Prepare Time" type="text" value={formData.prepare_time} onChange={e => setFormData({ ...formData, prepare_time: e.target.value })} />
                                            <RowInput label="Form JJ" value={formData.form_j} onChange={e => setFormData({ ...formData, form_j: e.target.value })} />
                                        </div>
                                        <RowInput label="Sales Against" value={formData.sales_against} onChange={e => setFormData({ ...formData, sales_against: e.target.value })} />
                                        <RowInput label="EPCG No" value={formData.epcg_no} onChange={e => setFormData({ ...formData, epcg_no: e.target.value })} />
                                    </div>
                                    <div className="col-span-4 bg-slate-50 border border-slate-300 p-4 rounded flex flex-col gap-1 shadow-inner font-black overflow-y-auto">
                                        <h3 className="text-[10px] text-blue-800 mb-1 border-b pb-1 uppercase tracking-tighter font-black">Invoice Summary</h3>
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

                                        <div className="mt-auto pt-4 border-t-2 border-slate-400 space-y-1">
                                            <TotalRow label="Sub Total" value={formData.sub_total} />

                                            {/* 🟢 TCS moved here to show it is part of the final deduction process */}
                                            <div className="flex justify-between items-center text-[10px] py-0.5 px-2 bg-red-50 rounded border border-red-200">
                                                <span className="font-black text-red-600 uppercase tracking-tighter">(-) TCS</span>
                                                <input
                                                    readOnly
                                                    value={num(formData.total_tcs).toLocaleString()}
                                                    className="w-32 border border-red-300 text-right p-0.5 font-mono text-[11px] bg-white outline-none font-black text-red-600"
                                                />
                                            </div>

                                            <TotalRow label="Round off" value={formData.round_off} />

                                            <div className="flex justify-between items-center py-2 px-2 bg-white border border-slate-400 rounded shadow-sm mt-1">
                                                <span className="text-[11px] uppercase font-black">Net Amount</span>
                                                <span className="text-xl font-mono text-blue-700 font-black">₹ {num(formData.net_amount).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* TAB 2: DETAIL MATRIX */
                                <div className="space-y-4 h-full flex flex-col overflow-hidden">
                                    <div className="bg-blue-50 p-2 border border-blue-200 flex items-center justify-between rounded shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <span className="text-[10px] font-black uppercase text-blue-700">Sync Mill Order:</span>
                                            <select className="border border-slate-300 text-[11px] p-1 w-72 font-bold rounded" onChange={handleOrderSync}>
                                                <option value="">-- Order No --</option>
                                                {listData.orders.map(o => <option key={o.id} value={`WITH|${o.order_no}`}>{o.order_no}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-[10px] font-black uppercase text-blue-700">Sync Direct Doc:</span>
                                            <select className="border border-slate-300 text-[11px] p-1 w-72 font-bold rounded" onChange={handleOrderSync}>
                                                <option value="">-- Direct Doc --</option>
                                                {listData.directOrders.map(o => <option key={o.id} value={`WITHOUT|${o.order_no}`}>{o.order_no}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex-1 border border-slate-300 overflow-x-auto bg-slate-50 shadow-inner rounded">
                                        <table className="min-w-[9800px] text-[10px] border-collapse bg-white">
                                            <thead className="bg-blue-50 sticky top-0 z-10 border-b-2 border-slate-500 text-slate-900">
                                                <tr className="h-12">
                                                    <th className="p-3 border-r w-10"></th>
                                                    <th className="p-3 border-r w-32 text-center">OrderNo</th>
                                                    <th className="p-3 border-r w-80 text-center">Product Description</th>
                                                    <th className="p-3 border-r w-24 text-center">No of Bags</th>
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
                                                    <tr key={i} className="hover:bg-blue-50">
                                                        <td className="p-2 border-r text-center text-slate-300">›</td>
                                                        <td className="p-2 border-r text-center text-blue-800 font-mono bg-slate-50">{r.order_no}</td>
                                                        <td className="p-2 border-r text-center uppercase text-slate-800 bg-slate-50">{r.product_description}</td>
                                                        <td className="p-0 border-r w-24">
                                                            <input
                                                                type="number"
                                                                className="w-full h-full p-2 text-center bg-pink-50 outline-none focus:bg-pink-100 font-bold"
                                                                value={r.packs}
                                                                onChange={e => updateGrid(i, 'packs', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="p-0 border-r w-32">
                                                            <input
                                                                type="text"
                                                                className="w-full h-full p-2 text-center bg-white outline-none uppercase font-bold text-slate-800"
                                                                value={r.packing_type || ''}
                                                                onChange={e => updateGrid(i, 'packing_type', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="p-0 border-r w-32">
                                                            <input
                                                                type="number"
                                                                className="w-full h-full p-2 text-center text-blue-700 font-bold outline-none bg-blue-50"
                                                                value={r.total_kgs}
                                                                onChange={e => updateGrid(i, 'total_kgs', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="p-0 border-r w-32">
                                                            <input
                                                                type="number"
                                                                className="w-full h-full p-2 text-center bg-emerald-50 text-emerald-700 outline-none focus:bg-emerald-100 font-bold"
                                                                value={r.avg_content || 0}
                                                                onChange={e => updateGrid(i, 'avg_content', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="p-0 border-r w-32">
                                                            <input
                                                                type="number"
                                                                className="w-full h-full p-2 text-center outline-none bg-white font-bold"
                                                                value={r.rate}
                                                                onChange={e => updateGrid(i, 'rate', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="p-0 border-r w-24"><input type="text" className="w-full h-full p-2 text-center outline-none bg-white uppercase font-bold text-slate-800" value={r.rate_per || ''} onChange={e => updateGrid(i, 'rate_per', e.target.value)} /></td>
                                                        <td className="p-1 border-r"><input type="text" className="w-full p-1 border border-slate-300 rounded font-bold uppercase text-center" value={r.identification_mark || ''} onChange={e => updateGrid(i, 'identification_mark', e.target.value)} /></td>
                                                        <td className="p-2 border-r text-center bg-blue-100 text-blue-800">{num(r.assessable_value).toFixed(2)}</td>
                                                        <td className="p-0 border-r w-28"><input type="number" className="w-full h-full p-2 text-center outline-none bg-white font-bold" value={r.charity_per_bale || 0} onChange={e => updateGrid(i, 'charity_per_bale', e.target.value)} /></td>
                                                        <td className="p-0 border-r w-32">
                                                            <input
                                                                type="number"
                                                                className="w-full h-full p-2 text-center text-orange-600 outline-none bg-white font-bold"
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
                        <div className="bg-[#D9E5F7] p-3 border-t border-slate-400 flex flex-wrap justify-between items-center gap-3 px-6 shadow-inner">
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
                                    className="bg-indigo-600 text-white px-6 py-2 text-[11px] font-black rounded flex items-center gap-2 shadow hover:bg-indigo-700 transition-all active:scale-95"
                                >
                                    <FileJson size={14} className="text-indigo-100" />
                                    EXPORT JSON
                                </button>
                                <button
                                    onClick={exportToExcel}
                                    disabled={gridRows.length === 0}
                                    className="bg-emerald-600 text-white px-6 py-2 text-[11px] font-black rounded flex items-center gap-2 shadow hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    <FileSpreadsheet size={14} className="text-emerald-100" />
                                    EXPORT EXCEL
                                </button>
                            </div>
                            <div className="flex gap-3">
                                {formData.id && (
                                    <button
                                        onClick={handleDelete}
                                        disabled={submitLoading}
                                        className="bg-red-600 hover:bg-red-700 text-white border border-red-700 px-6 py-2 text-[11px] font-black rounded flex items-center gap-2 shadow-md transition-all active:scale-95 mr-6"
                                    >
                                        <Trash2 size={16} />
                                        DELETE INVOICE
                                    </button>
                                )}

                                {/* PRINT INVOICE BUTTON */}
                                {/* <button
                                    onClick={() => handlePrint({ ...formData, Details: gridRows, InvoiceDetails: gridRows })}
                                    disabled={gridRows.length === 0}
                                    className="bg-indigo-600 text-white px-5 py-2 text-[11px] font-black rounded flex items-center gap-2 shadow hover:bg-indigo-700 transition-all"
                                >
                                    <Printer size={16} /> PRINT INVOICE
                                </button> */}

                                {/* EXPORT PDF BUTTON */}
                                <button
                                    onClick={exportToPDF}
                                    disabled={gridRows.length === 0}
                                    className="bg-emerald-600 text-white px-5 py-2 text-[11px] font-black rounded flex items-center gap-2 shadow hover:bg-emerald-700 transition-all"
                                >
                                    <FileText size={16} /> DOWNLOAD PDF
                                </button>

                                {/* UPDATE BUTTON */}
                                <button
                                    onClick={handleSave}
                                    disabled={submitLoading}
                                    className="bg-blue-600 text-white border border-blue-700 px-12 py-2 text-[11px] font-black rounded flex items-center gap-2 hover:bg-blue-700 shadow-md"
                                >
                                    <Save size={16} className="text-blue-700" />
                                    {submitLoading ? 'SAVING...' : 'COMMIT INVOICE'}
                                </button>

                                {/* CANCEL BUTTON */}
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="bg-white border border-slate-400 px-10 py-2 text-[11px] font-black rounded uppercase hover:bg-slate-50"
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

            {/* --- PREMIUM IMPORT WIZARD MODAL --- */}
            {importModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
                        {/* Header */}
                        <div className="bg-slate-950 p-6 text-white flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                                    <Database size={24} className="text-emerald-400 animate-pulse" /> Bulk Invoice Import Wizard
                                </h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                                    Step {importStep} of 2: {importStep === 1 ? "Assign Transports & Verify Loads" : "Verify Invoices List"}
                                </p>
                            </div>
                            <button onClick={() => setImportModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Wizard Step Tabs */}
                        <div className="flex bg-slate-100 border-b border-slate-200 shrink-0">
                            <button
                                onClick={() => setImportStep(1)}
                                className={`flex-1 py-4 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all ${
                                    importStep === 1 ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                1. Dispatch Batches ({importDespatches.length})
                            </button>
                            <button
                                onClick={() => setImportStep(2)}
                                className={`flex-1 py-4 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all ${
                                    importStep === 2 ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                2. Invoices Preview ({importInvoices.length})
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 custom-scrollbar">
                            {importStep === 1 ? (
                                <div className="space-y-4">
                                    <div className="bg-white p-5 rounded-2xl border-2 border-blue-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3.5">
                                            <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
                                                <Truck className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <div className="text-xs font-black uppercase text-slate-900 tracking-wider">Select Transport Carrier for All Records</div>
                                                <div className="text-[11px] text-slate-500 font-medium">This carrier will be assigned to all dispatch batches and invoices generated from this file.</div>
                                            </div>
                                        </div>
                                        <div className="w-full md:w-80">
                                            <select
                                                value={importGlobalTransportId}
                                                onChange={(e) => {
                                                    const tId = e.target.value;
                                                    setImportGlobalTransportId(tId);
                                                    setImportDespatches(prev => prev.map(d => ({ ...d, transport_id: tId })));
                                                }}
                                                className="w-full p-2.5 border-2 border-blue-400 focus:border-blue-600 rounded-xl outline-none bg-blue-50/50 focus:bg-white font-sans text-xs font-black text-slate-900 shadow-sm cursor-pointer"
                                            >
                                                <option value="">-- Choose Transport Carrier --</option>
                                                {listData.transports.map(t => (
                                                    <option key={t.id} value={t.id}>{t.transport_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
                                        <table className="w-full text-left text-xs font-mono">
                                            <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-widest font-black">
                                                <tr>
                                                    <th className="p-4">Date</th>
                                                    <th className="p-4">Product</th>
                                                    <th className="p-4 text-center">Bags</th>
                                                    <th className="p-4 text-right">Calculated Freight</th>
                                                    <th className="p-4 w-72">Assigned Transport Carrier</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {importDespatches.map((d, index) => {
                                                    const selectedTransport = listData.transports.find(t => String(t.id) === String(d.transport_id || importGlobalTransportId));
                                                    return (
                                                        <tr key={d.key} className="hover:bg-slate-50">
                                                            <td className="p-4 font-bold">{d.date}</td>
                                                            <td className="p-4 font-black text-slate-700">{d.product_name}</td>
                                                            <td className="p-4 text-center font-bold text-blue-600">{d.no_of_bags}</td>
                                                            <td className="p-4 text-right font-black">₹{d.freight.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                            <td className="p-4">
                                                                {selectedTransport ? (
                                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                                                                        <Truck size={13} /> {selectedTransport.transport_name}
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
                                                                        ⚠️ Select above
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
                                        <table className="w-full text-left text-xs font-mono">
                                            <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-widest font-black">
                                                <tr>
                                                    <th className="p-4">Inv No</th>
                                                    <th className="p-4">Date</th>
                                                    <th className="p-4">Party Name</th>
                                                    <th className="p-4">Products</th>
                                                    <th className="p-4 text-center">Bags</th>
                                                    <th className="p-4 text-right">Net Value</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {importInvoices.map((inv, index) => {
                                                    const totalBags = inv.rows.reduce((sum, r) => sum + r.packs, 0);
                                                    const totalVal = inv.rows.reduce((sum, r) => sum + r.value, 0);
                                                    return (
                                                        <tr key={index} className="hover:bg-slate-50">
                                                            <td className="p-4 font-bold text-blue-600">{inv.excelInvNo}</td>
                                                            <td className="p-4">{inv.date}</td>
                                                            <td className="p-4 font-black text-slate-800 uppercase">{inv.partyName}</td>
                                                            <td className="p-4 text-slate-500 uppercase">{inv.rows.map(r => r.product_name).join(', ')}</td>
                                                            <td className="p-4 text-center font-bold">{totalBags}</td>
                                                            <td className="p-4 text-right font-black">₹{Math.round(totalVal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-between items-center shrink-0 px-6">
                            <button
                                onClick={() => setImportModalOpen(false)}
                                className="bg-white border border-slate-300 px-6 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl hover:bg-slate-50"
                            >
                                Cancel
                            </button>

                            <div className="flex gap-3">
                                {importStep === 1 ? (
                                    <button
                                        onClick={() => setImportStep(2)}
                                        className="bg-blue-600 text-white px-8 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl hover:bg-blue-700 shadow-md transition-all"
                                    >
                                        Next: Review Invoices
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setImportStep(1)}
                                            className="bg-white border border-slate-300 px-6 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl hover:bg-slate-50"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={handleConfirmImport}
                                            disabled={importLoading}
                                            className="bg-emerald-600 text-white px-10 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl hover:bg-emerald-700 shadow-md disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {importLoading ? 'IMPORTING...' : 'CONFIRM & SAVE'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Print View Rendered in DOM for window.print() */}
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
};

// ==========================================
// ERP HELPER COMPONENTS
// ==========================================
const RowInput = ({ label, width = "w-full", color = "bg-white", ...props }) => (
    <div className="flex items-center">
        <label className="w-[140px] text-[10px] font-black text-slate-700 uppercase tracking-tighter">{label}</label>
        <input {...props} className={`border border-slate-300 p-1 px-2 text-[11px] font-bold outline-none rounded-sm shadow-sm ${width} ${color}`} />
    </div>
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
const TotalRow = ({ label, value, isEditable = false, onChange, color = "text-slate-900" }) => {
    const displayValue =
        value === '' || value === null || value === undefined
            ? ''
            : Number(value).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });

    return (
        <div className="flex justify-between items-center text-[10px] py-0.5 px-2 hover:bg-white rounded transition-colors">
            <span className="font-black text-slate-500 uppercase tracking-tighter">
                {label}
            </span>
            <input
                readOnly={!isEditable}
                value={isEditable ? (value ?? '') : displayValue}
                onChange={onChange}
                className={`w-32 border border-slate-300 text-right p-0.5 font-mono text-[11px] font-black outline-none rounded shadow-inner ${color} ${isEditable ? 'bg-white border-blue-400' : 'bg-slate-50'}`}
            />
        </div>
    );
};

const FooterBtn = ({ label, icon }) => (
    <button className="bg-white border border-slate-400 px-3 py-1.5 text-[10px] font-black flex items-center gap-1.5 hover:bg-slate-50 shadow-sm transition-colors">
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
                className={`w-full p-2 text-center font-bold border rounded bg-white outline-none focus:border-blue-500 ${color} disabled:bg-slate-100 disabled:border-transparent`}
                value={row[perKey] || 0}
                onChange={(e) => updateGrid(idx, perKey, e.target.value)}
            />
        </td>
        <td className={`p-2 border-r text-center font-bold bg-slate-50 ${color}`}>
            {amtEditable ? (
                <input
                    type="number"
                    step="0.01"
                    className={`w-full p-2 text-center font-bold border-none outline-none focus:bg-yellow-50 bg-white ${color}`}
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
