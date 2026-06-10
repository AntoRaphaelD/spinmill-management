import React, { useEffect, useState } from 'react';
import { Activity, Download, Mail, RefreshCw, Save, Upload } from 'lucide-react';
import { systemAPI } from '../service/api';

export default function SystemMaintenance() {
  const [settings, setSettings] = useState({ recipient_email: '', backup_time: '23:00', enabled: false });
  const [logs, setLogs] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsRes, logsRes, runsRes] = await Promise.all([
        systemAPI.getBackupSettings(),
        systemAPI.logs(),
        systemAPI.backupRuns()
      ]);
      setSettings(settingsRes.data.data || settings);
      setLogs(logsRes.data.data || []);
      setRuns(runsRes.data.data || []);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Unable to load system data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveSettings = async () => {
    try {
      await systemAPI.updateBackupSettings(settings);
      setMessage('Backup schedule saved.');
      loadData();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Unable to save settings.');
    }
  };

  const sendNow = async () => {
    try {
      setMessage('Sending backup email...');
      await systemAPI.sendBackupNow({ recipient_email: settings.recipient_email });
      setMessage('Backup email sent.');
      loadData();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Unable to send backup email.');
      loadData();
    }
  };

  const downloadBackup = async () => {
    try {
      const response = await systemAPI.downloadBackup();
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `kayaar-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Unable to download backup.');
    }
  };

  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const confirmed = window.confirm('Importing a backup replaces current ERP data. Continue?');
    if (!confirmed) {
      event.target.value = '';
      return;
    }

    try {
      const backup = JSON.parse(await file.text());
      const response = await systemAPI.importBackup(backup);
      setMessage(`Imported ${response.data.data.importedRecords} records.`);
      loadData();
    } catch (error) {
      setMessage(error.response?.data?.error || error.message || 'Unable to import backup.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">System Maintenance</h2>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Audit logs and daily backup automation</p>
        </div>
        <button onClick={loadData} className="h-10 w-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {message && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">{message}</div>
      )}

      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Mail size={18} className="text-blue-600" />
          <h3 className="font-black uppercase text-sm tracking-widest">Daily Email Backup</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_120px_auto_auto_auto] gap-3 items-end">
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400">Recipient Email</span>
            <input value={settings.recipient_email || ''} onChange={(e) => setSettings({ ...settings, recipient_email: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="accounts@example.com" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400">Time</span>
            <input type="time" value={settings.backup_time || '23:00'} onChange={(e) => setSettings({ ...settings, backup_time: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="flex items-center gap-2 h-10 text-xs font-black uppercase text-slate-600">
            <input type="checkbox" checked={Boolean(settings.enabled)} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
            Enabled
          </label>
          <button onClick={saveSettings} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-xs font-black uppercase flex items-center gap-2">
            <Save size={15} /> Save
          </button>
          <button onClick={sendNow} className="h-10 px-4 rounded-lg bg-blue-600 text-white text-xs font-black uppercase flex items-center gap-2">
            <Mail size={15} /> Send Now
          </button>
          <button onClick={downloadBackup} className="h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-black uppercase flex items-center gap-2">
            <Download size={15} /> Download
          </button>
        </div>
        <label className="mt-4 inline-flex h-10 px-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-black uppercase items-center gap-2 cursor-pointer">
          <Upload size={15} /> Import Backup JSON
          <input type="file" accept="application/json,.json" onChange={importBackup} className="hidden" />
        </label>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Activity size={18} className="text-emerald-600" />
            <h3 className="font-black uppercase text-sm tracking-widest">Recent User Actions</h3>
          </div>
          <div className="overflow-auto max-h-[460px]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-400 uppercase">
                <tr><th className="p-3">Time</th><th className="p-3">User</th><th className="p-3">Action</th><th className="p-3">Path</th><th className="p-3">Status</th></tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-slate-100">
                    <td className="p-3 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="p-3 font-bold">{log.username || '-'}</td>
                    <td className="p-3">{log.action}</td>
                    <td className="p-3 text-slate-500">{log.path}</td>
                    <td className={`p-3 font-black ${log.status === 'SUCCESS' ? 'text-emerald-600' : 'text-red-600'}`}>{log.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-black uppercase text-sm tracking-widest">Backup Runs</h3>
          </div>
          <div className="overflow-auto max-h-[460px]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-400 uppercase">
                <tr><th className="p-3">Time</th><th className="p-3">Type</th><th className="p-3">Recipient</th><th className="p-3">Status</th><th className="p-3">File</th></tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-slate-100">
                    <td className="p-3 whitespace-nowrap">{new Date(run.createdAt).toLocaleString()}</td>
                    <td className="p-3">{run.type}</td>
                    <td className="p-3">{run.recipient_email || '-'}</td>
                    <td className={`p-3 font-black ${run.status === 'SUCCESS' ? 'text-emerald-600' : 'text-red-600'}`}>{run.status}</td>
                    <td className="p-3 text-slate-500">{run.file_name || run.error_message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
