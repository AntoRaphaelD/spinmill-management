    const express = require('express');
    const router = express.Router();
    const ctrl = require('../controllers/masterController');

    /**
     * Validation helper
     */
    const validate = (fn) => {
        if (typeof fn !== 'function') {
            throw new Error(`Route handler is not a function! Check masterController exports.`);
        }
        return fn;
    };

    /**
     * 1. MASTER ROUTES
     */
    const masters = [
        { path: 'accounts', controller: ctrl.account },
        { path: 'brokers', controller: ctrl.broker },
        { path: 'products', controller: ctrl.product },
        { path: 'transports', controller: ctrl.transport },
        { path: 'tariffs', controller: ctrl.tariff },
        { path: 'packing-types', controller: ctrl.packing },
        { path: 'invoice-types', controller: ctrl.invoiceType }
    ];

    masters.forEach(m => {
        router.post(`/${m.path}`, validate(m.controller.create));
        router.get(`/${m.path}`, validate(m.controller.getAll));
        router.get(`/${m.path}/:id`, validate(m.controller.getOne));
        router.put(`/${m.path}/:id`, validate(m.controller.update));
        router.delete(`/${m.path}/:id`, validate(m.controller.delete));
        router.post(`/${m.path}/bulk-delete`, validate(m.controller.bulkDelete));
    });

    /**
     * 2. TRANSACTIONAL ROUTES
     */

    // Orders
    router.post('/orders', validate(ctrl.order.create));
    router.get('/orders', validate(ctrl.order.getAll));
    router.put('/orders/:id', validate(ctrl.order.update));
    router.delete('/orders/:id', validate(ctrl.order.delete));
    router.post('/orders/bulk-delete', validate(ctrl.order.bulkDelete));

    // Production (RG1)
    router.post('/production', validate(ctrl.production.create));
    router.get('/production', validate(ctrl.production.getAll));
    router.get('/production/:id', validate(ctrl.production.getOne));
    router.put('/production/:id', validate(ctrl.production.update));
    router.delete('/production/:id', validate(ctrl.production.delete));
    router.post('/production/bulk-delete', validate(ctrl.production.bulkDelete));

    // Invoices (Sales WITH Order)
    router.post('/invoices', validate(ctrl.invoice.create));
    router.get('/invoices', validate(ctrl.invoice.getAll));
    router.get('/invoices/:id', validate(ctrl.invoice.getOne));
    router.put('/invoices/:id', validate(ctrl.invoice.update));
    router.delete('/invoices/:id', validate(ctrl.invoice.delete));
    router.put('/invoices/approve/:id', validate(ctrl.invoice.approve));
    router.put('/invoices/reject/:id', validate(ctrl.invoice.reject));

    // Direct Invoices (Sales WITHOUT Order)
    router.post('/direct-invoices', validate(ctrl.directInvoice.create));
    router.get('/direct-invoices', validate(ctrl.directInvoice.getAll));
    router.put('/direct-invoices/:id', validate(ctrl.directInvoice.update));
    router.delete('/direct-invoices/:id', validate(ctrl.directInvoice.delete));

    // Despatch Entry
    router.get('/despatch', validate(ctrl.despatch.getAll));
    router.post('/despatch', validate(ctrl.despatch.create));
    router.put('/despatch/:id', validate(ctrl.despatch.update));
    router.delete('/despatch/:id', validate(ctrl.despatch.delete));
    router.post('/despatch/bulk-delete', validate(ctrl.despatch.bulkDelete));

    /**
     * 3. DEPOT SPECIFIC ROUTES
     */

    // Depot Inward Sync (The "Confirm Receipt" logic)
    router.post('/depot-inward', validate(ctrl.depotInward.create));

    // Depot Registry (Listing of inwarded manifests)
    router.get('/depot-received', validate(ctrl.depotReceived.getAll));
    router.post('/depot-received', validate(ctrl.depotReceived.create));
    router.delete('/depot-received/:id', validate(ctrl.depotReceived.delete));
    router.post('/depot-received/bulk-delete', validate(ctrl.depotReceived.bulkDelete));

    // ✅ CRITICAL ADDITION: Depot Live Inventory Calculation
    // This is the route for your "Depot Storage" component
    router.get('/depot-inventory/:depotId', validate(ctrl.getDepotInventory));

    // Depot Sales (Sales made from depot hub)
    router.post('/depot-sales', validate(ctrl.depotSales.create));
    router.get('/depot-sales', validate(ctrl.depotSales.getAll));
    router.get('/depot-sales/:id', validate(ctrl.depotSales.getOne));
    router.put('/depot-sales/:id', validate(ctrl.depotSales.update));
    router.delete('/depot-sales/:id', validate(ctrl.depotSales.delete));
    router.post('/depot-sales/bulk-delete', validate(ctrl.depotSales.bulkDelete));

    /**
     * 4. REPORTING & PRINTING
     */
    router.get('/reports/invoice-print/:invoiceNo', validate(ctrl.reports.getInvoicePrintData));
    router.get('/reports/:reportId', validate(ctrl.reports.getReportData));

    module.exports = router;