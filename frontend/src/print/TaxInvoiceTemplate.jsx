import React, { forwardRef } from 'react';

const TaxInvoiceTemplate = forwardRef(({ data }, ref) => {
    if (!data) return null;

    // Helper to calculate totals if not provided by backend
    const totalBags = data.InvoiceDetails?.reduce((sum, item) => sum + (parseFloat(item.packs) || 0), 0);
    const totalKgs = data.InvoiceDetails?.reduce((sum, item) => sum + (parseFloat(item.total_kgs) || 0), 0);

    return (
        <div ref={ref} className="invoice-print-root">
            <div className="invoice-page" style={{ height: "297mm", overflow: "hidden" }}>
            {/* Header Border Wrapper */}
            <div className="border-2 border-black">
                
                {/* 1. Title Row */}
                <div className="border-b-2 border-black py-2 text-center relative">
                    <h1 className="text-xl font-bold tracking-widest">TAX INVOICE</h1>
                    <div className="absolute top-2 right-4 text-[10px] text-left border border-black p-1 leading-tight">
                        <label className="flex items-center gap-1"><div className="w-3 h-3 border border-black"></div> ORIGINAL FOR BUYER</label>
                        <label className="flex items-center gap-1"><div className="w-3 h-3 border border-black"></div> DUPLICATE FOR TRANSPORTER</label>
                        <label className="flex items-center gap-1"><div className="w-3 h-3 border border-black"></div> TRIPLICATE FOR FILE COPY</label>
                    </div>
                </div>

                {/* 2. Company Info Row */}
                <div className="border-b-2 border-black grid grid-cols-4">
                    <div className="col-span-3 p-4 text-center border-r-2 border-black">
                        <h2 className="text-lg font-black">KAYAAR EXPORTS PRIVATE LIMITED</h2>
                        <p>D.No: 43/5, Railway Feeder Road,</p>
                        <p>K.R. Nagar - 628 503, Kovilpatti - Taluk</p>
                        <p>Tuticorin Dist., Tamilnadu, India</p>
                        <p className="mt-2 font-bold">(04632) - 248258, 94432 38761</p>
                        <p>E-Mail: ttnkrgroup@gmail.com</p>
                        <p className="font-bold">GSTIN : 33AAACK4468M1ZA</p>
                    </div>
                    <div className="flex-1 p-2 text-[10px] flex flex-col justify-center items-center">
                        <div className="border border-black p-2 text-center w-full">
                            <p className="font-bold">OEKO-TEX ®</p>
                            <p className="text-blue-600 font-bold text-[8px]">STANDARD 100</p>
                            <p className="text-[7px]">Tested for harmful substances</p>
                        </div>
                        <p className="mt-4">PAN: AAACK4468M</p>
                        <p>CIN: U51101TN1991PTC020933</p>
                    </div>
                </div>

                {/* 3. Party & Invoice Info Row */}
                <div className="border-b-2 border-black grid grid-cols-4 min-h-[150px]">
                    <div className="col-span-3 p-4 border-r-2 border-black">
                        <p className="font-bold underline mb-1">Party Name & Address</p>
                        <h3 className="font-black text-sm uppercase">{data.Party?.account_name}</h3>
                        <p className="whitespace-pre-wrap">{data.Party?.address}</p>
                        <p className="mt-2 font-bold uppercase">GST No: {data.Party?.gst_no}</p>
                    </div>
                    <div className="w-[300px]">
                        <table className="w-full h-full text-xs">
                            <tbody>
                                <tr className="border-b border-black">
                                    <td className="p-1 font-bold pl-2">Invoice No</td>
                                    <td className="p-1">:</td>
                                    <td className="p-1 font-bold text-right pr-4">{data.invoice_no}</td>
                                </tr>
                                <tr className="border-b border-black">
                                    <td className="p-1 font-bold pl-2">Invoice Dt</td>
                                    <td className="p-1">:</td>
                                    <td className="p-1 font-bold text-right pr-4">{data.date}</td>
                                </tr>
                                <tr className="border-b border-black">
                                    <td className="p-1 font-bold pl-2">E-Way Bill No</td>
                                    <td className="p-1">:</td>
                                    <td className="p-1 text-right pr-4">{data.remarks?.match(/EWAY:(\d+)/)?.[1] || '-'}</td>
                                </tr>
                                <tr className="border-b border-black">
                                    <td className="p-1 font-bold pl-2">Vehicle No</td>
                                    <td className="p-1">:</td>
                                    <td className="p-1 text-right pr-4 uppercase">{data.vehicle_no}</td>
                                </tr>
                                <tr>
                                    <td className="p-1 font-bold pl-2">Delivery At</td>
                                    <td className="p-1">:</td>
                                    <td className="p-1 text-right pr-4 uppercase">{data.delivery}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. Description Table */}
                <table className="w-full border-collapse text-xs">
                    <thead>
                        <tr className="border-b-2 border-black font-bold text-center">
                            <th className="border-r-2 border-black p-2 w-20">No of Bags</th>
                            <th className="border-r-2 border-black p-2 w-32">Net Weight</th>
                            <th className="border-r-2 border-black p-2 w-40">S.L No</th>
                            <th className="border-r-2 border-black p-2 w-32">Rate Per Kgs</th>
                            <th className="p-2">Assessable Value</th>
                        </tr>
                    </thead>
                    <tbody className="min-h-[300px]">
                        {data.InvoiceDetails?.map((item, idx) => {
                            const rowWeight = parseFloat(item.total_kgs) || 0;
                            const rowAssessable = Math.round(parseFloat(item.assessable_value || (rowWeight * parseFloat(item.rate)) || 0));
                            return (
                                <React.Fragment key={idx}>
                                    <tr className="text-center font-bold">
                                        <td className="border-r-2 border-black p-2 align-top">{item.packs}</td>
                                        <td className="border-r-2 border-black p-2 align-top">{rowWeight.toFixed(2)}</td>
                                        <td className="border-r-2 border-black p-2 align-top text-[10px]">{item.sl_no || '-'}</td>
                                        <td className="border-r-2 border-black p-2 align-top">{parseFloat(item.rate || 0).toFixed(2)}</td>
                                        <td className="p-2 text-right align-top pr-4">{rowAssessable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={5} className="px-4 py-2">
                                            <p className="font-black text-sm uppercase">{item.Product?.product_name}</p>
                                            <p className="mt-2 font-bold">HSN CODE: {item.Product?.TariffSubHead?.tariff_no || '52052790'}</p>
                                        </td>
                                    </tr>
                                </React.Fragment>
                            );
                        })}
                        {/* Filler Row to push footer down */}
                        <tr style={{ height: "120px" }}>
                            <td className="border-r-2 border-black"></td>
                            <td className="border-r-2 border-black"></td>
                            <td className="border-r-2 border-black"></td>
                            <td className="border-r-2 border-black"></td>
                            <td></td>
                        </tr>
                    </tbody>
                    {/* Financial Summary Footer */}
                    <tfoot>
                        <tr className="border-t-2 border-black">
                            <td colSpan={3} className="border-r-2 border-black p-4 align-bottom">
                                <p className="font-bold">Amount in Words:</p>
                                <p className="uppercase italic">Indian Rupees Only</p>
                            </td>
                            <td colSpan={2} className="p-0">
                                <table className="w-full text-xs font-bold">
                                    <tbody>
                                        <tr className="border-b border-black">
                                            <td className="p-2 pl-4">CHARITY</td>
                                            <td className="p-2 text-right pr-4">{Math.round(parseFloat(data.charity || data.total_charity || 0)).toFixed(2)}</td>
                                        </tr>
                                        <tr className="border-b border-black">
                                            <td className="p-2 pl-4">FREIGHT</td>
                                            <td className="p-2 text-right pr-4">{Math.round(parseFloat(data.freight || data.freight_charges || 0)).toFixed(2)}</td>
                                        </tr>
                                        <tr className="border-b border-black">
                                            <td className="p-2 pl-4">C.G.S.T &nbsp;&nbsp;&nbsp; : {parseFloat(data.cgst_percentage || data.cgst_per || 0).toFixed(2)} %</td>
                                            <td className="p-2 text-right pr-4">{Math.round(parseFloat(data.total_cgst || data.cgst_amt || 0)).toFixed(2)}</td>
                                        </tr>
                                        <tr className="border-b border-black">
                                            <td className="p-2 pl-4">S.G.S.T &nbsp;&nbsp;&nbsp; : {parseFloat(data.sgst_percentage || data.sgst_per || 0).toFixed(2)} %</td>
                                            <td className="p-2 text-right pr-4">{Math.round(parseFloat(data.total_sgst || data.sgst_amt || 0)).toFixed(2)}</td>
                                        </tr>
                                        <tr className="border-b border-black">
                                            <td className="p-2 pl-4">I.G.S.T &nbsp;&nbsp;&nbsp; : {parseFloat(data.igst_percentage || data.igst_per || 0).toFixed(2)} %</td>
                                            <td className="p-2 text-right pr-4">{Math.round(parseFloat(data.total_igst || data.igst_amt || 0)).toFixed(2)}</td>
                                        </tr>
                                        <tr className="bg-slate-100">
                                            <td className="p-2 pl-4 text-sm font-black">TOTAL VALUE</td>
                                            <td className="p-2 text-right pr-4 text-sm font-black">₹ {Math.round(parseFloat(data.final_invoice_value || data.net_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            {/* Disclaimer & Signatures */}
            <div className="mt-4 flex justify-between text-[10px]">
                <div className="w-2/3">
                    <p className="font-bold underline">Terms & Conditions:</p>
                    <p>1. Goods once sold will not be taken back.</p>
                    <p>2. Interest @24% will be charged if payment is not made within due date.</p>
                </div>
                <div className="text-center border-t border-black pt-8 w-64">
                    <p className="font-bold">For KAYAAR EXPORTS PRIVATE LIMITED</p>
                    <p className="mt-12 uppercase font-bold">Authorised Signatory</p>
                </div>
            </div>
        </div>
          </div>
// </div>
    );
});
<style>
{`
.invoice-print-root {
  font-family: "Times New Roman", serif;
}

.invoice-page {
  width: 210mm;
  height: 297mm;   /* FIXED HEIGHT */
  padding: 10mm;
  margin: 0 auto;
  background: white;
  overflow: hidden;   /* PREVENT SPLIT */
}

.invoice-page table {
  width: 100%;
  border-collapse: collapse;
}

.invoice-page tr,
.invoice-page td,
.invoice-page th {
  page-break-inside: avoid !important;
}

.invoice-page {
  page-break-after: avoid !important;
  page-break-before: avoid !important;
  page-break-inside: avoid !important;
}

.invoice-print-root {
  page-break-inside: avoid !important;
}

@media print {

  html, body {
    width: 210mm;
    height: 297mm;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  body * {
    visibility: hidden;
  }

  .invoice-print-root,
  .invoice-print-root * {
    visibility: visible;
  }

  .invoice-print-root {
    position: absolute;
    top: 0;
    left: 0;
  }

  .invoice-page {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  table, tr, td, th {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  @page {
    size: A4 portrait;
    margin: 5mm;
  }

}
`}
</style>
export default TaxInvoiceTemplate;