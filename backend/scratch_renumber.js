const { sequelize, InvoiceHeader, Account } = require('./models');

const renumberInvoices = async (transaction) => {
    const invoices = await InvoiceHeader.findAll({
        include: [{ model: Account, as: 'Party' }],
        order: [['date', 'ASC'], ['id', 'ASC']],
        transaction
    });

    let normalCounter = 0;
    let dmCounter = 0;
    let diCounter = 0;
    let meCounter = 0;

    let lastWasYarnTesting = false;
    let lastYarnTestingInvoiceNo = '';

    const updates = [];

    for (const inv of invoices) {
        const partyName = String(inv.Party?.account_name || inv.party_name || '').toUpperCase().trim();
        const salesType = String(inv.sales_type || '').toUpperCase().trim();
        let newInvNo = '';
        if (salesType === 'MERCHANT SALES') {
            meCounter++;
            newInvNo = `MEX-${meCounter}`;
        } else if (partyName === 'DEPOT - MUMBAI') {
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
            console.log(`Setting temp name for ID ${u.id}: ${u.oldNo} -> TEMP-${u.id}`);
            await InvoiceHeader.update(
                { invoice_no: `TEMP-${u.id}` },
                { where: { id: u.id }, transaction }
            );
        }
    }

    // Step 2: Update to final correct sequential values
    for (const u of updates) {
        if (u.oldNo !== u.newNo) {
            console.log(`Renumbering ID ${u.id}: ${u.oldNo} -> ${u.newNo}`);
            await InvoiceHeader.update(
                { invoice_no: u.newNo },
                { where: { id: u.id }, transaction }
            );
        }
    }
};

async function run() {
    const t = await sequelize.transaction();
    try {
        await renumberInvoices(t);
        await t.commit();
        console.log("Renumbering complete!");
        process.exit(0);
    } catch (err) {
        await t.rollback();
        console.error("Error during renumbering:", err);
        process.exit(1);
    }
}

run();
