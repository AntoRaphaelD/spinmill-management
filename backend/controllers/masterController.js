const {
    sequelize, TariffSubHead, PackingType, Broker, Transport,
    Account, Product, OrderHeader, OrderDetail,
    RG1Production, DespatchEntry, InvoiceHeader,
    InvoiceDetail, DirectInvoiceHeader, DirectInvoiceDetail,
    DepotReceived, InvoiceType,
    DepotSalesHeader, DepotSalesDetail
} = require('../models');
const { Op } = require('sequelize');
const num = (v) => isNaN(parseFloat(v)) ? 0 : parseFloat(v);
const { evaluate } = require("mathjs");

const evaluateFormula = (formula, context) => {

    console.log("\n===============================");
    console.log("FORMULA RECEIVED:", formula);
    console.log("CONTEXT VALUES:", context);

    if (!formula || formula === '-' || formula === '') {
        console.log("⚠️ Empty formula -> returning 0");
        return 0;
    }

    try {

        let processed = formula;

        console.log("STEP 1: Replace variables");

        Object.keys(context).forEach(key => {

            const regex = new RegExp(`\\[${key}\\]`, 'gi');
            const value = context[key] ?? 0;

            console.log(`Replacing [${key}] ->`, value);

            processed = processed.replace(regex, value);
        });

        console.log("After variable replacement:", processed);

        console.log("STEP 2: Remove unknown variables");

        processed = processed.replace(/\[.*?\]/g, '0');

        console.log("After removing unknown variables:", processed);

        console.log("STEP 3: Convert ERP functions");

        processed = processed
            .replace(/Round\(/gi, "round(")
            .replace(/Abs\(/gi, "abs(")
            .replace(/Ceil\(/gi, "ceil(")
            .replace(/Floor\(/gi, "floor(");

        console.log("After function conversion:", processed);

        console.log("STEP 4: Evaluate using mathjs");

        const result = evaluate(processed);

        console.log("MathJS raw result:", result);

        // ⭐ Ensure digits is numeric
        const digits = Number(context.round_digits ?? 0);

        console.log("Rounding digits:", digits);

        const final = (!isFinite(result) || isNaN(result))
            ? 0
            : Number(result.toFixed(digits));

        console.log("Final Rounded Result:", final);
        console.log("===============================\n");

        return final;

    } catch (err) {

        console.error("❌ FORMULA ERROR:", formula);
        console.error(err.message);

        return 0;
    }
};
/**
 * HELPER: Clean data for MySQL
 * Converts empty strings to null for ID/Foreign Key fields
 */
const sanitizeData = (data) => {
    const sanitized = { ...data };

    const idFields = [
        'broker_id', 'party_id', 'depot_id', 'product_id',
        'transport_id', 'packing_type_id', 'tariff_id',
        'invoice_type_id', 'load_id'
    ];

   const numericFields = [
        'packs', 'total_kgs', 'avg_content', 'rate', 'broker_percentage', 'broker_percentage2',
        'qty', 'bag_wt', 'rate_cr', 'rate_imm', 'rate_per_val',
        'opening_credit', 'opening_debit', 'weight_per_bag', 'freight_charges',
        'round_off_digits', // Added
        'gst_percentage',   // Added
        'sgst_percentage',  // Added
        'cgst_percentage',  // Added
        'igst_percentage',  // Added
        'charity_value',    // Added
        'vat_percentage',   // Added
        'duty_percentage',  // Added
        'cess_percentage',  // Added
        'hr_sec_cess_percentage', // Added
        'tcs_percentage',   // Added
        'cst_percentage',   // Added
        'cenvat_percentage',
        'gst_per', 'sgst_per', 'cgst_per', 'igst_per',
        'vat_per', 'cenvat_per', 'duty_per', 'cess_per', 'hcess_per', 'tcs_per', 'other_per',
        'gst_amt', 'sgst_amt', 'cgst_amt', 'igst_amt',
        'vat_amt', 'cenvat_amt', 'duty_amt', 'cess_amt', 'hr_sec_cess_amt', 'tcs_amt',
        'assessable_value', 'charity_per_bale', 'charity_amt', 'other_amt', 'freight_amt',
        'resale', 'convert_to_hank', 'convert_to_cone', 'rounded_off', 'sub_total', 'final_value',
        'total_gst', 'total_sgst', 'total_cgst', 'total_igst',
        'original_no_of_bags', 'original_freight'
    ];

    // 🔵 NEW ADDRESS FIELDS
    const textFields = [
        'addr1','addr2','addr3',
        'del1','del2','del3'
    ];

    idFields.forEach(field => {
        if (sanitized[field] === '' || sanitized[field] === undefined || sanitized[field] === null) {
            sanitized[field] = null;
        }
    });
    const booleanFields = [
        'is_option_ii', 'account_posting', 'assess_checked',
        'gst_checked', 'sgst_checked', 'cgst_checked', 'igst_checked',
        'charity_checked', 'vat_checked', 'duty_checked', 'cess_checked',
        'hr_sec_cess_checked', 'tcs_checked', 'cst_checked', 'cenvat_checked'
    ];


    numericFields.forEach(field => {
        if (sanitized[field] === '' || sanitized[field] === undefined || sanitized[field] === null) {
            sanitized[field] = 0;
        } else {
            sanitized[field] = parseFloat(sanitized[field]);
        }
    });

    // 🔵 Clean address fields
    textFields.forEach(field => {
        if (sanitized[field] === undefined || sanitized[field] === '') {
            sanitized[field] = null;
        }
    });
    booleanFields.forEach(field => {
        if (sanitized[field] === undefined || sanitized[field] === '' || sanitized[field] === null) {
            sanitized[field] = false; // Ensure it's never an empty string
        } else {
            sanitized[field] = !!sanitized[field]; // Convert to true/false
        }
    });

    return sanitized;
};

const sanitizeInvoiceDetailData = (data = {}) => {
    const sanitized = sanitizeData(data);
    const excludedFields = new Set(['id', 'invoice_id', 'createdAt', 'updatedAt']);

    return Object.keys(InvoiceDetail.rawAttributes).reduce((clean, field) => {
        if (!excludedFields.has(field) && sanitized[field] !== undefined) {
            clean[field] = sanitized[field];
        }
        return clean;
    }, {});
};
// --- 1. GENERIC MASTER FACTORY ---
const createMasterController = (Model, includeModels = []) => ({
    create: async (req, res) => {
        try {
            const data = await Model.create(sanitizeData(req.body));
            res.status(201).json({ success: true, data });
        } catch (err) { res.status(500).json({ success: false, error: err.message }); }
    },
    getAll: async (req, res) => {
        try {
            const data = await Model.findAll({ include: includeModels });
            res.json({ success: true, data });
        } catch (err) { res.status(500).json({ error: err.message }); }
    },
    getOne: async (req, res) => {
        try {
            const data = await Model.findByPk(req.params.id, { include: includeModels });
            if (!data) return res.status(404).json({ success: false, message: "Not found" });
            res.status(200).json({ success: true, data });
        } catch (err) { res.status(500).json({ success: false, error: err.message }); }
    },
    update: async (req, res) => {
        try {
            await Model.update(sanitizeData(req.body), { where: { id: req.params.id } });
            res.status(200).json({ success: true });
        } catch (err) { res.status(500).json({ success: false, error: err.message }); }
    },
    delete: async (req, res) => {
        try {
            await Model.destroy({ where: { id: req.params.id } });
            res.status(200).json({ success: true });
        } catch (err) { res.status(500).json({ success: false, error: err.message }); }
    },
    bulkDelete: async (req, res) => {
        try {
            await Model.destroy({ where: { id: { [Op.in]: req.body.ids } } });
            res.status(200).json({ success: true });
        } catch (err) { res.status(500).json({ success: false, error: err.message }); }
    },
    bulkImport: async (req, res) => {
        const t = await sequelize.transaction();
        try {
            const rawItems = req.body.items || req.body || [];
            const items = Array.isArray(rawItems) ? rawItems : [rawItems];
            if (items.length === 0) throw new Error("No records provided to import.");
            const sanitizedItems = items.map(item => sanitizeData(item));
            const created = await Model.bulkCreate(sanitizedItems, { transaction: t });
            await t.commit();
            res.json({ success: true, count: created.length, message: `Successfully imported ${created.length} records.` });
        } catch (err) {
            if (t) await t.rollback();
            console.error("Master bulk import error:", err);
            res.status(500).json({ success: false, error: err.message });
        }
    }
});

// --- 2. CALCULATED INVOICE LOGIC (Standard Sales) ---
// --- 2. CALCULATED INVOICE LOGIC (Standard Sales) ---

// FIRST: Initialize the base controller so it has getAll, update, delete, etc.
const invoiceCtrl = createMasterController(InvoiceHeader, [
    { model: Account, as: 'Party' },
    { model: Broker, as: 'Broker' },
    { model: Transport },
    { model: InvoiceDetail, include: [{ model: Product }] }
]);

const calculateInvoiceBreakdown = ({ Details = [], config, freight_charges, sales_type }) => {
    const gstPercentage = num(config?.gst_percentage);
    const sgstPercentage = num(config?.sgst_percentage);
    const cgstPercentage = num(config?.cgst_percentage);
    const igstPercentage = num(config?.igst_percentage);
    const charityPercentage = num(config?.charity_value);
    const cenvatPercentage = num(config?.cenvat_percentage);
    const dutyPercentage = num(config?.duty_percentage);
    const cessPercentage = num(config?.cess_percentage);
    const hcessPercentage = num(config?.hr_sec_cess_percentage);
    const tcsPercentage = num(config?.tcs_percentage);
    const isForward = String(config?.round_off_direction || config?.calculation_type || '').trim().toLowerCase() === 'forward';
    const taxPercentage =
        igstPercentage > 0
            ? igstPercentage
            : (gstPercentage > 0 ? gstPercentage : (sgstPercentage + cgstPercentage));

    const totalBags = Details.reduce((sum, r) => sum + num(r.packs), 0);
    const freightPerBag = totalBags > 0 ? num(freight_charges) / totalBags : 0;
    const divisor = 100 + taxPercentage;
    const isGstSale = String(sales_type || '').trim().toUpperCase() === 'GST SALES';

    const totals = {
        assess: 0,
        charity: 0,
        freight: 0,
        gst: 0,
        sgst: 0,
        cgst: 0,
        igst: 0,
        vat: 0,
        cenvat: 0,
        duty: 0,
        cess: 0,
        hcess: 0,
        tcs: 0,
        other: 0,
        net: 0
    };

    const processedRows = Details.map((item) => {
        const packs = num(item.packs);
        const totalKgs = num(item.total_kgs);
        const rateInput = num(item.rate);
        const rowFreight = packs * freightPerBag;
        const productName = String(item.product_description || item.Product?.product_name || '').toLowerCase();
        const is68Product = productName.includes('68');

        const rowVatPer = num(item.vat_per || config?.vat_percentage);
        const rowCenvatPer = num(item.cenvat_per || cenvatPercentage);
        const rowDutyPer = num(item.duty_per || dutyPercentage);
        const rowCessPer = num(item.cess_per || cessPercentage);
        const rowHcessPer = num(item.hcess_per || hcessPercentage);
        const rowTcsPer = num(item.tcs_per || tcsPercentage);

        const charityPerBale = isGstSale
            ? num(item.charity_per_bale || 3)
            : num(item.charity_per_bale || charityPercentage);

        let charity = 0;
        let assessableValue = 0;
        let gstAmount = 0;
        let rowIgst = 0;
        let rowSgst = 0;
        let rowCgst = 0;
        let rowGst = 0;
        let rowVat = 0;
        let rowCenvat = 0;
        let rowDuty = 0;
        let rowCess = 0;
        let rowHcess = 0;
        let rowOtherAmt = 0;
        let totalInvoiceAmount = 0;
        let rowTcs = 0;

        if (isForward) {
            // FORWARD FLOW:
            assessableValue = Math.round(is68Product ? (10 * packs * rateInput) : (totalKgs * rateInput));
            charity = (isGstSale || config?.charity_checked) ? Math.round(totalKgs * charityPerBale) : 0;
            const roundedRowFreight = Math.round(rowFreight);

            gstAmount = Math.round((assessableValue * taxPercentage) / 100);
            rowIgst = igstPercentage > 0 ? Math.round(assessableValue * igstPercentage / 100) : 0;
            rowSgst = igstPercentage > 0 ? 0 : (sgstPercentage > 0 ? Math.round(assessableValue * sgstPercentage / 100) : Math.round(gstAmount / 2));
            rowCgst = igstPercentage > 0 ? 0 : (cgstPercentage > 0 ? Math.round(assessableValue * cgstPercentage / 100) : Math.round(gstAmount / 2));
            rowGst = igstPercentage > 0 ? 0 : (rowSgst + rowCgst);

            rowVat = Math.round((assessableValue * rowVatPer) / 100);
            rowCenvat = Math.round((assessableValue * rowCenvatPer) / 100);
            rowDuty = Math.round((assessableValue * rowDutyPer) / 100);
            rowCess = Math.round((assessableValue * rowCessPer) / 100);
            rowHcess = Math.round((assessableValue * rowHcessPer) / 100);
            rowOtherAmt = Math.round(num(item.other_per) > 0
                ? (assessableValue * num(item.other_per)) / 100
                : num(item.other_amt));

            const totalTax = (igstPercentage > 0 ? rowIgst : (rowSgst + rowCgst)) + rowVat + rowCenvat + rowDuty + rowCess + rowHcess + rowOtherAmt;
            totalInvoiceAmount = assessableValue + totalTax + roundedRowFreight + charity;
            rowTcs = Math.round((totalInvoiceAmount * rowTcsPer) / 100);
        } else {
            // REVERSE FLOW:
            totalInvoiceAmount = Math.round(10 * packs * rateInput);
            charity = isGstSale
                ? Math.round(totalKgs * charityPerBale)
                : Math.round((totalInvoiceAmount * charityPerBale) / 100);
            const roundedRowFreight = Math.round(rowFreight);
            const adjustedAmount = totalInvoiceAmount - roundedRowFreight - charity;
            const baseAmount = divisor > 0 ? (adjustedAmount / divisor) * 100 : adjustedAmount;
            gstAmount = Math.round((baseAmount * taxPercentage) / 100);
            assessableValue = totalInvoiceAmount - roundedRowFreight - charity - gstAmount;
            rowSgst = sgstPercentage > 0 ? Math.round(gstAmount * sgstPercentage / taxPercentage) : Math.round(gstAmount / 2);
            rowCgst = cgstPercentage > 0 ? Math.round(gstAmount * cgstPercentage / taxPercentage) : Math.round(gstAmount / 2);
            rowIgst = igstPercentage > 0 ? gstAmount : 0;
            rowGst = igstPercentage > 0 ? 0 : (rowSgst + rowCgst);
            rowOtherAmt = Math.round(num(item.other_per) > 0
                ? (assessableValue * num(item.other_per)) / 100
                : num(item.other_amt));
            rowVat = Math.round((assessableValue * rowVatPer) / 100);
            rowCenvat = Math.round((assessableValue * rowCenvatPer) / 100);
            rowDuty = Math.round((assessableValue * rowDutyPer) / 100);
            rowCess = Math.round((assessableValue * rowCessPer) / 100);
            rowHcess = Math.round((assessableValue * rowHcessPer) / 100);
            rowTcs = Math.round((totalInvoiceAmount * rowTcsPer) / 100);
        }

        const roundedFreight = Math.round(rowFreight);
        totals.assess += assessableValue;
        totals.charity += charity;
        totals.freight += roundedFreight;
        totals.gst += (igstPercentage > 0 ? 0 : (rowSgst + rowCgst));
        totals.sgst += rowSgst;
        totals.cgst += rowCgst;
        totals.igst += rowIgst;
        totals.vat += rowVat;
        totals.cenvat += rowCenvat;
        totals.duty += rowDuty;
        totals.cess += rowCess;
        totals.hcess += rowHcess;
        totals.tcs += rowTcs;
        totals.other += rowOtherAmt;
        totals.net += totalInvoiceAmount;

        return {
            ...sanitizeInvoiceDetailData(item),
            broker_code: item.broker_code || item.broker_code1 || '',
            broker_code1: item.broker_code1 || item.broker_code || '',
            charity_per_bale: charityPerBale,
            charity_amt: charity,
            freight_amt: roundedFreight,
            assessable_value: assessableValue,
            gst_per: gstPercentage,
            gst_amt: rowGst,
            sgst_per: sgstPercentage,
            sgst_amt: rowSgst,
            cgst_per: cgstPercentage,
            cgst_amt: rowCgst,
            igst_per: igstPercentage,
            igst_amt: rowIgst,
            vat_per: rowVatPer,
            vat_amt: rowVat,
            cenvat_per: rowCenvatPer,
            cenvat_amt: rowCenvat,
            duty_per: rowDutyPer,
            duty_amt: rowDuty,
            cess_per: rowCessPer,
            cess_amt: rowCess,
            hcess_per: rowHcessPer,
            hr_sec_cess_amt: rowHcess,
            tcs_per: rowTcsPer,
            tcs_amt: rowTcs,
            other_amt: rowOtherAmt,
            final_value: totalInvoiceAmount
        };
    });

    return { processedRows, totals };
};

const renumberInvoices = async (transaction) => {
    const invoices = await InvoiceHeader.findAll({
        include: [{ model: Account, as: 'Party' }],
        order: [['date', 'ASC'], ['id', 'ASC']],
        transaction
    });

    let normalCounter = 0;
    let dmCounter = 0;
    let diCounter = 0;

    let lastWasYarnTesting = false;
    let lastYarnTestingInvoiceNo = '';

    const updates = [];

    for (const inv of invoices) {
        const partyName = String(inv.Party?.account_name || inv.party_name || '').toUpperCase().trim();
        let newInvNo = '';
        if (partyName === 'DEPOT - MUMBAI') {
            dmCounter++;
            newInvNo = `DM-${dmCounter}`;
        } else if (partyName.includes('KAYAAR EXPORTS PRIVATE LIMITED')) {
            diCounter++;
            newInvNo = `DI-${diCounter}`;
        } else {
            const isYarnTesting = partyName.includes('YARN TESTING');
            if (isYarnTesting && lastWasYarnTesting) {
                newInvNo = lastYarnTestingInvoiceNo;
            } else {
                normalCounter++;
                newInvNo = `${normalCounter}`;
                if (isYarnTesting) {
                    lastYarnTestingInvoiceNo = newInvNo;
                }
            }
            lastWasYarnTesting = isYarnTesting;
        }
        updates.push({ id: inv.id, oldNo: inv.invoice_no, newNo: newInvNo });
    }

    // Step 1: Update to temporary values to prevent unique constraints
    for (const u of updates) {
        if (u.oldNo !== u.newNo) {
            await InvoiceHeader.update(
                { invoice_no: `TEMP-${u.id}` },
                { where: { id: u.id }, transaction }
            );
        }
    }

    // Step 2: Update to final correct sequential values
    for (const u of updates) {
        if (u.oldNo !== u.newNo) {
            await InvoiceHeader.update(
                { invoice_no: u.newNo },
                { where: { id: u.id }, transaction }
            );
        }
    }
};

const renumberDepotInvoices = async (transaction) => {
    const invoices = await DepotSalesHeader.findAll({
        include: [
            { model: Account, as: 'Depot' },
            { model: Account, as: 'Party' }
        ],
        order: [['date', 'ASC'], ['id', 'ASC']],
        transaction
    });

    let mumbaiCounter = 0;
    let kayaarCounter = 0;
    let otherCounter = 0;

    const updates = [];

    for (const inv of invoices) {
        const depotName = String(inv.Depot?.account_name || inv.depot_name || '').toUpperCase().trim();
        const partyName = String(inv.Party?.account_name || inv.party_name || '').toUpperCase().trim();

        let newInvNo = '';
        if (depotName.includes('DEPOT - MUMBAI') || depotName.includes('DEPOT MUMBAI') || partyName.includes('DEPOT - MUMBAI') || partyName.includes('DEPOT MUMBAI')) {
            mumbaiCounter++;
            newInvNo = `${mumbaiCounter}`;
        } else if (depotName.includes('KAYAAR EXPORTS') || partyName.includes('KAYAAR EXPORTS')) {
            kayaarCounter++;
            newInvNo = `${kayaarCounter}`;
        } else {
            otherCounter++;
            newInvNo = `${otherCounter}`;
        }
        updates.push({ id: inv.id, oldNo: inv.invoice_no, newNo: newInvNo, sales_type: inv.sales_type });
    }

    // Step 1: Update to temporary values to prevent unique constraints
    for (const u of updates) {
        if (u.oldNo !== u.newNo) {
            await DepotSalesHeader.update(
                { invoice_no: `TEMP-${u.id}` },
                { where: { id: u.id }, transaction }
            );
        }
    }

    // Step 2: Update to final correct sequential values
    for (const u of updates) {
        if (u.oldNo !== u.newNo) {
            await DepotSalesHeader.update(
                { invoice_no: u.newNo },
                { where: { id: u.id }, transaction }
            );

            // Also update any DepotReceived records linked by invoice_no!
            if (u.sales_type === 'DEPOT TRANSFER') {
                await DepotReceived.update(
                    { invoice_no: u.newNo },
                    { where: { invoice_no: u.oldNo }, transaction }
                );
            }
        }
    }
};

const syncRG1ProductionForDateAndProduct = async (date, productId, transaction) => {
    if (!date || !productId) return;

    try {
        const [invRows] = await sequelize.query(`
            SELECT COALESCE(SUM(d.total_kgs), 0) as total_invoice_kgs
            FROM tbl_InvoiceDetails d
            JOIN tbl_InvoiceHeaders h ON d.invoice_id = h.id
            WHERE h.date = :date AND d.product_id = :productId
        `, { replacements: { date, productId }, transaction });

        const [directRows] = await sequelize.query(`
            SELECT COALESCE(SUM(d.qty * d.bag_wt), 0) as total_direct_invoice_kgs
            FROM tbl_DirectInvoiceDetails d
            JOIN tbl_DirectInvoiceHeaders h ON d.direct_invoice_id = h.id
            WHERE h.date = :date AND d.product_id = :productId
            AND h.order_no NOT IN (
                SELECT DISTINCT invd.order_no 
                FROM tbl_InvoiceDetails invd 
                JOIN tbl_InvoiceHeaders invh ON invd.invoice_id = invh.id 
                WHERE invh.date = :date AND invd.order_type = 'WITHOUT_ORDER' AND invd.order_no IS NOT NULL
            )
        `, { replacements: { date, productId }, transaction });

        const totalInvoiceKgs = num(invRows[0]?.total_invoice_kgs) + num(directRows[0]?.total_direct_invoice_kgs);

        const product = await Product.findByPk(productId, { transaction });
        if (!product) return;

        const prevRecord = await RG1Production.findOne({
            where: {
                product_id: productId,
                date: { [Op.lt]: date }
            },
            order: [['date', 'DESC'], ['id', 'DESC']],
            transaction
        });

        const prevClosingKgs = prevRecord ? num(prevRecord.stock_kgs) : num(product.mill_stock);

        let rg1 = await RG1Production.findOne({
            where: { date, product_id: productId },
            transaction
        });

        const defaultPacking = await PackingType.findOne({ transaction });
        const packingTypeId = defaultPacking ? defaultPacking.id : 1;
        const weightPerBag = num(product.weight_per_bag) || 55.0;

        if (rg1) {
            const prodKgs = num(rg1.production_kgs);
            const stockKgs = prevClosingKgs + prodKgs - totalInvoiceKgs;
            const stockBags = weightPerBag > 0 ? Math.floor(stockKgs / weightPerBag) : 0;
            const stockLooseKgs = weightPerBag > 0 ? (stockKgs - (stockBags * weightPerBag)) : 0;

            await rg1.update({
                prev_closing_kgs: prevClosingKgs,
                invoice_kgs: totalInvoiceKgs,
                stock_kgs: stockKgs,
                stock_bags: stockBags,
                stock_loose_kgs: stockLooseKgs
            }, { transaction });
        } else {
            const prodKgs = 0;
            const stockKgs = prevClosingKgs + prodKgs - totalInvoiceKgs;
            const stockBags = weightPerBag > 0 ? Math.floor(stockKgs / weightPerBag) : 0;
            const stockLooseKgs = weightPerBag > 0 ? (stockKgs - (stockBags * weightPerBag)) : 0;

            await RG1Production.create({
                date,
                product_id: productId,
                packing_type_id: packingTypeId,
                weight_per_bag: weightPerBag,
                prev_closing_kgs: prevClosingKgs,
                production_kgs: prodKgs,
                invoice_kgs: totalInvoiceKgs,
                stock_kgs: stockKgs,
                stock_bags: stockBags,
                stock_loose_kgs: stockLooseKgs
            }, { transaction });
        }
    } catch (err) {
        console.error("Error syncing RG1 Production:", err);
    }
};

// SECOND: Overwrite the .create method with the dynamic formula logic
invoiceCtrl.create = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { Details, invoice_type_id, freight_charges, sales_type, ...headerData } = req.body;
        headerData.invoice_no = `TEMP-CREATE-${Date.now()}-${Math.random()}`;
        const config = await InvoiceType.findByPk(invoice_type_id);
        if (!config) throw new Error("Invoice type not found");

        const { processedRows, totals } = calculateInvoiceBreakdown({
            Details,
            config,
            freight_charges,
            sales_type
        });

        const header = await InvoiceHeader.create({
            ...sanitizeData(headerData),
            sales_type,
            invoice_type_id,
            total_assessable: totals.assess,
            total_charity: totals.charity,
            freight_charges: freight_charges,
            total_gst: totals.gst,
            total_sgst: totals.sgst,
            total_cgst: totals.cgst,
            total_igst: totals.igst,
            total_vat: totals.vat,
            total_cenvat: totals.cenvat,
            total_duty: totals.duty,
            total_cess: totals.cess,
            total_hr_sec_cess: totals.hcess,
            total_tcs: totals.tcs,
            total_other: totals.other,
            sub_total: Number(totals.net.toFixed(2)),
            round_off: Number((Math.round(totals.net - totals.tcs) - (totals.net - totals.tcs)).toFixed(2)),
            net_amount: Math.round(totals.net - totals.tcs)
        }, { transaction: t });

        for (const row of processedRows) {
            await InvoiceDetail.create({ ...row, invoice_id: header.id }, { transaction: t });
            await Product.decrement('mill_stock', { by: row.total_kgs, where: { id: row.product_id }, transaction: t });
            await syncRG1ProductionForDateAndProduct(header.date, row.product_id, t);
        }

        // --- NEW DESPATCH REDUCTION ---
        if (header.load_id) {
            const despatch = await DespatchEntry.findByPk(header.load_id, { transaction: t });
            if (despatch) {
                const invoice_bags = processedRows.reduce((sum, r) => sum + num(r.packs), 0);
                const freight_per_bag = num(despatch.freight_per_bag) > 0 
                    ? num(despatch.freight_per_bag) 
                    : (num(despatch.no_of_bags) > 0 ? num(despatch.freight) / num(despatch.no_of_bags) : 0);
                const new_bags = num(despatch.no_of_bags) - invoice_bags;
                const new_freight = new_bags * freight_per_bag;
                await despatch.update({
                    no_of_bags: new_bags,
                    freight: new_freight,
                    freight_per_bag: freight_per_bag
                }, { transaction: t });
            }
        }

        await renumberInvoices(t);
        await t.commit();
        res.status(201).json({ success: true, data: header });
    } catch (err) {
        if (t) await t.rollback();
        console.error("INVOICE CREATE ERROR:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

invoiceCtrl.update = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { Details, invoice_type_id, freight_charges, sales_type, ...headerData } = req.body;
        headerData.invoice_no = `TEMP-UPDATE-${id}`;
        const config = await InvoiceType.findByPk(invoice_type_id, { transaction: t });
        if (!config) throw new Error("Invoice type not found");

        const oldInvoice = await InvoiceHeader.findByPk(id, {
            include: [{ model: InvoiceDetail }],
            transaction: t
        });
        if (!oldInvoice) throw new Error("Invoice not found");

        const old_load_id = oldInvoice.load_id;
        const old_invoice_bags = (oldInvoice.InvoiceDetails || []).reduce((sum, r) => sum + num(r.packs), 0);

        const existingDetails = await InvoiceDetail.findAll({
            where: { invoice_id: id },
            transaction: t
        });

        for (const item of existingDetails) {
            await Product.increment('mill_stock', {
                by: num(item.total_kgs),
                where: { id: item.product_id },
                transaction: t
            });
        }

        await InvoiceDetail.destroy({
            where: { invoice_id: id },
            transaction: t
        });

        const { processedRows, totals } = calculateInvoiceBreakdown({
            Details,
            config,
            freight_charges,
            sales_type
        });

        await InvoiceHeader.update({
            ...sanitizeData(headerData),
            sales_type,
            invoice_type_id,
            total_assessable: totals.assess,
            total_charity: totals.charity,
            freight_charges: freight_charges,
            total_gst: totals.gst,
            total_sgst: totals.sgst,
            total_cgst: totals.cgst,
            total_igst: totals.igst,
            total_vat: totals.vat,
            total_cenvat: totals.cenvat,
            total_duty: totals.duty,
            total_cess: totals.cess,
            total_hr_sec_cess: totals.hcess,
            total_tcs: totals.tcs,
            total_other: totals.other,
            sub_total: Number(totals.net.toFixed(2)),
            round_off: Number((Math.round(totals.net - totals.tcs) - (totals.net - totals.tcs)).toFixed(2)),
            net_amount: Math.round(totals.net - totals.tcs)
        }, {
            where: { id },
            transaction: t
        });

        for (const row of processedRows) {
            await InvoiceDetail.create({ ...row, invoice_id: id }, { transaction: t });
            await Product.decrement('mill_stock', {
                by: num(row.total_kgs),
                where: { id: row.product_id },
                transaction: t
            });
            await syncRG1ProductionForDateAndProduct(oldInvoice.date, row.product_id, t);
            if (headerData.date && headerData.date !== oldInvoice.date) {
                await syncRG1ProductionForDateAndProduct(headerData.date, row.product_id, t);
            }
        }

        // --- NEW DESPATCH REDUCTION/ADJUSTMENT ---
        const new_load_id = sanitizeData(headerData).load_id;
        const new_invoice_bags = processedRows.reduce((sum, r) => sum + num(r.packs), 0);

        if (old_load_id === new_load_id) {
            if (new_load_id) {
                const despatch = await DespatchEntry.findByPk(new_load_id, { transaction: t });
                if (despatch) {
                    const freight_per_bag = num(despatch.freight_per_bag) > 0 
                        ? num(despatch.freight_per_bag) 
                        : (num(despatch.no_of_bags) > 0 ? num(despatch.freight) / num(despatch.no_of_bags) : 0);
                    const change_in_bags = new_invoice_bags - old_invoice_bags;
                    const new_bags = num(despatch.no_of_bags) - change_in_bags;
                    const new_freight = new_bags * freight_per_bag;
                    await despatch.update({
                        no_of_bags: new_bags,
                        freight: new_freight,
                        freight_per_bag: freight_per_bag
                    }, { transaction: t });
                }
            }
        } else {
            // Load changed
            if (old_load_id) {
                const oldDespatch = await DespatchEntry.findByPk(old_load_id, { transaction: t });
                if (oldDespatch) {
                    const freight_per_bag = num(oldDespatch.freight_per_bag) > 0 
                        ? num(oldDespatch.freight_per_bag) 
                        : (num(oldDespatch.no_of_bags) > 0 ? num(oldDespatch.freight) / num(oldDespatch.no_of_bags) : 0);
                    const new_bags = num(oldDespatch.no_of_bags) + old_invoice_bags;
                    const new_freight = new_bags * freight_per_bag;
                    await oldDespatch.update({
                        no_of_bags: new_bags,
                        freight: new_freight,
                        freight_per_bag: freight_per_bag
                    }, { transaction: t });
                }
            }
            if (new_load_id) {
                const newDespatch = await DespatchEntry.findByPk(new_load_id, { transaction: t });
                if (newDespatch) {
                    const freight_per_bag = num(newDespatch.freight_per_bag) > 0 
                        ? num(newDespatch.freight_per_bag) 
                        : (num(newDespatch.no_of_bags) > 0 ? num(newDespatch.freight) / num(newDespatch.no_of_bags) : 0);
                    const new_bags = num(newDespatch.no_of_bags) - new_invoice_bags;
                    const new_freight = new_bags * freight_per_bag;
                    await newDespatch.update({
                        no_of_bags: new_bags,
                        freight: new_freight,
                        freight_per_bag: freight_per_bag
                    }, { transaction: t });
                }
            }
        }

        await renumberInvoices(t);
        await t.commit();
        res.json({ success: true });
    } catch (err) {
        if (t) await t.rollback();
        console.error("INVOICE UPDATE ERROR:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

invoiceCtrl.delete = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const invoice = await InvoiceHeader.findByPk(id, { transaction: t });
        const details = await InvoiceDetail.findAll({ where: { invoice_id: id }, transaction: t });
        for (const item of details) {
            await Product.increment('mill_stock', { by: item.total_kgs, where: { id: item.product_id }, transaction: t });
        }
        if (invoice && invoice.load_id) {
            const despatch = await DespatchEntry.findByPk(invoice.load_id, { transaction: t });
            if (despatch) {
                const invoice_bags = details.reduce((sum, r) => sum + num(r.packs), 0);
                const freight_per_bag = num(despatch.freight_per_bag) > 0 
                    ? num(despatch.freight_per_bag) 
                    : (num(despatch.no_of_bags) > 0 ? num(despatch.freight) / num(despatch.no_of_bags) : 0);
                const new_bags = num(despatch.no_of_bags) + invoice_bags;
                const new_freight = new_bags * freight_per_bag;
                await despatch.update({
                    no_of_bags: new_bags,
                    freight: new_freight,
                    freight_per_bag: freight_per_bag
                }, { transaction: t });
            }
        }
        await InvoiceDetail.destroy({ where: { invoice_id: id }, transaction: t });
        await InvoiceHeader.destroy({ where: { id }, transaction: t });
        for (const item of details) {
            if (invoice) {
                await syncRG1ProductionForDateAndProduct(invoice.date, item.product_id, t);
            }
        }
        await renumberInvoices(t);
        await t.commit();
        res.json({ success: true });
    } catch (err) {
        if (t) await t.rollback();
        res.status(500).json({ success: false, error: err.message });
    }
};

invoiceCtrl.bulkDelete = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { ids } = req.body;
        if (!ids || !ids.length) throw new Error("No IDs provided");

        for (const id of ids) {
            const invoice = await InvoiceHeader.findByPk(id, { transaction: t });
            if (!invoice) continue;

            const details = await InvoiceDetail.findAll({ where: { invoice_id: id }, transaction: t });
            for (const item of details) {
                await Product.increment('mill_stock', { by: item.total_kgs, where: { id: item.product_id }, transaction: t });
            }

            if (invoice.load_id) {
                const despatch = await DespatchEntry.findByPk(invoice.load_id, { transaction: t });
                if (despatch) {
                    const invoice_bags = details.reduce((sum, r) => sum + num(r.packs), 0);
                    const freight_per_bag = num(despatch.freight_per_bag) > 0 
                        ? num(despatch.freight_per_bag) 
                        : (num(despatch.no_of_bags) > 0 ? num(despatch.freight) / num(despatch.no_of_bags) : 0);
                    const new_bags = num(despatch.no_of_bags) + invoice_bags;
                    const new_freight = new_bags * freight_per_bag;
                    await despatch.update({
                        no_of_bags: new_bags,
                        freight: new_freight,
                        freight_per_bag: freight_per_bag
                    }, { transaction: t });
                }
            }

            await InvoiceDetail.destroy({ where: { invoice_id: id }, transaction: t });
            await InvoiceHeader.destroy({ where: { id }, transaction: t });
            for (const item of details) {
                await syncRG1ProductionForDateAndProduct(invoice.date, item.product_id, t);
            }
        }

        await t.commit();
        res.json({ success: true });
    } catch (err) {
        if (t) await t.rollback();
        res.status(500).json({ success: false, error: err.message });
    }
};

invoiceCtrl.approve = async (req, res) => {
    try {
        await InvoiceHeader.update({ is_approved: true }, { where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

invoiceCtrl.reject = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const invoice = await InvoiceHeader.findByPk(id, { transaction: t });
        const details = await InvoiceDetail.findAll({ where: { invoice_id: id }, transaction: t });
        for (const item of details) {
            await Product.increment('mill_stock', { by: item.total_kgs, where: { id: item.product_id }, transaction: t });
        }
        if (invoice && invoice.load_id) {
            const despatch = await DespatchEntry.findByPk(invoice.load_id, { transaction: t });
            if (despatch) {
                const invoice_bags = details.reduce((sum, r) => sum + num(r.packs), 0);
                const freight_per_bag = num(despatch.freight_per_bag) > 0 
                    ? num(despatch.freight_per_bag) 
                    : (num(despatch.no_of_bags) > 0 ? num(despatch.freight) / num(despatch.no_of_bags) : 0);
                const new_bags = num(despatch.no_of_bags) + invoice_bags;
                const new_freight = new_bags * freight_per_bag;
                await despatch.update({
                    no_of_bags: new_bags,
                    freight: new_freight,
                    freight_per_bag: freight_per_bag
                }, { transaction: t });
            }
        }
        await InvoiceDetail.destroy({ where: { invoice_id: id }, transaction: t });
        await InvoiceHeader.destroy({ where: { id }, transaction: t });
        await t.commit();
        res.json({ success: true });
    } catch (err) { if (t) await t.rollback(); res.status(500).json({ error: err.message }); }
};
// --- 3. RG1 PRODUCTION LOGIC ---
const productionCtrl = createMasterController(RG1Production, [{ model: Product }, { model: PackingType }]);

productionCtrl.create = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const toNumber = (value, fallback = 0) => {
            if (value === undefined || value === null || value === '') return fallback;
            const parsed = parseFloat(value);
            return Number.isNaN(parsed) ? fallback : parsed;
        };

        // Sanitize all incoming data from the frontend.
        const data = sanitizeData(req.body);

        // The frontend sends pre-calculated and validated values.
        // The backend's main job is to persist them and update the master stock.
        const {
            product_id,
            stock_kgs,
        } = data;

        if (!product_id) {
            throw new Error("Product ID is required to create a production log.");
        }

        // Create the production log entry with the exact values from the form.
        const prod = await RG1Production.create({
            ...data
        }, { transaction: t });

        // The most critical step: Update the product's master stock (`mill_stock`)
        // with the final closing stock (`stock_kgs`) from this entry.
        await Product.update(
            { mill_stock: toNumber(stock_kgs) },
            { where: { id: product_id }, transaction: t }
        );

        await t.commit();
        res.status(201).json({ success: true, data: prod });
    } catch (err) { if (t) await t.rollback(); res.status(500).json({ error: err.message }); }
};

productionCtrl.update = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const toNumber = (value, fallback = 0) => {
            if (value === undefined || value === null || value === '') return fallback;
            const parsed = parseFloat(value);
            return Number.isNaN(parsed) ? fallback : parsed;
        };

        const data = sanitizeData(req.body);
        const { product_id, stock_kgs } = data;

        await RG1Production.update(data, { where: { id: req.params.id }, transaction: t });

        if (product_id) {
            await Product.update(
                { mill_stock: toNumber(stock_kgs) },
                { where: { id: product_id }, transaction: t }
            );
        }

        await t.commit();
        res.status(200).json({ success: true });
    } catch (err) {
        if (t) await t.rollback();
        res.status(500).json({ success: false, error: err.message });
    }
};

productionCtrl.delete = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const prod = await RG1Production.findByPk(id, { transaction: t });
        if (!prod) {
            return res.status(404).json({ success: false, message: "Production log not found" });
        }

        await RG1Production.destroy({ where: { id }, transaction: t });

        await Product.update(
            { mill_stock: prod.prev_closing_kgs },
            { where: { id: prod.product_id }, transaction: t }
        );

        await t.commit();
        res.status(200).json({ success: true });
    } catch (err) {
        if (t) await t.rollback();
        res.status(500).json({ success: false, error: err.message });
    }
};

productionCtrl.bulkDelete = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { ids } = req.body;
        if (!ids || !ids.length) {
            return res.status(400).json({ success: false, message: "No IDs provided" });
        }

        for (const id of ids) {
            const prod = await RG1Production.findByPk(id, { transaction: t });
            if (prod) {
                await RG1Production.destroy({ where: { id }, transaction: t });
                await Product.update(
                    { mill_stock: prod.prev_closing_kgs },
                    { where: { id: prod.product_id }, transaction: t }
                );
            }
        }

        await t.commit();
        res.status(200).json({ success: true });
    } catch (err) {
        if (t) await t.rollback();
        res.status(500).json({ success: false, error: err.message });
    }
};

productionCtrl.bulkImport = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const rawItems = req.body.items || req.body || [];
        const items = Array.isArray(rawItems) ? rawItems : [rawItems];
        if (items.length === 0) throw new Error("No production records provided to import.");

        let imported = 0;
        for (const item of items) {
            let product = null;
            if (item.product_name) {
                product = await Product.findOne({
                    where: { product_name: { [Op.like]: `%${item.product_name}%` } },
                    transaction: t
                });
            }
            if (!product && item.product_id) {
                product = await Product.findByPk(item.product_id, { transaction: t });
            }
            if (!product) {
                product = await Product.findOne({ transaction: t });
            }

            const productId = product ? product.id : null;

            // Resolve packing type
            let packingType = null;
            if (item.packing_type) {
                packingType = await PackingType.findOne({
                    where: { packing_type: item.packing_type },
                    transaction: t
                });
            }
            if (!packingType && product?.packing_type) {
                packingType = await PackingType.findOne({
                    where: { packing_type: product.packing_type },
                    transaction: t
                });
            }
            if (!packingType) {
                packingType = await PackingType.findOne({ transaction: t });
            }
            const packingTypeId = packingType ? packingType.id : (item.packing_type_id || 1);

            const weightPerBag = num(item.weight_per_bag || product?.pack_nett_wt || 45.36);
            const productionKgs = num(item.production_kgs || item.production || (num(item.total_bags || item.stock_bags) * weightPerBag));
            const prevClosingKgs = num(item.prev_closing_kgs || product?.mill_stock || 0);
            const invoiceKgs = num(item.invoice_kgs || 0);
            const stockKgs = num(item.stock_kgs) || Math.max(0, prevClosingKgs + productionKgs - invoiceKgs);
            const stockBags = num(item.stock_bags) || (weightPerBag > 0 ? Math.floor(stockKgs / weightPerBag) : 0);
            const stockLooseKgs = num(item.stock_loose_kgs) || (weightPerBag > 0 ? (stockKgs % weightPerBag) : 0);

            await RG1Production.create({
                date: item.date || new Date(),
                product_id: productId,
                packing_type_id: packingTypeId,
                weight_per_bag: weightPerBag,
                prev_closing_kgs: prevClosingKgs,
                production_kgs: productionKgs,
                invoice_kgs: invoiceKgs,
                stock_kgs: stockKgs,
                stock_bags: stockBags,
                stock_loose_kgs: stockLooseKgs
            }, { transaction: t });

            if (productId) {
                await Product.update(
                    { mill_stock: stockKgs },
                    { where: { id: productId }, transaction: t }
                );
            }

            imported++;
        }

        await t.commit();
        res.json({ success: true, count: imported, message: `Successfully imported ${imported} production records.` });
    } catch (err) {
        if (t) await t.rollback();
        console.error("Production bulk import error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

// --- 4. DEPOT STORAGE LOGIC ---
const getDepotInventory = async (req, res) => {
    try {

        const { depotId } = req.params;

        const products = await Product.findAll({
            include: [{ model: TariffSubHead }]
        });

        const data = await Promise.all(products.map(async (p) => {

            // inward stock from DepotReceived logs
            const inwardReceived = await DepotReceived.sum('total_kgs', {
                where: {
                    depot_id: depotId,
                    product_id: p.id,
                    type: 'INWARD'
                }
            }) || 0;

            // inward stock from Invoice Preparation (standard invoices billed to this depot)
            const inwardInvoiced = await InvoiceDetail.sum('total_kgs', {
                include: [{
                    model: InvoiceHeader,
                    attributes: [],
                    required: true,
                    where: { party_id: depotId }
                }],
                where: { product_id: p.id }
            }) || 0;

            const inward = inwardReceived + inwardInvoiced;

            // sales from that depot
            const outward = await DepotSalesDetail.sum('total_kgs', {
                include: [{
                    model: DepotSalesHeader,
                    attributes: [],
                    required: true,
                    where: { depot_id: depotId }
                }],
                where: { product_id: p.id }
            }) || 0;

            const stock = inward - outward;

            return {
                ...p.toJSON(),
                depot_stock: stock > 0 ? stock : 0
            };

        }));

        res.json({ success: true, data });

    } catch (err) {
        console.error("DEPOT INVENTORY ERROR:", err);
        res.status(500).json({ error: err.message });
    }
};
// --- masterController.js ---

// Define the Order Controller specifically to handle nested details
const orderCtrl = createMasterController(OrderHeader, [
    { model: OrderDetail, as: 'OrderDetails', include: [{ model: Product }] },
    { model: Account, as: 'Party' },
    { model: Broker, as: 'Broker' }
]);

// OVERRIDE CREATE
orderCtrl.create = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        console.log("ORDER BODY:", req.body);

        const { OrderDetails, ...headerData } = req.body;

        // 1️⃣ Create header FIRST
        const header = await OrderHeader.create(
            sanitizeData(headerData),
            { transaction: t }
        );

        console.log("HEADER CREATED ID:", header.id);

        // 2️⃣ Manually insert details
        if (OrderDetails && OrderDetails.length > 0) {
            const detailRows = OrderDetails.map(item => ({
                ...sanitizeData(item),
                order_id: header.id   // 🔥 FORCE FK
            }));

            console.log("DETAIL ROWS:", detailRows);

            await OrderDetail.bulkCreate(detailRows, { transaction: t });
        }

        await t.commit();
        res.status(201).json({ success: true, data: header });

    } catch (err) {
        await t.rollback();
        console.error("ORDER CREATE ERROR:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};
// OVERRIDE UPDATE
orderCtrl.update = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { OrderDetails, ...headerData } = req.body;

        await OrderHeader.update(
            sanitizeData(headerData),
            { where: { id }, transaction: t }
        );

        await OrderDetail.destroy({
            where: { order_id: id },
            transaction: t
        });

        if (OrderDetails && OrderDetails.length > 0) {
            const detailRows = OrderDetails.map(item => ({
                ...sanitizeData(item),
                order_id: id
            }));

            await OrderDetail.bulkCreate(detailRows, { transaction: t });
        }

        await t.commit();
        res.json({ success: true });

    } catch (err) {
        await t.rollback();
        console.error("ORDER UPDATE ERROR:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

orderCtrl.bulkImport = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const rawItems = req.body.items || req.body || [];
        const items = Array.isArray(rawItems) ? rawItems : [rawItems];
        if (items.length === 0) throw new Error("No orders provided to import.");

        let imported = 0;
        for (const item of items) {
            let party = null;
            if (item.party_name) {
                party = await Account.findOne({ where: { account_name: item.party_name }, transaction: t });
                if (!party) {
                    party = await Account.create({ account_name: item.party_name, account_group: 'DEBTORS - YARN SALES' }, { transaction: t });
                }
            }
            let broker = null;
            if (item.broker_name) {
                broker = await Broker.findOne({ where: { broker_name: item.broker_name }, transaction: t });
            }

            let product = null;
            if (item.product_name) {
                product = await Product.findOne({ where: { product_name: { [Op.like]: `%${item.product_name}%` } }, transaction: t });
                if (!product) {
                    product = await Product.findOne({ transaction: t });
                }
            }

            const header = await OrderHeader.create({
                order_no: item.order_no || `ORD-${Date.now()}-${imported + 1}`,
                date: item.order_date || item.date || new Date(),
                party_id: party ? party.id : sanitizeData(item).party_id,
                broker_id: broker ? broker.id : sanitizeData(item).broker_id,
                delivery_terms: item.delivery_terms || '',
                remarks: item.remarks || '',
                status: item.status || 'PENDING'
            }, { transaction: t });

            const packs = num(item.qty_packs || item.packs || item.qty);
            const bagWt = num(item.bag_wt || item.avg_content || 45.36);
            const totalKgs = num(item.total_kgs) || (packs * bagWt);
            const rate = num(item.rate);

            await OrderDetail.create({
                order_id: header.id,
                product_id: product ? product.id : sanitizeData(item).product_id,
                qty: packs,
                bag_wt: bagWt,
                total_kgs: totalKgs,
                rate_cr: rate,
                packing_type: item.packing_type || 'HDPE BAGS'
            }, { transaction: t });

            imported++;
        }

        await t.commit();
        res.json({ success: true, count: imported, message: `Successfully imported ${imported} sales orders.` });
    } catch (err) {
        if (t) await t.rollback();
        console.error("Order bulk import error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

const directInvoiceCtrl = createMasterController(DirectInvoiceHeader, [
    { model: Account, as: 'Party' },
    {
        model: DirectInvoiceDetail,
        as: 'DirectInvoiceDetails',
        include: [{ model: Product, as: 'Product' }]
    }
]);

// CREATE
directInvoiceCtrl.create = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        console.log("DIRECT BODY:", req.body);

        const { Details, DirectInvoiceDetails, ...headerData } = req.body;
        const detailItems = Array.isArray(Details)
            ? Details
            : (Array.isArray(DirectInvoiceDetails) ? DirectInvoiceDetails : []);

        // 1️⃣ Create Header
        const header = await DirectInvoiceHeader.create(
            sanitizeData(headerData),
            { transaction: t }
        );

        console.log("DIRECT HEADER ID:", header.id);

        // 2️⃣ Insert Details
        if (detailItems.length > 0) {
            const detailRows = detailItems.map(item => ({
                ...sanitizeData(item),
                direct_invoice_id: header.id  // 🔥 VERY IMPORTANT
            }));

            console.log("DIRECT DETAILS:", detailRows);

            await DirectInvoiceDetail.bulkCreate(detailRows, { transaction: t });
        }

        await t.commit();
        res.status(201).json({ success: true, data: header });

    } catch (err) {
        await t.rollback();
        console.error("DIRECT CREATE ERROR:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

// UPDATE
directInvoiceCtrl.update = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { Details, DirectInvoiceDetails, ...headerData } = req.body;
        const detailItems = Array.isArray(Details)
            ? Details
            : (Array.isArray(DirectInvoiceDetails) ? DirectInvoiceDetails : []);

        await DirectInvoiceHeader.update(
            sanitizeData(headerData),
            { where: { id }, transaction: t }
        );

        // delete old rows
        await DirectInvoiceDetail.destroy({
            where: { direct_invoice_id: id },
            transaction: t
        });

        // recreate
        if (detailItems.length > 0) {
            const detailRows = detailItems.map(item => ({
                ...sanitizeData(item),
                direct_invoice_id: id
            }));

            await DirectInvoiceDetail.bulkCreate(detailRows, { transaction: t });
        }

        await t.commit();
        res.json({ success: true });

    } catch (err) {
        await t.rollback();
        console.error("DIRECT UPDATE ERROR:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

directInvoiceCtrl.bulkImport = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const rawItems = req.body.items || req.body || [];
        const items = Array.isArray(rawItems) ? rawItems : [rawItems];
        if (items.length === 0) throw new Error("No direct orders provided to import.");

        let imported = 0;
        for (const item of items) {
            let party = null;
            if (item.party_name) {
                party = await Account.findOne({ where: { account_name: item.party_name }, transaction: t });
                if (!party) {
                    party = await Account.create({ account_name: item.party_name, account_group: 'DEBTORS - YARN SALES' }, { transaction: t });
                }
            }
            let broker = null;
            if (item.broker_name) {
                broker = await Broker.findOne({ where: { broker_name: item.broker_name }, transaction: t });
            }
            let product = null;
            if (item.product_name) {
                product = await Product.findOne({ where: { product_name: { [Op.like]: `%${item.product_name}%` } }, transaction: t });
                if (!product) product = await Product.findOne({ transaction: t });
            }

            const header = await DirectInvoiceHeader.create({
                order_no: item.order_no || `DO-${Date.now()}-${imported + 1}`,
                date: item.order_date || item.date || new Date(),
                party_id: party ? party.id : sanitizeData(item).party_id,
                broker_id: broker ? broker.id : sanitizeData(item).broker_id,
                remarks: item.remarks || '',
                status: item.status || 'PENDING'
            }, { transaction: t });

            const packs = num(item.qty_packs || item.packs || item.qty);
            const bagWt = num(item.bag_wt || item.avg_content || 45.36);
            const totalKgs = num(item.total_kgs) || (packs * bagWt);
            const rate = num(item.rate);

            await DirectInvoiceDetail.create({
                direct_invoice_id: header.id,
                product_id: product ? product.id : sanitizeData(item).product_id,
                qty: packs,
                bag_wt: bagWt,
                total_kgs: totalKgs,
                rate_cr: rate,
                packing_type: item.packing_type || 'HDPE BAGS'
            }, { transaction: t });

            imported++;
        }

        await t.commit();
        res.json({ success: true, count: imported, message: `Successfully imported ${imported} direct orders.` });
    } catch (err) {
        if (t) await t.rollback();
        console.error("Direct order bulk import error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};
// --- DEPOT SALES CONTROLLER OVERRIDE ---
const depotSalesCtrl = createMasterController(DepotSalesHeader, [
    { model: Account, as: 'Party' },
    { model: Account, as: 'Depot' },
    { model: Broker, as: 'Broker' },
    {
        model: DepotSalesDetail,
        as: 'DepotSalesDetails',
        include: [{ model: Product, as: 'Product' }]
    }
]);

// --- DEPOT SALES / TRANSFER CONTROLLER ---
depotSalesCtrl.create = async (req, res) => {
    console.log("=================================");
    console.log("DEPOT SALES CREATE REQUEST BODY");
    console.log("=================================");
    const t = await sequelize.transaction();
    try {
        const { Details, ...headerData } = req.body;
        headerData.invoice_no = `TEMP-CREATE-${Date.now()}-${Math.random()}`;

        // 1. Create Header
        const header = await DepotSalesHeader.create({
            ...sanitizeData(headerData),
        }, { transaction: t });

        // 2. Generate Sales Without Order (tbl_DirectInvoiceHeaders)
        let nextDirectOrderNo = 1;
        const lastDirectOrder = await DirectInvoiceHeader.findOne({
            order: [[sequelize.literal('CAST(order_no AS UNSIGNED)'), 'DESC']],
            transaction: t
        });
        if (lastDirectOrder && !isNaN(parseInt(lastDirectOrder.order_no))) {
            nextDirectOrderNo = parseInt(lastDirectOrder.order_no) + 1;
        }
        const assignedOrderNo = String(nextDirectOrderNo);

        const directHeader = await DirectInvoiceHeader.create({
            order_no: assignedOrderNo,
            date: headerData.date || new Date(),
            party_id: headerData.party_id,
            place: headerData.place || '',
            status: 'OPEN',
            is_cancelled: false,
            final_invoice_value: headerData.final_invoice_value || 0,
            depot_id: headerData.depot_id
        }, { transaction: t });

        // 3. Insert Details
        if (Details && Details.length > 0) {
            const detailRows = Details.map(item => ({
                ...sanitizeData(item),
                order_no: item.order_no || assignedOrderNo,
                order_type: 'WITHOUT_ORDER',
                depot_sales_id: header.id
            }));

            await DepotSalesDetail.bulkCreate(detailRows, { transaction: t });

            for (const row of detailRows) {
                await DirectInvoiceDetail.create({
                    direct_invoice_id: directHeader.id,
                    product_id: row.product_id,
                    qty: row.packs,
                    bag_wt: row.avg_content,
                    total_kgs: row.total_kgs,
                    rate_cr: row.rate,
                    packing_type: row.packing_type || 'HDPE BAGS',
                    packs: row.packs
                }, { transaction: t });
            }
        }

        await renumberDepotInvoices(t);
        await t.commit();
        res.status(201).json({ success: true, data: header });
    } catch (err) {
        if (t) await t.rollback();
        console.error("DEPOT SALES CREATE ERROR:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};
depotSalesCtrl.update = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { Details, ...headerData } = req.body;
        headerData.invoice_no = `TEMP-UPDATE-${id}`;

        // 1. Delete old details
        await DepotSalesDetail.destroy({ where: { depot_sales_id: id }, transaction: t });

        // 2. Update Header
        await DepotSalesHeader.update({
            ...sanitizeData(headerData),
        }, { where: { id }, transaction: t });

        // 3. Bulk insert new details
        if (Details && Details.length > 0) {
            const detailRows = Details.map(item => ({
                ...sanitizeData(item),
                depot_sales_id: id
            }));
            await DepotSalesDetail.bulkCreate(detailRows, { transaction: t });
        }

        await renumberDepotInvoices(t);
        await t.commit();
        res.json({ success: true });
    } catch (err) {
        if (t) await t.rollback();
        console.error("DEPOT SALES UPDATE ERROR:", err);
        res.status(500).json({ error: err.message });
    }
};
depotSalesCtrl.getAll = async (req, res) => {
    console.log("DEBUG: Received request to fetch Depot Sales...");
    try {
        const data = await DepotSalesHeader.findAll({
            include: [
                { model: Account, as: 'Party' },
                { model: Account, as: 'Depot' },
                {
                    model: DepotSalesDetail,
                    as: 'DepotSalesDetails',
                    include: [{ model: Product, as: 'Product' }]
                }
            ]
        });

        console.log(`DEBUG: Successfully fetched ${data.length} records.`);
        res.json({ success: true, data });
    } catch (err) {
        console.error("❌ CRITICAL ERROR in DepotSales.getAll:");
        console.error("Message:", err.message);

        // This will tell us if a column name is wrong
        if (err.name === 'SequelizeDatabaseError') {
            console.error("SQL Error Code:", err.parent.code);
            console.error("Full SQL Query:", err.sql);
        }

        // This will tell us if an association (Party/Depot) is wrong
        if (err.name === 'SequelizeEagerLoadingError') {
            console.error("Association Error: The 'as' alias likely doesn't match the model file.");
        }

        res.status(500).json({
            success: false,
            error: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
};

depotSalesCtrl.delete = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const header = await DepotSalesHeader.findByPk(id, { transaction: t });
        if (header) {
            await DepotSalesDetail.destroy({ where: { depot_sales_id: id }, transaction: t });
            if (header.sales_type === 'DEPOT TRANSFER') {
                await DepotReceived.destroy({ where: { invoice_no: header.invoice_no }, transaction: t });
            }
            await DepotSalesHeader.destroy({ where: { id }, transaction: t });
        }
        await renumberDepotInvoices(t);
        await t.commit();
        res.json({ success: true });
    } catch (err) {
        if (t) await t.rollback();
        res.status(500).json({ success: false, error: err.message });
    }
};

depotSalesCtrl.bulkDelete = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { ids } = req.body;
        if (!ids || !ids.length) throw new Error("No IDs provided");

        for (const id of ids) {
            const header = await DepotSalesHeader.findByPk(id, { transaction: t });
            if (header) {
                await DepotSalesDetail.destroy({ where: { depot_sales_id: id }, transaction: t });
                if (header.sales_type === 'DEPOT TRANSFER') {
                    await DepotReceived.destroy({ where: { invoice_no: header.invoice_no }, transaction: t });
                }
                await DepotSalesHeader.destroy({ where: { id }, transaction: t });
            }
        }
        await renumberDepotInvoices(t);
        await t.commit();
        res.json({ success: true });
    } catch (err) {
        if (t) await t.rollback();
        res.status(500).json({ success: false, error: err.message });
    }
};

const bulkImportSave = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { despatches = [], invoices = [] } = req.body;

        // Determine starting load_no for Despatch Entries (strictly sequential starting from 1)
        let nextLoadNo = 1;
        const lastDespatch = await DespatchEntry.findOne({
            order: [[sequelize.literal('CAST(load_no AS UNSIGNED)'), 'DESC']],
            transaction: t
        });
        if (lastDespatch && !isNaN(parseInt(lastDespatch.load_no))) {
            nextLoadNo = parseInt(lastDespatch.load_no) + 1;
        }

        const despatchMap = new Map();
        
        for (const d of despatches) {
            const assignedLoadNo = String(nextLoadNo++);
            const despatchRecord = await DespatchEntry.create({
                load_no: assignedLoadNo,
                load_date: d.date,
                transport_id: d.transport_id || null,
                vehicle_no: d.vehicle_no || 'TN 34 X 9117',
                lr_no: d.lr_no || '',
                lr_date: d.date,
                delivery: d.delivery || '',
                no_of_bags: d.no_of_bags,
                freight: d.freight,
                original_no_of_bags: d.no_of_bags,
                original_freight: d.freight
            }, { transaction: t });
            
            despatchMap.set(d.key, despatchRecord);
        }

        let invoiceType = await InvoiceType.findOne({ transaction: t });
        if (!invoiceType) {
            invoiceType = await InvoiceType.create({
                name: 'GST 5%',
                sales_type: 'GST SALES',
                gst_percentage: 5,
                sgst_percentage: 2.5,
                cgst_percentage: 2.5,
                igst_percentage: 5,
                charity_value: 0.1,
                tcs_percentage: 0
            }, { transaction: t });
        }

        // Determine starting order_no for Sales With Order (tbl_OrderHeaders) starting from 1
        let nextOrderNo = 1;
        const lastOrder = await OrderHeader.findOne({
            order: [[sequelize.literal('CAST(order_no AS UNSIGNED)'), 'DESC']],
            transaction: t
        });
        if (lastOrder && !isNaN(parseInt(lastOrder.order_no))) {
            nextOrderNo = parseInt(lastOrder.order_no) + 1;
        }

        // Determine starting order_no for Sales Without Order (tbl_DirectInvoiceHeaders) starting from 1
        let nextDirectOrderNo = 1;
        const lastDirectOrder = await DirectInvoiceHeader.findOne({
            order: [[sequelize.literal('CAST(order_no AS UNSIGNED)'), 'DESC']],
            transaction: t
        });
        if (lastDirectOrder && !isNaN(parseInt(lastDirectOrder.order_no))) {
            nextDirectOrderNo = parseInt(lastDirectOrder.order_no) + 1;
        }

        let importedCount = 0;
        const affectedRg1Keys = new Set();

        for (const inv of invoices) {
            const partyName = String(inv.partyName || '').trim();
            const partyNameUpper = partyName.toUpperCase();
            const isDepotMumbai = partyNameUpper === 'DEPOT - MUMBAI' || partyNameUpper.startsWith('DEPOT');
            const isKayaarExports = partyNameUpper.includes('KAYAAR EXPORT');
            const isDirectSales = isDepotMumbai || isKayaarExports;
            const salesType = isDirectSales ? 'DIRECT SALES' : 'GST SALES';

            let account = await Account.findOne({
                where: { account_name: partyName },
                transaction: t
            });
            if (!account) {
                account = await Account.create({
                    account_name: partyName,
                    account_group: 'DEBTORS - YARN SALES',
                    address: inv.address,
                    place: inv.place,
                    gst_no: (inv.cst_gst ? inv.cst_gst.split(',')[0] : '') || ''
                }, { transaction: t });
            }

            const detailsPayload = [];
            let mainProductKey = "";
            for (const r of inv.rows) {
                const prodName = String(r.product_name).trim();
                let product = null;
                if (prodName.includes('68')) {
                    product = await Product.findOne({ where: { product_name: { [Op.like]: '%68%' } }, transaction: t });
                } else if (prodName.includes('61')) {
                    product = await Product.findOne({ where: { product_name: { [Op.like]: '%61%' } }, transaction: t });
                }
                if (!product && prodName) {
                    product = await Product.findOne({ where: { product_name: prodName }, transaction: t });
                }
                if (!product) {
                    product = await Product.findOne({ transaction: t });
                }

                if (!mainProductKey) {
                    mainProductKey = prodName;
                }

                detailsPayload.push({
                    product_id: product ? product.id : null,
                    product_description: prodName,
                    packs: num(r.packs),
                    total_kgs: num(r.total_kgs),
                    rate: num(r.rate),
                    avg_content: num(r.avg_content)
                });
            }

            const matchKey = `${inv.date}_${mainProductKey}`;
            const matchedDespatch = despatchMap.get(matchKey);
            const loadId = matchedDespatch ? matchedDespatch.id : null;

            const { processedRows, totals } = calculateInvoiceBreakdown({
                Details: detailsPayload,
                config: invoiceType,
                freight_charges: inv.rows.reduce((sum, r) => sum + num(r.freight), 0),
                sales_type: salesType
            });

            // Handle DI and DM prefixes according to business logic
            let rawInvNo = String(inv.excelInvNo || '').trim();
            let finalInvoiceNo = rawInvNo;
            if (isDepotMumbai) {
                const stripped = rawInvNo.replace(/^DM-?/i, '');
                finalInvoiceNo = `DM-${stripped}`;
            } else if (isKayaarExports) {
                const stripped = rawInvNo.replace(/^DI-?/i, '');
                finalInvoiceNo = `DI-${stripped}`;
            }

            // Create Sales Without Order vs Sales With Order
            let assignedOrderNo = '';
            let assignedOrderType = '';

            if (isDirectSales) {
                assignedOrderNo = String(nextDirectOrderNo++);
                assignedOrderType = 'WITHOUT_ORDER';

                const directHeader = await DirectInvoiceHeader.create({
                    order_no: assignedOrderNo,
                    date: inv.date,
                    party_id: account.id,
                    place: inv.place || '',
                    vehicle_no: 'TN 34 X 9117',
                    status: 'OPEN',
                    is_cancelled: false,
                    final_invoice_value: Math.round(totals.net - totals.tcs)
                }, { transaction: t });

                for (const r of detailsPayload) {
                    await DirectInvoiceDetail.create({
                        direct_invoice_id: directHeader.id,
                        product_id: r.product_id,
                        qty: r.packs,
                        bag_wt: r.avg_content,
                        total_kgs: r.total_kgs,
                        rate_cr: r.rate,
                        packing_type: 'HDPE BAGS',
                        packs: r.packs
                    }, { transaction: t });
                }
            } else {
                assignedOrderNo = String(nextOrderNo++);
                assignedOrderType = 'WITH_ORDER';

                const orderHeader = await OrderHeader.create({
                    order_no: assignedOrderNo,
                    date: inv.date,
                    party_id: account.id,
                    place: inv.place || '',
                    status: 'OPEN',
                    is_cancelled: false
                }, { transaction: t });

                for (const r of detailsPayload) {
                    await OrderDetail.create({
                        order_id: orderHeader.id,
                        product_id: r.product_id,
                        qty: r.packs,
                        bag_wt: r.avg_content,
                        rate_cr: r.rate,
                        rate_per: 0,
                        packs: r.packs,
                        packing_type: 'HDPE BAGS'
                    }, { transaction: t });
                }
            }

            // Create Invoice Header
            const header = await InvoiceHeader.create({
                invoice_no: finalInvoiceNo,
                date: inv.date,
                sales_type: salesType,
                invoice_type_id: invoiceType.id,
                party_id: account.id,
                load_id: loadId,
                address: inv.address,
                vehicle_no: 'TN 34 X 9117',
                delivery: inv.place || '',
                total_assessable: Number(totals.assess.toFixed(2)),
                total_charity: Number(totals.charity.toFixed(2)),
                freight_charges: Number(totals.freight.toFixed(2)),
                total_gst: Number(totals.gst.toFixed(2)),
                total_sgst: Number(totals.sgst.toFixed(2)),
                total_cgst: Number(totals.cgst.toFixed(2)),
                total_igst: Number(totals.igst.toFixed(2)),
                total_vat: Number(totals.vat.toFixed(2)),
                total_cenvat: Number(totals.cenvat.toFixed(2)),
                total_duty: Number(totals.duty.toFixed(2)),
                total_cess: Number(totals.cess.toFixed(2)),
                total_hr_sec_cess: Number(totals.hcess.toFixed(2)),
                total_tcs: Number(totals.tcs.toFixed(2)),
                total_other: Number(totals.other.toFixed(2)),
                sub_total: Number(totals.net.toFixed(2)),
                round_off: Number((Math.round(totals.net - totals.tcs) - (totals.net - totals.tcs)).toFixed(2)),
                net_amount: Math.round(totals.net - totals.tcs),
                is_approved: true
            }, { transaction: t });

            for (const row of processedRows) {
                await InvoiceDetail.create({
                    ...row,
                    order_no: assignedOrderNo,
                    order_type: assignedOrderType,
                    invoice_id: header.id
                }, { transaction: t });
                await Product.decrement('mill_stock', { by: row.total_kgs, where: { id: row.product_id }, transaction: t });
                affectedRg1Keys.add(`${inv.date}__${row.product_id}`);
            }

            importedCount++;
        }

        for (const key of affectedRg1Keys) {
            const [date, productIdStr] = key.split('__');
            const productId = parseInt(productIdStr);
            if (date && productId) {
                await syncRG1ProductionForDateAndProduct(date, productId, t);
            }
        }

        await t.commit();
        res.json({
            success: true,
            message: `Bulk import completed. Imported: ${importedCount} records`
        });

    } catch (err) {
        if (t) await t.rollback();
        console.error("BULK IMPORT ERROR:", err);
        let errorMessage = err.message;
        if (err.errors && Array.isArray(err.errors)) {
            errorMessage = "Validation Details: " + err.errors.map(e => `${e.path}: ${e.message}`).join(', ');
        }
        res.status(500).json({ success: false, error: errorMessage });
    }
};

const bulkImportDepotSales = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { depot_id, invoices = [] } = req.body;
        if (!depot_id) {
            throw new Error("Please select a Depot.");
        }
        if (!invoices || invoices.length === 0) {
            throw new Error("No invoices to import.");
        }

        const depotAccount = await Account.findByPk(depot_id, { transaction: t });
        if (!depotAccount) {
            throw new Error("Selected Depot not found.");
        }

        let invoiceType = await InvoiceType.findOne({
            where: { sales_type: 'DEPOT SALES' },
            transaction: t
        });
        if (!invoiceType) {
            invoiceType = await InvoiceType.findOne({ transaction: t });
        }
        if (!invoiceType) {
            invoiceType = await InvoiceType.create({
                name: 'GST 5%',
                sales_type: 'DEPOT SALES',
                gst_percentage: 5,
                sgst_percentage: 2.5,
                cgst_percentage: 2.5,
                igst_percentage: 5,
                charity_value: 0.1,
                tcs_percentage: 0
            }, { transaction: t });
        }

        // Determine starting order_no for Sales Without Order (tbl_DirectInvoiceHeaders) starting from 1
        let nextDirectOrderNo = 1;
        const lastDirectOrder = await DirectInvoiceHeader.findOne({
            order: [[sequelize.literal('CAST(order_no AS UNSIGNED)'), 'DESC']],
            transaction: t
        });
        if (lastDirectOrder && !isNaN(parseInt(lastDirectOrder.order_no))) {
            nextDirectOrderNo = parseInt(lastDirectOrder.order_no) + 1;
        }

        let importedCount = 0;

        for (const inv of invoices) {
            const partyName = String(inv.partyName || '').trim();
            if (!partyName) continue;

            let partyAccount = await Account.findOne({
                where: { account_name: partyName },
                transaction: t
            });
            if (!partyAccount) {
                partyAccount = await Account.create({
                    account_name: partyName,
                    account_group: 'DEBTORS - DEPOT - PARTIES',
                    addr1: inv.addr1 || inv.address || null,
                    addr2: inv.addr2 || null,
                    addr3: inv.addr3 || null,
                    place: inv.place || null,
                    tin_no: inv.cst_no || null,
                    gst_no: inv.gst_no || (inv.cst_gst ? inv.cst_gst.split(',')[0] : '') || null
                }, { transaction: t });
            }

            const detailsRows = [];
            const rows = inv.rows && inv.rows.length > 0 ? inv.rows : [inv];

            for (const r of rows) {
                const prodName = String(r.product_name || r.count || '').trim();
                let product = null;
                if (prodName.includes('68')) {
                    product = await Product.findOne({ where: { product_name: { [Op.like]: '%68%' } }, transaction: t });
                } else if (prodName.includes('61')) {
                    product = await Product.findOne({ where: { product_name: { [Op.like]: '%61%' } }, transaction: t });
                }
                if (!product && prodName) {
                    product = await Product.findOne({ where: { product_name: prodName }, transaction: t });
                }
                if (!product) {
                    product = await Product.findOne({ transaction: t });
                }

                const packs = num(r.packs || r.bags);
                const totalKgs = num(r.total_kgs || r.kgs);
                const avgContent = num(r.avg_content) || (packs > 0 && totalKgs > 0 ? totalKgs / packs : 0);
                const assessableValue = num(r.assessable_value || r.assessableValue);
                const charityAmt = num(r.charity_amt || r.charity);
                const subTotal = num(r.sub_total || r.subTotal) || (assessableValue + charityAmt);
                const gstAmt = num(r.gst_amt || r.gst);
                const finalValue = num(r.final_value || r.finalValue || r.invoice_value) || (subTotal + gstAmt);
                const rate = num(r.rate) || (totalKgs > 0 ? assessableValue / totalKgs : 0);

                const gstPct = num(invoiceType.gst_percentage || 5);

                detailsRows.push({
                    product_id: product ? product.id : null,
                    product_description: prodName || (product ? product.product_name : ''),
                    packs,
                    total_kgs: totalKgs,
                    avg_content: avgContent,
                    rate,
                    rate_per: 'KG',
                    assessable_value: assessableValue,
                    charity_amt: charityAmt,
                    sub_total: subTotal,
                    gst_amt: gstAmt,
                    sgst_amt: 0,
                    cgst_amt: 0,
                    igst_amt: 0,
                    gst_per: gstPct,
                    sgst_per: 0,
                    cgst_per: 0,
                    igst_per: 0,
                    final_value: finalValue
                });
            }

            const totalAssessable = detailsRows.reduce((sum, d) => sum + num(d.assessable_value), 0);
            const totalCharity = detailsRows.reduce((sum, d) => sum + num(d.charity_amt), 0);
            const totalGst = detailsRows.reduce((sum, d) => sum + num(d.gst_amt), 0);
            const totalSgst = 0;
            const totalCgst = 0;
            const totalIgst = 0;
            const subTotal = detailsRows.reduce((sum, d) => sum + num(d.sub_total), 0);
            const rawFinal = detailsRows.reduce((sum, d) => sum + num(d.final_value), 0);
            const finalInvoiceValue = Math.round(rawFinal);
            const roundOff = (finalInvoiceValue - rawFinal).toFixed(2);

            // Generate corresponding Sales Without Order (tbl_DirectInvoiceHeaders & tbl_DirectInvoiceDetails)
            const assignedOrderNo = String(nextDirectOrderNo++);
            const directHeader = await DirectInvoiceHeader.create({
                order_no: assignedOrderNo,
                date: inv.date || new Date(),
                party_id: partyAccount.id,
                place: inv.place || '',
                status: 'OPEN',
                is_cancelled: false,
                final_invoice_value: finalInvoiceValue,
                depot_id: depot_id
            }, { transaction: t });

            for (const d of detailsRows) {
                await DirectInvoiceDetail.create({
                    direct_invoice_id: directHeader.id,
                    product_id: d.product_id,
                    qty: d.packs,
                    bag_wt: d.avg_content,
                    total_kgs: d.total_kgs,
                    rate_cr: d.rate,
                    packing_type: 'HDPE BAGS',
                    packs: d.packs
                }, { transaction: t });
            }

            const header = await DepotSalesHeader.create({
                invoice_no: `TEMP-IMPORT-${Date.now()}-${Math.random()}`,
                date: inv.date,
                sales_type: 'DEPOT SALES',
                invoice_type_id: invoiceType.id,
                invoice_type: invoiceType.type_name || invoiceType.name || 'DEPOT SALES',
                depot_id: depot_id,
                party_id: partyAccount.id,
                addr1: inv.addr1 || partyAccount.addr1 || null,
                addr2: inv.addr2 || partyAccount.addr2 || null,
                addr3: inv.addr3 || partyAccount.addr3 || null,
                total_assessable: totalAssessable,
                total_charity: totalCharity,
                total_gst: totalGst,
                total_sgst: totalSgst,
                total_cgst: totalCgst,
                total_igst: totalIgst,
                sub_total: subTotal,
                round_off: roundOff,
                final_invoice_value: finalInvoiceValue
            }, { transaction: t });

            for (const d of detailsRows) {
                await DepotSalesDetail.create({
                    ...d,
                    order_no: assignedOrderNo,
                    order_type: 'WITHOUT_ORDER',
                    depot_sales_id: header.id
                }, { transaction: t });
            }

            importedCount++;
        }

        await renumberDepotInvoices(t);
        await t.commit();

        res.json({
            success: true,
            message: `Bulk import completed successfully. Imported: ${importedCount} records.`
        });
    } catch (err) {
        if (t) await t.rollback();
        console.error("DEPOT SALES BULK IMPORT ERROR:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

// --- 5. EXPORTS ---
// --- masterController.js (Bottom of file) ---

module.exports = {
    bulkImportSave,
    bulkImportDepotSales,
    account: createMasterController(Account),
    broker: createMasterController(Broker),
    transport: createMasterController(Transport),
    tariff: createMasterController(TariffSubHead),
    packing: createMasterController(PackingType),
    product: createMasterController(Product, [{ model: TariffSubHead }]),
    invoiceType: createMasterController(InvoiceType),
    order: orderCtrl,
    production: productionCtrl,
    invoice: invoiceCtrl,
    directInvoice: directInvoiceCtrl,

    // Change the key name here to match what masterRoutes.js expects
    depotSales: depotSalesCtrl,

    depotInward: {
        create: async (req, res) => {
            const t = await sequelize.transaction();
            try {

                const { invoice_no, depot_id } = req.body;

                const header = await InvoiceHeader.findOne({
                    where: { invoice_no },
                    include: [{ model: InvoiceDetail }]
                });

                if (!header) throw new Error("Invoice not found");

                for (const item of header.InvoiceDetails) {

                    await DepotReceived.create({
                        date: new Date(),
                        depot_id,
                        invoice_no,
                        product_id: item.product_id,
                        total_kgs: item.total_kgs,
                        type: 'INWARD'
                    }, { transaction: t });

                }

                await InvoiceHeader.update(
                    { is_depot_inwarded: true, depot_id },
                    { where: { invoice_no }, transaction: t }
                );

                await t.commit();

                res.json({ success: true });

            } catch (err) {

                await t.rollback();
                res.status(500).json({ error: err.message });

            }
        }
    },

    getDepotInventory,
    depotReceived: createMasterController(DepotReceived, [{ model: Account, as: 'Depot' }, { model: Product, as: 'Product' }]),
    despatch: createMasterController(DespatchEntry, [{ model: Transport }]),

    reports: {
        getReportData: async (req, res) => {
            try {

                const { reportId } = req.params;
                const { from, to } = req.query;

                let data = [];

                switch (reportId) {

                    // ================================
                    // SALES WITH ORDER
                    // ================================
                    case "orders":

                        data = await OrderHeader.findAll({
                            where: {
                                date: { [Op.between]: [from, to] }
                            },
                            include: [
                                {
                                    model: Account,
                                    as: "Party",
                                    attributes: ["id", "account_name"]
                                },
                                {
                                    model: Broker,
                                    as: "Broker",
                                    attributes: ["id", "broker_name"]
                                },
                                {
                                    model: OrderDetail,
                                    as: "OrderDetails",
                                    include: [
                                        {
                                            model: Product,
                                            attributes: ["id", "product_name"]
                                        }
                                    ]
                                }
                            ],
                            order: [["date", "DESC"]]
                        });

                        break;



                    // ================================
                    // SALES WITHOUT ORDER
                    // ================================
                    case "direct-invoices":

                        data = await DirectInvoiceHeader.findAll({
                            where: {
                                date: { [Op.between]: [from, to] }
                            },
                            attributes: [
                                "id",
                                "order_no",
                                "date",
                                "final_invoice_value"
                            ],
                            include: [
                                {
                                    model: Account,
                                    as: "Party",
                                    attributes: ["account_name"]
                                },
                                {
                                    model: Broker,
                                    as: "Broker",
                                    attributes: ["broker_name"]
                                },
                                {
                                    model: DirectInvoiceDetail,
                                    as: "DirectInvoiceDetails",
                                    attributes: ["qty", "rate_cr", "rate_imm"],
                                    include: [
                                        {
                                            model: Product,
                                            as: "Product",
                                            attributes: ["product_name"]
                                        }
                                    ]
                                }
                            ],
                            order: [["date", "DESC"]]
                        });

                        break;



                    // ================================
                    // PRODUCTION
                    // ================================
                    case "production":

                        data = await RG1Production.findAll({
                            where: {
                                date: { [Op.between]: [from, to] }
                            },
                            include: [
                                {
                                    model: Product,
                                    attributes: ["product_name"]
                                },
                                {
                                    model: PackingType,
                                    attributes: ["packing_type"]
                                }
                            ],
                            order: [["date", "DESC"]]
                        });

                        break;



                    // ================================
                    // DESPATCH
                    // IMPORTANT: uses load_date
                    // ================================
                    case "despatch":

                        data = await DespatchEntry.findAll({
                            where: {
                                load_date: { [Op.between]: [from, to] }
                            },
                            attributes: [
                                "id",
                                "load_no",
                                "load_date",
                                "vehicle_no",
                                "freight",
                                "no_of_bags",
                                "original_freight",
                                "original_no_of_bags"
                            ],
                            include: [
                                {
                                    model: Transport,
                                    attributes: ["transport_name"]
                                }
                            ],
                            order: [["load_date", "DESC"]]
                        });

                        break;



                    // ================================
                    // INVOICE REGISTER
                    // ================================
                    case "invoices":

                        data = await InvoiceHeader.findAll({
                            where: {
                                date: { [Op.between]: [from, to] }
                            },
                            attributes: [
                                "id",
                                "invoice_no",
                                "date",
                                "net_amount"
                            ],
                            include: [
                                {
                                    model: Account,
                                    as: "Party",
                                    attributes: ["account_name"]
                                },
                                {
                                    model: Transport,
                                    attributes: ["transport_name"]
                                },
                                {
                                    model: InvoiceDetail,
                                    attributes: [
                                        "total_kgs",
                                        "rate",
                                        "final_value"
                                    ],
                                    include: [
                                        {
                                            model: Product,
                                            attributes: ["product_name"]
                                        }
                                    ]
                                }
                            ],
                            order: [["date", "DESC"]]
                        });

                        break;
                    // ================================
                    // DEPOT SALES
                    // ================================
                    case "depot-sales":

                        data = await DepotSalesHeader.findAll({
                            where: {
                                date: { [Op.between]: [from, to] }
                            },
                            attributes: [
                                "id",
                                "invoice_no",
                                "date",
                                "final_invoice_value"
                            ],
                            include: [
                                {
                                    model: Account,
                                    as: "Party",
                                    attributes: ["account_name"]
                                },
                                {
                                    model: Account,
                                    as: "Depot",
                                    attributes: ["account_name"]
                                },
                                {
                                    model: Transport,
                                    attributes: ["transport_name"]
                                },
                                {
                                    model: DepotSalesDetail,
                                    as: "DepotSalesDetails",
                                    attributes: [
                                        "total_kgs",
                                        "rate_per",
                                        "final_value"
                                    ],
                                    include: [
                                        {
                                            model: Product,
                                            as: "Product",
                                            attributes: ["product_name"]
                                        }
                                    ]
                                }
                            ],
                            order: [["date", "DESC"]]
                        });

                        break;



                    // ================================
                    // DEPOT RECEIVED
                    // ================================
                    case "depot-received":

                        data = await DepotReceived.findAll({
                            where: {
                                date: { [Op.between]: [from, to] }
                            },
                            attributes: [
                                "invoice_no",
                                "date",
                                "total_kgs",
                                "total_bags"
                            ],
                            include: [
                                {
                                    model: Account,
                                    as: "Depot",
                                    attributes: ["account_name"]
                                },
                                {
                                    model: Product,
                                    as: "Product",
                                    attributes: ["product_name"]
                                }
                            ],
                            order: [["date", "DESC"]]
                        });

                        break;


                    default:

                        return res.status(400).json({
                            success: false,
                            message: "Invalid report type"
                        });

                }

                res.json({
                    success: true,
                    data
                });

            } catch (err) {

                console.error("REPORT ERROR:", err);

                res.status(500).json({
                    success: false,
                    error: err.message
                });

            }
        },
        getInvoicePrintData: async (req, res) => {
            const data = await InvoiceHeader.findOne({
                where: { invoice_no: req.params.invoiceNo },
                include: [{ model: Account, as: 'Party' }, { model: Transport }, { model: InvoiceDetail, include: [{ model: Product, include: [TariffSubHead] }] }]
            });
            res.json({ success: true, data });
        }
    }
};
