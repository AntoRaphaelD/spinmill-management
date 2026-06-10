const fs = require('fs/promises');
const path = require('path');
const nodemailer = require('nodemailer');
const models = require('../models');

const {
  sequelize,
  AuditLog,
  BackupSetting,
  BackupRun
} = models;

const backupDir = path.join(__dirname, '..', 'backups');
const excludedModels = new Set(['sequelize', 'AuditLog', 'BackupSetting', 'BackupRun']);

const getBackupModels = () => Object.entries(models)
  .filter(([name, model]) => !excludedModels.has(name) && model?.findAll && model?.bulkCreate);

const localDateKey = (date = new Date()) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const getEnvBackupEmail = () =>
  process.env.BACKUP_EMAIL
  || process.env.ADMIN_EMAIL
  || process.env.SMTP_FROM
  || process.env.SMTP_USER
  || null;

const getEnvBackupTime = () => process.env.BACKUP_TIME || '23:00';

const getBackupSetting = async () => {
  const envEmail = getEnvBackupEmail();
  const [setting] = await BackupSetting.findOrCreate({
    where: { id: 1 },
    defaults: {
      backup_time: getEnvBackupTime(),
      recipient_email: envEmail,
      enabled: Boolean(envEmail)
    }
  });

  const shouldHydrateFromEnv = envEmail && !setting.recipient_email;
  const shouldHydrateTimeFromEnv = process.env.BACKUP_TIME && !setting.backup_time;
  if (shouldHydrateFromEnv || shouldHydrateTimeFromEnv) {
    await setting.update({
      recipient_email: shouldHydrateFromEnv ? envEmail : setting.recipient_email,
      backup_time: shouldHydrateTimeFromEnv ? getEnvBackupTime() : setting.backup_time,
      enabled: shouldHydrateFromEnv ? true : setting.enabled
    });
  }

  return setting;
};

const updateBackupSetting = async ({ recipient_email, backup_time, enabled }) => {
  if (backup_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(backup_time)) {
    throw new Error('Backup time must be in HH:mm format.');
  }

  const setting = await getBackupSetting();
  await setting.update({
    recipient_email: recipient_email === undefined ? setting.recipient_email : recipient_email,
    backup_time: backup_time || setting.backup_time,
    enabled: enabled === undefined ? setting.enabled : Boolean(enabled)
  });
  return setting;
};

const createBackupPayload = async () => {
  const tables = {};

  for (const [name, model] of getBackupModels()) {
    const rows = await model.findAll({ raw: true });
    tables[name] = {
      tableName: model.getTableName(),
      rows
    };
  }

  return {
    app: 'Kayaar ERP',
    version: 1,
    createdAt: new Date().toISOString(),
    tables
  };
};

const writeBackupFile = async (payload = null) => {
  await fs.mkdir(backupDir, { recursive: true });
  const backup = payload || await createBackupPayload();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `kayaar-backup-${stamp}.json`;
  const filePath = path.join(backupDir, fileName);
  const data = JSON.stringify(backup, null, 2);
  await fs.writeFile(filePath, data, 'utf8');
  return { backup, fileName, filePath, size: Buffer.byteLength(data) };
};

const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP_HOST, SMTP_USER, and SMTP_PASS must be configured in .env.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 15000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 15000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 30000)
  });
};

const withTimeout = (promise, timeoutMs, message) => {
  let timeout;
  const timer = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout));
};

const sendBackupEmail = async ({ recipient_email, type = 'MANUAL' } = {}) => {
  const requestedRecipient = recipient_email || null;
  const run = await BackupRun.create({ type, recipient_email: requestedRecipient, status: 'RUNNING' });

  try {
    const setting = await getBackupSetting();
    const recipient = requestedRecipient || setting.recipient_email || getEnvBackupEmail();
    if (!recipient) {
      throw new Error('Backup recipient email is not configured. Set it on the System Logs page or add ADMIN_EMAIL/BACKUP_EMAIL in backend/.env, then restart the backend.');
    }

    const backup = await createBackupPayload();
    const fileName = `kayaar-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const fileContent = Buffer.from(JSON.stringify(backup, null, 2), 'utf8');
    const transporter = createTransporter();
    try {
      await withTimeout(
        transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: recipient,
          subject: `Kayaar ERP backup - ${new Date().toLocaleDateString()}`,
          text: 'Attached is the latest Kayaar ERP backup JSON file.',
          attachments: [{ filename: fileName, content: fileContent }]
        }),
        Number(process.env.SMTP_SEND_TIMEOUT || 30000),
        'SMTP send timed out. Check SMTP_HOST, SMTP_PORT, firewall, and app password.'
      );
    } finally {
      transporter.close();
    }

    await run.update({
      recipient_email: recipient,
      status: 'SUCCESS',
      file_name: fileName,
      file_size: fileContent.length,
      sent_at: new Date()
    });

    return run;
  } catch (error) {
    await run.update({ status: 'FAILED', error_message: error.message });
    throw error;
  }
};

const importBackupPayload = async (payload) => {
  if (!payload?.tables || typeof payload.tables !== 'object') {
    throw new Error('Invalid backup file.');
  }

  const modelEntries = getBackupModels();
  const t = await sequelize.transaction();

  try {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction: t });

    for (const [, model] of [...modelEntries].reverse()) {
      await model.destroy({ where: {}, truncate: true, force: true, transaction: t });
    }

    for (const [name, model] of modelEntries) {
      const rows = payload.tables[name]?.rows || [];
      if (rows.length) {
        await model.bulkCreate(rows, { transaction: t, validate: false });
      }
    }

    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction: t });
    await t.commit();

    return {
      importedTables: Object.keys(payload.tables),
      importedRecords: Object.values(payload.tables).reduce((sum, table) => sum + (table.rows?.length || 0), 0)
    };
  } catch (error) {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    await t.rollback();
    throw error;
  }
};

const listBackupRuns = () => BackupRun.findAll({ order: [['createdAt', 'DESC']], limit: 50 });
const listAuditLogs = () => AuditLog.findAll({ order: [['createdAt', 'DESC']], limit: 200 });

const startBackupScheduler = () => {
  const tick = async () => {
    try {
      const setting = await getBackupSetting();
      const recipient = setting.recipient_email || getEnvBackupEmail();
      if (!setting.enabled || !recipient) return;

      const now = new Date();
      const today = localDateKey(now);
      const hhmm = now.toTimeString().slice(0, 5);

      if (hhmm === setting.backup_time && setting.last_sent_date !== today) {
        await sendBackupEmail({ recipient_email: recipient, type: 'SCHEDULED' });
        await setting.update({ last_sent_date: today });
      }
    } catch (error) {
      console.error('Scheduled backup failed:', error.message);
    }
  };

  setTimeout(tick, 5000);
  return setInterval(tick, 60000);
};

module.exports = {
  backupDir,
  getBackupSetting,
  updateBackupSetting,
  createBackupPayload,
  writeBackupFile,
  sendBackupEmail,
  importBackupPayload,
  listBackupRuns,
  listAuditLogs,
  startBackupScheduler
};
