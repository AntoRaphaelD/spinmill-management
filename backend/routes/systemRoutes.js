const express = require('express');
const {
  getBackupSetting,
  updateBackupSetting,
  createBackupPayload,
  sendBackupEmail,
  importBackupPayload,
  listBackupRuns,
  listAuditLogs
} = require('../services/backupService');
const { writeAuditLog } = require('../services/auditService');

const router = express.Router();

router.get('/logs', async (req, res) => {
  try {
    const data = await listAuditLogs();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/backups/settings', async (req, res) => {
  try {
    const data = await getBackupSetting();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/backups/settings', async (req, res) => {
  try {
    const data = await updateBackupSetting(req.body);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/backups/runs', async (req, res) => {
  try {
    const data = await listBackupRuns();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/backups/download', async (req, res) => {
  try {
    const backup = await createBackupPayload();
    const fileName = `kayaar-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/backups/send-now', async (req, res) => {
  try {
    const data = await sendBackupEmail({
      recipient_email: req.body.recipient_email,
      type: 'MANUAL'
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/backups/import', async (req, res) => {
  try {
    const payload = req.body.backup || req.body;
    const data = await importBackupPayload(payload);
    await writeAuditLog(req, {
      action: 'IMPORT_BACKUP',
      entity: 'backups',
      status: 'SUCCESS',
      status_code: 200,
      details: data
    });
    res.json({ success: true, data });
  } catch (error) {
    await writeAuditLog(req, {
      action: 'IMPORT_BACKUP',
      entity: 'backups',
      status: 'FAILED',
      status_code: 400,
      error_message: error.message
    });
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
