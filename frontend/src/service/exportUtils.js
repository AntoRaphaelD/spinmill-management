// =====================================================
// GST E-INVOICE JSON EXPORT UTILITY (NIC SCHEMA v1.1)
// =====================================================

const num = (v) => {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
};

export const formatGstDate = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

const extractStateCode = (gstin, fallback = '33') => {
    if (gstin && typeof gstin === 'string') {
        const clean = gstin.trim();
        if (clean.length >= 2 && !isNaN(clean.slice(0, 2))) {
            return clean.slice(0, 2);
        }
    }
    return fallback;
};

const extractPin = (party, formData) => {
    if (party?.pincode) {
        const p = parseInt(party.pincode, 10);
        if (!isNaN(p) && p > 0) return p;
    }
    if (party?.pin) {
        const p = parseInt(party.pin, 10);
        if (!isNaN(p) && p > 0) return p;
    }
    // Try to extract 6-digit pin code from address lines
    const combinedAddr = [formData?.addr1, formData?.addr2, formData?.addr3, formData?.addr4, formData?.addr5, party?.address].filter(Boolean).join(' ');
    const match = combinedAddr.match(/\b\d{6}\b/);
    if (match) {
        return parseInt(match[0], 10);
    }
    return 0;
};

/**
 * Generates JSON structure strictly adhering to DocScanner Sep 10 2026 E-Invoice Schema
 */
export const generateGstEInvoiceJson = ({ formData = {}, gridRows = [], listData = {} }) => {
    const party = (listData.parties || []).find(p => String(p.id) === String(formData.party_id)) || formData.Party || {};
    const config = (listData.types || []).find(t => String(t.id) === String(formData.invoice_type_id)) || {};
    const items = gridRows.length > 0 ? gridRows : (formData.Details || formData.InvoiceDetails || []);

    const gstPer = num(config.gst_percentage);
    let cgstPer = num(config.cgst_percentage) || (items.length ? num(items[0]?.cgst_per) : 0);
    let sgstPer = num(config.sgst_percentage) || (items.length ? num(items[0]?.sgst_per) : 0);
    let igstPer = num(config.igst_percentage) || (items.length ? num(items[0]?.igst_per) : 0);

    if (igstPer === 0 && cgstPer === 0 && sgstPer === 0 && gstPer > 0) {
        cgstPer = gstPer / 2;
        sgstPer = gstPer / 2;
    }

    const totalGst = num(formData.total_gst) || items.reduce((sum, r) => sum + num(r.gst_amt), 0);
    let totalCgst = num(formData.total_cgst) || items.reduce((sum, r) => sum + num(r.cgst_amt), 0);
    let totalSgst = num(formData.total_sgst) || items.reduce((sum, r) => sum + num(r.sgst_amt), 0);
    let totalIgst = num(formData.total_igst) || items.reduce((sum, r) => sum + num(r.igst_amt), 0);

    if (igstPer > 0 && totalIgst === 0 && totalGst > 0) {
        totalIgst = totalGst;
    } else if (igstPer === 0 && totalCgst === 0 && totalSgst === 0 && totalGst > 0) {
        totalCgst = totalGst / 2;
        totalSgst = totalGst / 2;
    }

    const totalAssessable = items.reduce((sum, r) => sum + num(r.assessable_value || (num(r.total_kgs) * num(r.rate))), 0);
    const totalCharity = num(formData.total_charity);
    const totalFreight = num(formData.freight_charges || formData.freight);
    const totalOther = num(formData.total_other);
    const othChrg = Number((totalCharity + totalFreight + totalOther).toFixed(2));
    const roundOff = num(formData.round_off);
    const netAmount = num(formData.net_amount || formData.final_invoice_value || (totalAssessable + totalIgst + totalCgst + totalSgst + othChrg + roundOff));

    const buyerGstin = (party.gst_no || formData.gst_no || '').trim();
    const buyerStateCode = extractStateCode(buyerGstin, '33');
    const buyerPin = extractPin(party, formData);

    const getHSN = (productId) => {
        const prod = (listData.products || []).find(p => String(p.id) === String(productId));
        return prod?.printing_tariff_desc || '52052790';
    };

    const getProductDesc = (item) => {
        if (item.product_description) return item.product_description;
        const prod = (listData.products || []).find(p => String(p.id) === String(item.product_id));
        return prod?.short_description || prod?.product_name || 'COTTON YARN';
    };

    const itemList = items.map((item, idx) => {
        const rowQty = num(item.total_kgs);
        const rowRate = num(item.rate);
        const rowAssessable = num(item.assessable_value || (rowQty * rowRate));
        const effectiveRate = rowQty > 0 ? Number((rowAssessable / rowQty).toFixed(3)) : rowRate;

        const rowGstRate = gstPer > 0 ? gstPer : ((num(item.cgst_per) || 0) + (num(item.sgst_per) || 0) + (num(item.igst_per) || 0));
        let rowIgst = num(item.igst_amt);
        let rowCgst = num(item.cgst_amt);
        let rowSgst = num(item.sgst_amt);

        if (igstPer > 0 && rowIgst === 0 && rowGstRate > 0) {
            rowIgst = Number(((rowAssessable * igstPer) / 100).toFixed(2));
        } else if (igstPer === 0 && rowCgst === 0 && rowSgst === 0 && rowGstRate > 0) {
            rowCgst = Number(((rowAssessable * (rowGstRate / 2)) / 100).toFixed(2));
            rowSgst = Number(((rowAssessable * (rowGstRate / 2)) / 100).toFixed(2));
        }

        const rowTotItemVal = Number((rowAssessable + rowIgst + rowCgst + rowSgst).toFixed(2));

        return {
            SlNo: String(idx + 1),
            PrdDesc: getProductDesc(item),
            IsServc: "N",
            HsnCd: item.hsn_code || getHSN(item.product_id),
            Barcde: null,
            Qty: Number(rowQty.toFixed(1)),
            FreeQty: 0.0,
            Unit: "KGS",
            UnitPrice: effectiveRate,
            TotAmt: Number(rowAssessable.toFixed(1)),
            Discount: 0.0,
            PreTaxVal: 0.0,
            AssAmt: Number(rowAssessable.toFixed(1)),
            GstRt: Number(rowGstRate.toFixed(1)),
            IgstAmt: Number(rowIgst.toFixed(1)),
            CgstAmt: Number(rowCgst.toFixed(1)),
            SgstAmt: Number(rowSgst.toFixed(1)),
            CesRt: 0.0,
            CesAmt: 0.0,
            CesNonAdvlAmt: 0.0,
            StateCesRt: 0.0,
            StateCesAmt: 0.0,
            StateCesNonAdvlAmt: 0.0,
            OthChrg: 0.0,
            TotItemVal: rowTotItemVal,
            BchDtls: null
        };
    });

    return [
        {
            Version: "1.1",
            TranDtls: {
                TaxSch: "GST",
                SupTyp: "B2B",
                IgstOnIntra: "N",
                RegRev: "N",
                EcmGstin: null
            },
            DocDtls: {
                Typ: "INV",
                No: String(formData.invoice_no || "1"),
                Dt: formatGstDate(formData.date)
            },
            SellerDtls: {
                Gstin: "33AAACK4468M1ZA",
                LglNm: "KAYAAR EXPORTS PRIVATE LIMITED",
                TrdNm: "KAYAAR EXPORTS PRIVATE LIMITED",
                Addr1: "D.No. 43/5, Railway Feeder Road,K.R.Nagar - 628503",
                Addr2: null,
                Loc: "Kovilpatti -Taluk",
                Pin: 628503,
                Stcd: "33",
                Ph: null,
                Em: null
            },
            BuyerDtls: {
                Gstin: buyerGstin,
                LglNm: party.account_name || formData.party_name || "",
                TrdNm: party.account_name || formData.party_name || "",
                Pos: buyerStateCode,
                Addr1: formData.addr1 || party.addr1 || party.address || "",
                Addr2: formData.addr2 || party.addr2 || null,
                Loc: formData.delivery || party.city || party.place || "MUMBAI",
                Pin: buyerPin,
                Stcd: buyerStateCode,
                Ph: null,
                Em: null
            },
            ValDtls: {
                AssVal: Number(totalAssessable.toFixed(1)),
                IgstVal: Number(totalIgst.toFixed(1)),
                CgstVal: Number(totalCgst.toFixed(1)),
                SgstVal: Number(totalSgst.toFixed(1)),
                CesVal: 0.0,
                StCesVal: 0.0,
                Discount: 0.0,
                OthChrg: othChrg,
                RndOffAmt: Number(roundOff.toFixed(1)),
                TotInvVal: Number(netAmount.toFixed(1)),
                TotInvValFc: 0.0
            },
            ExpDtls: {
                ShipBNo: null,
                ShipBDt: null,
                Port: null,
                RefClm: null,
                ForCur: null,
                CntCode: null,
                ExpDuty: null
            },
            EwbDtls: {},
            ItemList: itemList
        }
    ];
};

/**
 * Direct print of jsPDF document via hidden iframe without downloading
 */
export const printPDFDocument = (doc) => {
    try {
        doc.autoPrint();
        const blob = doc.output('blob');
        const blobUrl = URL.createObjectURL(blob);

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.src = blobUrl;

        let printed = false;
        const triggerPrint = () => {
            if (printed) return;
            printed = true;
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (err) {
                console.error("Iframe direct print failed, falling back to window.open", err);
                const win = window.open(blobUrl, '_blank');
                if (win) win.focus();
            }
        };

        iframe.onload = () => {
            setTimeout(triggerPrint, 300);
        };

        document.body.appendChild(iframe);

        // Fallback in case onload is not triggered for PDF blob
        setTimeout(() => {
            if (!printed) {
                triggerPrint();
            }
        }, 800);

        // Revoke and remove after 60s
        setTimeout(() => {
            try {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
                URL.revokeObjectURL(blobUrl);
            } catch (e) {}
        }, 60000);
    } catch (e) {
        console.error("Error initiating direct PDF print:", e);
    }
};
