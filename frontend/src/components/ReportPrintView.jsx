import React from 'react';
import { Printer, Download, Share2 } from 'lucide-react';

const ReportPrintView = ({ title, data, type }) => {
  const printPage = () => window.print();

  return (
    <div className="bg-gray-500 min-h-screen p-10 flex flex-col items-center">
      {/* Control Bar (Non-Printable) */}
      <div className="w-[210mm] bg-white p-2 mb-4 flex justify-between items-center shadow-lg print:hidden">
        <span className="text-xs font-bold text-gray-500 uppercase">{title} - Preview</span>
        <div className="flex gap-2">
          <button onClick={printPage} className="bg-blue-600 text-white px-4 py-1 text-xs flex items-center gap-1 hover:bg-blue-700">
            <Printer size={14}/> Print
          </button>
          <button className="bg-gray-200 px-4 py-1 text-xs flex items-center gap-1">
            <Download size={14}/> PDF
          </button>
        </div>
      </div>

      {/* Actual Printable Page (A4 Size) */}
      <div className="w-[210mm] min-h-[297mm] bg-white shadow-2xl p-12 print:shadow-none print:p-0">
        <div className="border-2 border-black p-4">
          {/* Company Header */}
          <div className="text-center border-b-2 border-black pb-2 mb-4">
            <h1 className="text-xl font-black">KAYAAR EXPORTS PRIVATE LIMITED</h1>
            <p className="text-[10px]">Railway Feeder Road, Kovilpatti, Tuticorin Dist, Tamilnadu</p>
            <p className="text-[10px] font-bold">GSTIN: 33AAACK4468M1ZA | PAN: AAACK4468M</p>
          </div>

          <div className="flex justify-between text-[11px] font-bold mb-4">
             <div className="uppercase">To: <br/>{data?.Party?.account_name || 'CASH SALES'}<br/>{data?.Party?.address}</div>
             <div className="text-right">Invoice No: {data?.invoice_no || '001'}<br/>Date: {data?.date}</div>
          </div>

          {/* Table */}
          <table className="w-full border border-black text-[11px]">
            <thead className="bg-gray-100 border-b border-black">
              <tr>
                <th className="border-r border-black p-1">No of Bags / Boxes</th>
                <th className="border-r border-black p-1">Description of Goods</th>
                <th className="border-r border-black p-1">Rate</th>
                <th className="p-1">Value</th>
              </tr>
            </thead>
            <tbody className="h-64 align-top">
              <tr>
                <td className="border-r border-black p-2 text-center">96</td>
                <td className="border-r border-black p-2 font-bold">68 S COMBED COTTON YARN STAR<br/><span className="text-[9px] font-normal">HSN: 52052790</span></td>
                <td className="border-r border-black p-2 text-right">351.34</td>
                <td className="p-2 text-right">18,55,060.00</td>
              </tr>
            </tbody>
          </table>

          {/* Footer Signatures */}
          <div className="mt-20 flex justify-between text-[10px] font-bold">
             <div className="border-t border-black w-32 text-center pt-1">PREPARED BY</div>
             <div className="border-t border-black w-32 text-center pt-1">VERIFIED BY</div>
             <div className="border-t border-black w-32 text-center pt-1">AUTHORISED SIGNATORY</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportPrintView;