import axios from 'axios';

// 1. BASE URL CONFIGURATION
const BASE_URL = 'http://localhost:5000';

// REST API Instance (Existing)
const api = axios.create({ 
  baseURL: `${BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

const authClient = axios.create({
  baseURL: `${BASE_URL}/auth`,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    authClient.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  delete api.defaults.headers.common.Authorization;
  delete authClient.defaults.headers.common.Authorization;
};

export const authAPI = {
  login: (credentials) => authClient.post('/login', credentials),
  signup: (credentials) => authClient.post('/signup', credentials),
  requestSignupOtp: (data) => authClient.post('/signup/request-otp', data),
  verifySignupOtp: (data) => authClient.post('/signup/verify-otp', data),
  me: () => authClient.get('/me'),
  logout: () => authClient.post('/logout')
};

/**
 * ==========================================
 * 1. MASTER API (REST - Existing)
 * ==========================================
 */
export const mastersAPI = {
  accounts: {
    getAll: (params) => api.get('/accounts', { params }),
    getById: (id) => api.get(`/accounts/${id}`),
    create: (data) => api.post('/accounts', data),
    update: (id, data) => api.put(`/accounts/${id}`, data),
    delete: (id) => api.delete(`/accounts/${id}`),
    bulkDelete: (ids) => api.post('/accounts/bulk-delete', { ids })
  },
  brokers: {
    getAll: () => api.get('/brokers'),
    getById: (id) => api.get(`/brokers/${id}`),
    create: (data) => api.post('/brokers', data),
    update: (id, data) => api.put(`/brokers/${id}`, data),
    delete: (id) => api.delete(`/brokers/${id}`),
    bulkDelete: (ids) => api.post('/brokers/bulk-delete', { ids })
  },
  products: {
    getAll: () => api.get('/products'),
    getById: (id) => api.get(`/products/${id}`),
    create: (data) => api.post('/products', data),
    update: (id, data) => api.put(`/products/${id}`, data),
    delete: (id) => api.delete(`/products/${id}`),
    bulkDelete: (ids) => api.post('/products/bulk-delete', { ids })
  },
  transports: {
    getAll: () => api.get('/transports'),
    getById: (id) => api.get(`/transports/${id}`),
    create: (data) => api.post('/transports', data),
    update: (id, data) => api.put(`/transports/${id}`, data),
    delete: (id) => api.delete(`/transports/${id}`),
    bulkDelete: (ids) => api.post('/transports/bulk-delete', { ids })
  },
  tariffs: {
    getAll: () => api.get('/tariffs'),
    getById: (id) => api.get(`/tariffs/${id}`),
    create: (data) => api.post('/tariffs', data),
    update: (id, data) => api.put(`/tariffs/${id}`, data),
    delete: (id) => api.delete(`/tariffs/${id}`),
    bulkDelete: (ids) => api.post('/tariffs/bulk-delete', { ids })
  },
  packingTypes: {
    getAll: () => api.get('/packing-types'),
    getById: (id) => api.get(`/packing-types/${id}`),
    create: (data) => api.post('/packing-types', data),
    update: (id, data) => api.put(`/packing-types/${id}`, data),
    delete: (id) => api.delete(`/packing-types/${id}`),
    bulkDelete: (ids) => api.post('/packing-types/bulk-delete', { ids })
  },
  invoiceTypes: {
    getAll: () => api.get('/invoice-types'),
    getById: (id) => api.get(`/invoice-types/${id}`),
    create: (data) => api.post('/invoice-types', data),
    update: (id, data) => api.put(`/invoice-types/${id}`, data),
    delete: (id) => api.delete(`/invoice-types/${id}`),
    bulkDelete: (ids) => api.post('/invoice-types/bulk-delete', { ids })
  },
};

/**
 * ==========================================
 * 2. TRANSACTIONAL API (REST - Existing)
 * ==========================================
 */
export const transactionsAPI = {
  // Mill Orders
  orders: {
    getAll: () => api.get('/orders'),
    getById: (id) => api.get(`/orders/${id}`),
    create: (data) => api.post('/orders', data),
    update: (id, data) => api.put(`/orders/${id}`, data),
    delete: (id) => api.delete(`/orders/${id}`),
    bulkDelete: (ids) => api.post('/orders/bulk-delete', { ids })
  },

  // Mill Production (RG1)
  production: {
    getAll: () => api.get('/production'),
    getById: (id) => api.get(`/production/${id}`),
    create: (data) => api.post('/production', data), 
    update: (id, data) => api.put(`/production/${id}`, data),
    delete: (id) => api.delete(`/production/${id}`),
    bulkDelete: (ids) => api.post('/production/bulk-delete', { ids })
  },
  
  // Mill Sales WITH Order
  invoices: {
    getAll: () => api.get('/invoices'),
    create: (data) => api.post('/invoices', data),
    getById: (id) => api.get(`/invoices/${id}`),
    update: (id, data) => api.put(`/invoices/${id}`, data),
    approve: (id) => api.put(`/invoices/approve/${id}`),
    reject: (id) => api.put(`/invoices/reject/${id}`), 
    delete: (id) => api.delete(`/invoices/${id}`)
  },
  
  // Mill Sales WITHOUT Order (Direct Sales)
  directInvoices: {
    getAll: () => api.get('/direct-invoices'),
    getById: (id) => api.get(`/direct-invoices/${id}`),
    create: (data) => api.post('/direct-invoices', data),
    update: (id, data) => api.put(`/direct-invoices/${id}`, data),
    delete: (id) => api.delete(`/direct-invoices/${id}`)
  },

  // Loading & Despatch
  despatch: {
    getAll: () => api.get('/despatch'),
    create: (data) => api.post('/despatch', data),
    update: (id, data) => api.put(`/despatch/${id}`, data),
    delete: (id) => api.delete(`/despatch/${id}`),
    bulkDelete: (ids) => api.post('/despatch/bulk-delete', { ids })
  },

  // --- DEPOT OPERATIONS ---
  depotSales: {
    getAll: () => api.get('/depot-sales'),
    getOne: (id) => api.get(`/depot-sales/${id}`),
    create: (data) => api.post('/depot-sales', data),
    update: (id, data) => api.put(`/depot-sales/${id}`, data),
    delete: (id) => api.delete(`/depot-sales/${id}`),
    bulkDelete: (ids) => api.post('/depot-sales/bulk-delete', { ids })
  },

  depotReceived: {
    getAll: () => api.get('/depot-received'),
    getOne: (id) => api.get(`/depot-received/${id}`),
    create: (data) => api.post('/depot-received', data), 
    update: (id, data) => api.put(`/depot-received/${id}`, data),
    delete: (id) => api.delete(`/depot-received/${id}`),
    bulkDelete: (ids) => api.post('/depot-received/bulk-delete', { ids })
  },

  depotInward: {
    create: (data) => api.post('/depot-inward', data)
  },

  depotStock: {
    getInventory: (depotId) => api.get(`/depot-inventory/${depotId}`),
  }
};

/**
 * ==========================================
 * 3. REPORTING API (REST - Existing)
 * ==========================================
 */
export const reportsAPI = {
    getReportData: (reportId, params) => 
        api.get(`/reports/${reportId}`, { params }),

    getInvoicePrint: (invoiceNo) =>
        api.get(`/reports/invoice-print/${invoiceNo}`)
};

export const systemAPI = {
  logs: () => api.get('/system/logs'),
  getBackupSettings: () => api.get('/system/backups/settings'),
  updateBackupSettings: (data) => api.put('/system/backups/settings', data),
  backupRuns: () => api.get('/system/backups/runs'),
  sendBackupNow: (data = {}) => api.post('/system/backups/send-now', data),
  importBackup: (backup) => api.post('/system/backups/import', { backup }),
  downloadBackup: () => api.get('/system/backups/download', { responseType: 'blob' })
};

export default api;
