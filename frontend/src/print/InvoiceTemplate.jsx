import React from 'react';

export const InvoiceTemplate = React.forwardRef(({ data }, ref) => {
  if (!data) return null;

  return (
    <div ref={ref} className="p-10 text-slate-900 bg-white w-[210mm] min-h-[297mm] font-serif">
      {/* Header Section */}
      <div className="border-2 border-black p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm font-bold">TAX INVOICE</div>
          <div className="flex gap-4 text-[10px]">
            <label><input type="checkbox" /> ORIGINAL FOR BUYER</label>
            <label><input type="checkbox" /> DUPLICATE FOR TRANSPORTER</label>
          </div>
        </div>

        <div className="text-center mb-4">
          <h1 className="text-xl font-bold">KAYAAR EXPORTS PRIVATE LIMITED</h1>
          <p className="text-xs">Railway Feeder Road, Kovilpatti - 628503</p>
          <p className="text-xs font-bold">GSTIN: 33AAACK4468M1ZA</p>
        </div>

        {/* Party Details & Invoice Details Row */}
        <div className="grid grid-cols-2 border-t-2 border-black">
          <div className="border-r-2 border-black p-2">
            <p className="text-[10px] font-bold">Party Name & Address:</p>
            <p className="text-sm font-bold">{data.party_name}</p>
            <p className="text-xs">{data.address}</p>
            <p className="text-xs font-bold mt-2">GST No: {data.gst_no}</p>
          </div>
          <div className="p-2 text-xs space-y-1">
            <div className="flex justify-between"><span>Invoice No:</span> <b>{data.invoice_no}</b></div>
            <div className="flex justify-between"><span>Invoice Date:</span> <b>{data.date}</b></div>
            <div className="flex justify-between"><span>E-Way Bill No:</span> <b>{data.ebill}</b></div>
            <div className="flex justify-between"><span>Vehicle No:</span> <b>{data.vehicle}</b></div>
          </div>
        </div>

        {/* Description Table */}
        <table className="w-full border-t-2 border-black text-xs">
            <thead className="border-b-2 border-black">
                <tr>
                    <th className="border-r-2 border-black p-1">No of Bags / Boxes</th>
                    <th className="border-r-2 border-black p-1">Net Weight in Kgs</th>
                    <th className="border-r-2 border-black p-1">Rate</th>
                    <th className="p-1">Assessable Value</th>
                </tr>
            </thead>
            <tbody>
                <tr className="h-40 align-top">
                    <td className="border-r-2 border-black p-2 text-center">{data.bags}</td>
                    <td className="border-r-2 border-black p-2 text-center">{data.weight}</td>
                    <td className="border-r-2 border-black p-2 text-center">{data.rate}</td>
                    <td className="p-2 text-right font-bold">{data.total}</td>
                </tr>
            </tbody>
        </table>

        {/* Totals Section */}
        <div className="border-t-2 border-black flex justify-end p-2 text-xs">
            <div className="w-48 space-y-1">
                <div className="flex justify-between"><span>CHARITY:</span> <span>15,840.00</span></div>
                <div className="flex justify-between"><span>FREIGHT:</span> <span>25,100.00</span></div>
                <div className="flex justify-between font-bold border-t-2 border-black pt-1">
                    <span>GRAND TOTAL:</span> <span>{data.grand_total}</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
});