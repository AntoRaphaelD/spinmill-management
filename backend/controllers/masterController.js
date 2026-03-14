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
        'packs', 'total_kgs', 'avg_content', 'rate', 'broker_percentage',
        'qty', 'bag_wt', 'rate_cr', 'rate_imm', 'rate_per_val',
        'opening_credit', 'opening_debit', 'weight_per_bag', 'freight_charges'
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

    return sanitized;
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

// SECOND: Overwrite the .create method with the dynamic formula logic
invoiceCtrl.create = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { Details, invoice_type_id, freight_charges, ...headerData } = req.body;

        const config = await InvoiceType.findByPk(invoice_type_id);
        if (!config) throw new Error("Invoice Type logic not found.");

        let hTotals = {
            assess: 0, charity: 0, igst: 0, sgst: 0, cgst: 0, disc: 0, brok: 0, net: 0
        };

        const processedRows = [];

        for (const item of Details) {
            console.log("---------- ROW INPUT ----------");
            console.log({
                product_id: item.product_id,
                rate: item.rate,
                total_kgs: item.total_kgs,
                packs: item.packs,

                resale: item.resale,
                convert_to_hank: item.convert_to_hank,
                convert_to_cone: item.convert_to_cone,

                vat_per: item.vat_per,
                sgst_per: item.sgst_per,
                cgst_per: item.cgst_per,
                igst_per: item.igst_per,

                discount_percentage: item.discount_percentage,
                other_amt: item.other_amt,
                freight_amt: item.freight_amt
            });
            console.log("-------------------------------");
            const product = await Product.findByPk(item.product_id);

            // 1. BASE H
            const H = (parseFloat(item.rate) || 0) * (parseFloat(item.total_kgs) || 0);

            // 2. ASSESS A = H - Resale + Hank - Cone
            const A = H - parseFloat(item.resale || 0) + parseFloat(item.convert_to_hank || 0) - parseFloat(item.convert_to_cone || 0);

            let ctx = {
                H: H,
                A: A,

                "Total Kgs": num(item.total_kgs),
                Rate: num(item.rate),
                CharityRs: num(product?.charity_rs),

                igstper: num(item.igst_per || config.igst_percentage),
                sgstper: num(item.sgst_per || config.sgst_percentage),
                cgstper: num(item.cgst_per || config.cgst_percentage),

                round_digits: num(config.round_off_digits)  // ✅ IMPORTANT
            };
            console.log("IGST FORMULA:", config.igst_formula);
            console.log("CTX:", ctx);
            // 3. TAXES ON A
            const charity = config.charity_checked ? evaluateFormula(config.charity_formula, ctx) : 0;
            const igst = config.igst_checked ? evaluateFormula(config.igst_formula, ctx) : 0;
            const sgst = config.gst_checked ? (ctx.sgstper * A / 100) : 0;
            const cgst = config.gst_checked ? (ctx.cgstper * A / 100) : 0;

            // 4. DEDUCTIONS ON (A + TAX)
            const postTaxBasis = A + igst + sgst + cgst + charity;
            const discAmt = (parseFloat(item.discount_per || 0) * postTaxBasis / 100);
            const brokAmt = (parseFloat(item.broker_per || 0) * postTaxBasis / 100);

            // 5. ROW FINAL
            const rowFinal = postTaxBasis - discAmt - brokAmt;

            hTotals.assess += A;
            hTotals.charity += charity;
            hTotals.igst += igst;
            hTotals.sgst += sgst;
            hTotals.cgst += cgst;
            hTotals.disc += discAmt;
            hTotals.brok += brokAmt;
            hTotals.net += rowFinal;

            processedRows.push({
                ...sanitizeData(item),
                assessable_value: A,
                charity_amt: charity,
                igst_amt: igst,
                sgst_amt: sgst,
                cgst_amt: cgst,
                discount_amt: discAmt,
                broker_amt: brokAmt,
                final_value: rowFinal
            });
        }

        const header = await InvoiceHeader.create({
            ...sanitizeData(headerData),
            invoice_type_id,
            total_assessable: hTotals.assess,
            total_charity: hTotals.charity,
            total_igst: hTotals.igst,
            total_sgst: hTotals.sgst,
            total_cgst: hTotals.cgst,
            total_discount: hTotals.disc,
            total_broker: hTotals.brok,
            freight_charges: parseFloat(freight_charges || 0),
            net_amount: Math.round(hTotals.net + parseFloat(freight_charges || 0))
        }, { transaction: t });

        for (const row of processedRows) {
            await InvoiceDetail.create({ ...row, invoice_id: header.id }, { transaction: t });
            await Product.decrement('mill_stock', { by: row.total_kgs, where: { id: row.product_id }, transaction: t });
        }

        await t.commit();
        res.status(201).json({ success: true, data: header });
    } catch (err) {
        if (t) await t.rollback();
        res.status(500).json({ success: false, error: err.message });
    }
};
// Add these to make sure approve/reject are not undefined
invoiceCtrl.approve = async (req, res) => {
    try {
        await InvoiceHeader.update({ is_approved: true }, { where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

invoiceCtrl.reject = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const details = await InvoiceDetail.findAll({ where: { invoice_id: req.params.id } });
        for (const item of details) {
            await Product.increment('mill_stock', { by: item.total_kgs, where: { id: item.product_id }, transaction: t });
        }
        await InvoiceHeader.destroy({ where: { id: req.params.id }, transaction: t });
        await t.commit();
        res.json({ success: true });
    } catch (err) { if (t) await t.rollback(); res.status(500).json({ error: err.message }); }
};
// --- 3. RG1 PRODUCTION LOGIC ---
const productionCtrl = createMasterController(RG1Production, [{ model: Product }, { model: PackingType }]);

productionCtrl.create = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { date, product_id, packing_type_id, weight_per_bag, prev_closing_kgs, production_kgs } = req.body;

        const invSum = await InvoiceDetail.sum('total_kgs', {
            include: [{ model: InvoiceHeader, where: { date }, attributes: [] }],
            where: { product_id }, transaction: t
        }) || 0;

        const directSum = await DirectInvoiceDetail.sum('qty', {
            include: [{ model: DirectInvoiceHeader, as: 'Header', where: { date }, attributes: [] }],
            where: { product_id }, transaction: t
        }) || 0;

        const total_invoiced = parseFloat(invSum) + parseFloat(directSum);
        const closing_stock = parseFloat(prev_closing_kgs || 0) + parseFloat(production_kgs || 0) - total_invoiced;
        const bag_weight = parseFloat(weight_per_bag || 0);

        const prod = await RG1Production.create({
            date, product_id, packing_type_id, weight_per_bag: bag_weight,
            prev_closing_kgs: parseFloat(prev_closing_kgs || 0),
            production_kgs: parseFloat(production_kgs || 0),
            invoice_kgs: total_invoiced,
            stock_kgs: parseFloat(closing_stock.toFixed(3)),
            stock_bags: bag_weight > 0 ? Math.floor(closing_stock / bag_weight) : 0,
            stock_loose_kgs: bag_weight > 0 ? parseFloat((closing_stock % bag_weight).toFixed(3)) : closing_stock
        }, { transaction: t });

        await Product.update({ mill_stock: parseFloat(closing_stock.toFixed(3)) }, { where: { id: product_id }, transaction: t });

        await t.commit();
        res.status(201).json({ success: true, data: prod });
    } catch (err) { if (t) await t.rollback(); res.status(500).json({ error: err.message }); }
};

// --- 4. DEPOT STORAGE LOGIC ---
const getDepotInventory = async (req, res) => {
    try {

        const { depotId } = req.params;

        const products = await Product.findAll({
            include: [{ model: TariffSubHead }]
        });

        const data = await Promise.all(products.map(async (p) => {

            // inward stock for that depot
            const inward = await DepotReceived.sum('total_kgs', {
                where: {
                    depot_id: depotId,
                    product_id: p.id,
                    type: 'INWARD'
                }
            }) || 0;

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

        const { Details, ...headerData } = req.body;

        // 1️⃣ Create Header
        const header = await DirectInvoiceHeader.create(
            sanitizeData(headerData),
            { transaction: t }
        );

        console.log("DIRECT HEADER ID:", header.id);

        // 2️⃣ Insert Details
        if (Details && Details.length > 0) {
            const detailRows = Details.map(item => ({
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
        const { Details, ...headerData } = req.body;

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
        if (Details && Details.length > 0) {
            const detailRows = Details.map(item => ({
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
    console.log("DEPOT SALES REQUEST BODY");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("=================================");
    const t = await sequelize.transaction();
    try {
        const { Details, invoice_type_id, ...headerData } = req.body;
        // convert numeric header fields
        [
            "total_assessable",
            "total_charity",
            "total_vat",
            "total_cenvat",
            "total_duty",
            "total_cess",
            "total_hr_sec_cess",
            "total_sgst",
            "total_cgst",
            "total_igst",
            "total_tcs",
            "total_discount",
            "total_other",
            "pf_amount",
            "freight",
            "sub_total",
            "round_off",
            "final_invoice_value"
        ].forEach(k => {
            if (headerData[k] !== undefined) {
                headerData[k] = num(headerData[k]);
            }
        });
        const isTransfer = headerData.sales_type === 'DEPOT TRANSFER';

        // 1. Existing Math Logic...
        let hTotals = { assess: 0, charity: 0, vat: 0, gst: 0, igst: 0, disc: 0, net: 0 };
        const processedRows = [];
        const config = invoice_type_id
            ? await InvoiceType.findByPk(invoice_type_id)
            : null;

        console.log("=================================");
        console.log("INVOICE TYPE CONFIG");
        console.log(config ? config.toJSON() : "NO CONFIG FOUND");
        console.log("=================================");

        for (const item of Details) {

            processedRows.push({
                ...sanitizeData(item),

                rate: num(item.rate),   // ✅ ADD THIS

                packs: num(item.packs),
                total_kgs: num(item.total_kgs),

                assessable_value: num(item.assessable_value),

                vat_per: num(item.vat_per),
                vat_amt: num(item.vat_amt),

                sgst_per: num(item.sgst_per),
                sgst_amt: num(item.sgst_amt),

                cgst_per: num(item.cgst_per),
                cgst_amt: num(item.cgst_amt),

                igst_per: num(item.igst_per),
                igst_amt: num(item.igst_amt),

                discount_percentage: num(item.discount_percentage),
                discount_amt: num(item.discount_amt),

                other_amt: num(item.other_amt),
                freight_amt: num(item.freight_amt),

                sub_total: num(item.sub_total),

                final_value: num(item.final_value)
            });

            hTotals.net += num(item.final_value);
        }

        // 2. Create the Header (This deducts from Sender)
        console.log("HEADER TOTALS BEFORE SAVE");
        console.log(hTotals);
        const header = await DepotSalesHeader.create({

            ...sanitizeData(headerData),

            invoice_type_id,
            broker_id: headerData.broker_id,

            total_assessable: num(headerData.total_assessable),
            total_charity: num(headerData.total_charity),
            total_vat: num(headerData.total_vat),
            total_sgst: num(headerData.total_sgst),
            total_cgst: num(headerData.total_cgst),
            total_igst: num(headerData.total_igst),
            total_discount: num(headerData.total_discount),
            total_other: num(headerData.total_other),

            freight: num(headerData.freight),
            sub_total: num(headerData.sub_total),
            round_off: num(headerData.round_off),

            final_invoice_value: num(headerData.final_invoice_value)

        }, { transaction: t });
        // 3. Create Details and HANDLE RECEIVER STOCK
       // 3. Validate Depot Stock (before inserting details)

// STEP 1: Calculate total qty per product in this invoice
const productTotals = {};

for (const row of processedRows) {
    if (!productTotals[row.product_id]) {
        productTotals[row.product_id] = 0;
    }
    productTotals[row.product_id] += num(row.total_kgs);
}

// STEP 2: Check stock for each product
for (const productId in productTotals) {

    const inward = await DepotReceived.sum('total_kgs', {
        where: {
            depot_id: headerData.depot_id,
            product_id: Number(productId),
            type: 'INWARD'
        },
        transaction: t
    }) || 0;

    const outward = await DepotSalesDetail.sum('total_kgs', {
        include: [{
            model: DepotSalesHeader,
            attributes: [],
            required: true,
            where: { depot_id: headerData.depot_id }
        }],
        where: { product_id: Number(productId) },
        transaction: t
    }) || 0;

    const availableStock = inward - outward;

    if (availableStock < productTotals[productId]) {
        throw new Error(
            `Depot stock insufficient. Product ${productId} requires ${productTotals[productId]} kg but only ${availableStock} kg available`
        );
    }
}

// 4. Insert Sales Details and Handle Transfer
for (const row of processedRows) {

    await DepotSalesDetail.create(
        { ...row, depot_sales_id: header.id },
        { transaction: t }
    );

    // If this is a depot transfer, create inward entry for receiver depot
    if (isTransfer) {
        await DepotReceived.create({
            date: headerData.date || new Date(),
            depot_id: headerData.party_id, // receiving depot
            product_id: row.product_id,
            invoice_no: header.invoice_no,
            total_kgs: row.total_kgs,
            type: 'INWARD',
            remarks: `TRANSFERRED FROM DEPOT ID: ${headerData.depot_id}`
        }, { transaction: t });
    }
}
        await t.commit();
        console.log("HEADER SAVED");
        console.log(header.toJSON());
        res.status(201).json({ success: true, data: header });
    } catch (err) {
        if (t) await t.rollback();
        res.status(500).json({ success: false, error: err.message });
    }
};
depotSalesCtrl.update = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { Details, invoice_type_id, ...headerData } = req.body;
        // convert numeric header fields
        [
            "total_assessable",
            "total_charity",
            "total_vat",
            "total_cenvat",
            "total_duty",
            "total_cess",
            "total_hr_sec_cess",
            "total_sgst",
            "total_cgst",
            "total_igst",
            "total_tcs",
            "total_discount",
            "total_other",
            "pf_amount",
            "freight",
            "sub_total",
            "round_off",
            "final_invoice_value"
        ].forEach(k => {
            if (headerData[k] !== undefined) {
                headerData[k] = num(headerData[k]);
            }
        });

        // 1. Delete old details
        await DepotSalesDetail.destroy({ where: { depot_sales_id: id }, transaction: t });

        // 2. Perform same math logic as 'create' (Re-calculate)
        const config = await InvoiceType.findByPk(invoice_type_id);
        let hTotals = { assess: 0, charity: 0, vat: 0, gst: 0, igst: 0, disc: 0, net: 0 };
        const processedRows = [];

        for (const item of Details) {

            const product = await Product.findByPk(item.product_id);
            const H = num(item.rate) * num(item.total_kgs);
            console.log("BASE VALUES");
            console.log({
                rate: item.rate,
                total_kgs: item.total_kgs,
                H
            });
            const A = H - num(item.resale) + num(item.convert_to_hank) - num(item.convert_to_cone);
            console.log("ASSESS VALUE (A)");
            console.log({
                H,
                resale: item.resale,
                convert_to_hank: item.convert_to_hank,
                convert_to_cone: item.convert_to_cone,
                A
            });

            const charity = config.charity_checked ? (num(product?.charity_rs) * num(item.total_kgs)) : 0;
            const vat = config.vat_checked ? (num(item.vat_per) * A / 100) : 0;
            const sgst = config.gst_checked ? (num(item.sgst_per) * A / 100) : 0;
            const cgst = config.gst_checked ? (num(item.cgst_per) * A / 100) : 0;
            const igst = config.igst_checked ? (num(item.igst_per) * A / 100) : 0;

            const basis = A + sgst + cgst + igst + vat + charity + num(item.other_amt) + num(item.freight_amt);
            const discAmt = (num(item.discount_percentage) * basis / 100);
            const rowFinal = basis - discAmt;
            console.log("ROW FINAL VALUE");
            console.log({
                basis,
                discAmt,
                rowFinal
            });

            hTotals.assess += A; hTotals.charity += charity; hTotals.vat += vat;
            hTotals.gst += (sgst + cgst); hTotals.igst += igst; hTotals.disc += discAmt;
            hTotals.net += rowFinal;
            console.log("PROCESSED ROW DATA");
            console.log({
                assessable_value: A,
                charity_amt: charity,
                vat_amt: vat,
                sgst_amt: sgst,
                cgst_amt: cgst,
                igst_amt: igst,
                discount_amt: discAmt,
                final_value: rowFinal
            });
            hTotals.assess += num(item.assessable_value);
            hTotals.charity += num(item.charity_amt);
            hTotals.vat += num(item.vat_amt);
            hTotals.gst += num(item.sgst_amt) + num(item.cgst_amt);
            hTotals.igst += num(item.igst_amt);
            hTotals.disc += num(item.discount_amt);
            hTotals.net += num(item.final_value);
            item.rate = num(item.rate);
            item.total_kgs = num(item.total_kgs);
            item.packs = num(item.packs);

            item.assessable_value = num(item.assessable_value);
            item.charity_amt = num(item.charity_amt);
            item.vat_amt = num(item.vat_amt);
            item.cenvat_amt = num(item.cenvat_amt);
            item.duty_amt = num(item.duty_amt);
            item.cess_amt = num(item.cess_amt);
            item.hcess_amt = num(item.hcess_amt);

            item.sgst_amt = num(item.sgst_amt);
            item.cgst_amt = num(item.cgst_amt);
            item.igst_amt = num(item.igst_amt);

            item.discount_amt = num(item.discount_amt);
            item.other_amt = num(item.other_amt);
            item.freight_amt = num(item.freight_amt);

            item.sub_total = num(item.sub_total);
            item.final_value = num(item.final_value);
            processedRows.push({
                ...sanitizeData(item),

                packs: num(item.packs),       // 🔴 ADD THIS
                total_kgs: num(item.total_kgs),

                avg_content: num(item.avg_content),

                resale: num(item.resale),
                convert_to_hank: num(item.convert_to_hank),
                convert_to_cone: num(item.convert_to_cone),

                assessable_value: num(item.assessable_value),

                charity_amt: num(item.charity_amt),

                vat_per: num(item.vat_per),
                vat_amt: num(item.vat_amt),

                sgst_per: num(item.sgst_per),
                sgst_amt: num(item.sgst_amt),

                cgst_per: num(item.cgst_per),
                cgst_amt: num(item.cgst_amt),

                igst_per: num(item.igst_per),
                igst_amt: num(item.igst_amt),

                discount_percentage: num(item.discount_percentage),
                discount_amt: num(item.discount_amt),

                other_amt: num(item.other_amt),
                freight_amt: num(item.freight_amt),

                sub_total: num(item.sub_total),

                final_value: num(item.final_value)
            });
            console.log("TAX CALCULATION");
            console.log({
                charity,
                vat,
                sgst,
                cgst,
                igst
            });
        }

        // 3. Update Header
        await DepotSalesHeader.update({
            ...sanitizeData(headerData),
            broker_id: headerData.broker_id,
            invoice_type_id,
            total_assessable: hTotals.assess,
            total_charity: hTotals.charity,
            total_vat: hTotals.vat,
            total_sgst: hTotals.gst / 2,
            total_cgst: hTotals.gst / 2,
            total_igst: hTotals.igst,
            total_discount: hTotals.disc,
            final_invoice_value: Math.round(hTotals.net + num(headerData.freight) + num(headerData.pf_amount))
        }, { where: { id }, transaction: t });

        // 4. Bulk insert new details
        await DepotSalesDetail.bulkCreate(processedRows, { transaction: t });

        await t.commit();
        res.json({ success: true });
    } catch (err) {
        if (t) await t.rollback();
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
// --- 5. EXPORTS ---
// --- masterController.js (Bottom of file) ---

module.exports = {
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
                                "no_of_bags"
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