const sequelize = require('../config/database');
const { Account } = require('../models');

async function reapplyAccountCodes() {
  const t = await sequelize.transaction();
  try {
    console.log('Starting account code re-application...');

    // 1. Fetch all accounts ordered by id ASC
    const accounts = await Account.findAll({
      attributes: ['id', 'account_code', 'account_name'],
      order: [['id', 'ASC']],
      transaction: t
    });

    console.log(`Found ${accounts.length} total account records.`);

    // 2. Set all account_codes to NULL temporarily to prevent UNIQUE constraint collisions
    await sequelize.query(
      'UPDATE tbl_Accounts SET account_code = NULL',
      { transaction: t }
    );
    console.log('Reset all existing account codes to NULL.');

    // 3. Assign sequential codes 1..N
    for (let i = 0; i < accounts.length; i++) {
      const newCode = (i + 1).toString();
      const accountId = accounts[i].id;
      await sequelize.query(
        'UPDATE tbl_Accounts SET account_code = :code WHERE id = :id',
        {
          replacements: { code: newCode, id: accountId },
          transaction: t
        }
      );
    }

    await t.commit();
    console.log(`Successfully re-applied account codes from 1 to ${accounts.length}.`);

    // Verify results
    const updatedAccounts = await Account.findAll({
      attributes: ['id', 'account_code', 'account_name'],
      order: [['id', 'ASC']]
    });

    console.log('\n--- Verification (First 5 accounts) ---');
    console.log(updatedAccounts.slice(0, 5).map(a => ({ id: a.id, code: a.account_code, name: a.account_name })));

    console.log('\n--- Verification (Last 5 accounts) ---');
    console.log(updatedAccounts.slice(-5).map(a => ({ id: a.id, code: a.account_code, name: a.account_name })));

    const anyMissing = updatedAccounts.filter(a => !a.account_code);
    console.log(`\nAccounts without code: ${anyMissing.length}`);

    process.exit(0);
  } catch (error) {
    await t.rollback();
    console.error('Error re-applying account codes:', error);
    process.exit(1);
  }
}

reapplyAccountCodes();
