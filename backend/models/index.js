const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * ==========================================
 * 1. MASTER MODELS
 * ==========================================
 */
const TariffSubHead = sequelize.define('TariffSubHead', {
  tariff_code: { type: DataTypes.STRING, unique: 'idx_tariff_code' },
  tariff_name: { type: DataTypes.STRING },
  tariff_no: { type: DataTypes.STRING }, // HSN Code
  product_type: { type: DataTypes.STRING },
  commodity: { type: DataTypes.STRING },
  fibre: { type: DataTypes.STRING },
  yarn_type: { type: DataTypes.STRING }
}, { tableName: 'tbl_TariffSubHeads' });

const PackingType = sequelize.define('PackingType', {
    packing_type: {type: DataTypes.STRING, allowNull: false }
}, { tableName: 'tbl_PackingTypes' });

const Broker = sequelize.define('Broker', {
  broker_code: { type: DataTypes.STRING, unique: true },
  broker_name: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.TEXT },
  commission_pct: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 }
}, { tableName: 'tbl_Brokers' });

const Transport = sequelize.define('Transport', {
  transport_code: { type: DataTypes.STRING, unique: true },
  transport_name: { type: DataTypes.STRING, allowNull: false },
  place: { type: DataTypes.STRING },
  address: { type: DataTypes.TEXT }   // ✅ Added
}, { tableName: 'tbl_Transports' });

const Account = sequelize.define('Account', {
  
  account_code: { 
    type: DataTypes.STRING, 
    unique: true 
  },

  account_group: { 
    type: DataTypes.STRING 
  },

  account_name: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },

  place: { 
    type: DataTypes.STRING 
  },

  address: { 
    type: DataTypes.TEXT 
  },

  pincode: { 
    type: DataTypes.STRING 
  },

  state: { 
    type: DataTypes.STRING 
  },

  delivery_address: { 
    type: DataTypes.TEXT 
  },

  tin_no: { 
    type: DataTypes.STRING 
  },

  cst_no: { 
    type: DataTypes.STRING 
  },

  phone_no: { 
    type: DataTypes.STRING 
  },

  email: { 
    type: DataTypes.STRING 
  },

  fax: { 
    type: DataTypes.STRING 
  },

  website: { 
    type: DataTypes.STRING 
  },

  account_no: { 
    type: DataTypes.STRING 
  },

  contact_person: { 
    type: DataTypes.STRING 
  },

  cell_no: { 
    type: DataTypes.STRING 
  },

  gst_no: { 
    type: DataTypes.STRING 
  },

  opening_credit: { 
    type: DataTypes.DECIMAL(15,2),
    defaultValue: 0
  },

  opening_debit: { 
    type: DataTypes.DECIMAL(15,2),
    defaultValue: 0
  }

}, { 
  tableName: 'tbl_Accounts',
  timestamps: true
});

// module.exports = Account;

// models/Product.js

const Product = sequelize.define('Product', {

  product_code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },

  product_name: {
    type: DataTypes.STRING,
    allowNull: false
  },

  short_description: {
    type: DataTypes.STRING
  },

  commodity: {
    type: DataTypes.STRING
  },

  commodity_code: {
    type: DataTypes.STRING
  },

  fibre: {
    type: DataTypes.STRING
  },

  packing_type: {
    type: DataTypes.STRING
  },

  wt_per_cone: {
    type: DataTypes.DECIMAL(10, 3)
  },

  no_of_cones_per_pack: {
    type: DataTypes.INTEGER
  },

  pack_nett_wt: {
    type: DataTypes.DECIMAL(10, 3)
  },

  tariff_sub_head: {
    type: DataTypes.STRING
  },

  printing_tariff_sub_head_no: {
    type: DataTypes.STRING
  },

  product_type: {
    type: DataTypes.STRING
  },

  spinning_count_name: {
    type: DataTypes.STRING
  },

  converted_factor_40s: {
    type: DataTypes.DECIMAL(10, 3)
  },

  actual_count: {
    type: DataTypes.STRING
  },

  charity_rs: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },

  other_receipt: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },

  roundoff: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  mill_stock: {
    type: DataTypes.DECIMAL(15, 3),
    defaultValue: 0
  }

}, {
  tableName: 'tbl_Products',
  timestamps: true
});

// module.exports = Product;

/**
 * ==========================================
 * 2. TRANSACTION MODELS (SALES WITH ORDER)
 * ==========================================
 */
const OrderHeader = sequelize.define('OrderHeader', {
  order_no: { type: DataTypes.STRING, unique: true },
  date: { type: DataTypes.DATEONLY },
  place: { type: DataTypes.STRING },
  broker_id: { type: DataTypes.INTEGER },
  is_cancelled: { type: DataTypes.BOOLEAN, defaultValue: false },
  status: { type: DataTypes.STRING, defaultValue: 'OPEN' }
}, { tableName: 'tbl_OrderHeaders' });

const OrderDetail = sequelize.define('OrderDetail', {
  product_id: { type: DataTypes.INTEGER },
  qty: { type: DataTypes.DECIMAL(12, 2) },
  bag_wt: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  rate_cr: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  rate_imm: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  rate_per: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  packs: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  packing_type: {
    type: DataTypes.STRING
},
}, { tableName: 'tbl_OrderDetails' });

const InvoiceHeader = sequelize.define('InvoiceHeader', {

  // =============================
  // BASIC INFORMATION
  // =============================

  invoice_no: { 
    type: DataTypes.STRING, 
    unique: true 
  },

  date: { 
    type: DataTypes.DATEONLY 
  },

  sales_type: {                      // CST SALES / GST SALES
    type: DataTypes.STRING
  },

  load_id: { 
    type: DataTypes.INTEGER, 
    allowNull: false 
  },

  invoice_type_id: { 
    type: DataTypes.INTEGER 
  },

  party_id: { 
    type: DataTypes.INTEGER, 
    allowNull: false 
  },
  broker_id: {
  type: DataTypes.INTEGER,
  allowNull: true
},

  transport_id: { 
    type: DataTypes.INTEGER 
  },

  vehicle_no: { 
    type: DataTypes.STRING 
  },

  delivery: { 
    type: DataTypes.STRING 
  },

  address: {                         // Snapshot of party address
    type: DataTypes.TEXT
  },

  credit_days: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },

  interest_percentage: {
    type: DataTypes.DECIMAL(5,2),
    defaultValue: 0
  },

  lr_no: {
    type: DataTypes.STRING
  },

  lr_date: {
    type: DataTypes.DATEONLY
  },

  ebill_no: {
    type: DataTypes.STRING
  },

  removal_time: {
    type: DataTypes.TIME
  },

  prepare_time: {
    type: DataTypes.TIME
  },

  pay_mode: {
    type: DataTypes.STRING
  },

  form_j: {
    type: DataTypes.STRING
  },

  sales_against: {
    type: DataTypes.STRING
  },

  epcg_no: {
    type: DataTypes.STRING
  },

  remarks: { 
    type: DataTypes.TEXT 
  },

  // =============================
  // AGGREGATE TOTALS (RIGHT PANEL)
  // =============================

  total_assessable: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_charity: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_vat: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_cenvat: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_duty: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_cess: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_hr_sec_cess: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_tcs: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_sgst: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_cgst: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_igst: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_other: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  sub_total: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  freight_charges: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  round_off: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  net_amount: {                      // Final Invoice Value
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  // =============================
  // STATUS
  // =============================

  is_approved: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: false 
  }

}, { 
  tableName: 'tbl_InvoiceHeaders',
  timestamps: true
});
const InvoiceDetail = sequelize.define('InvoiceDetail', {

  // =============================
  // RELATION
  // =============================
  invoice_id: { 
    type: DataTypes.INTEGER 
  },

  order_no: { 
    type: DataTypes.STRING 
  },

  order_type: { 
    type: DataTypes.STRING  // WITH_ORDER / WITHOUT_ORDER
  },

  product_id: { 
    type: DataTypes.INTEGER 
  },

  broker_code: {
    type: DataTypes.STRING
  },

  broker_percentage: {
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },

  // =============================
  // BASIC PRODUCT DATA
  // =============================
  product_description: {
    type: DataTypes.STRING
  },

  packs: { 
    type: DataTypes.DECIMAL(10,2), 
    defaultValue: 0 
  },

  packing_type: {
    type: DataTypes.STRING
  },

  total_kgs: { 
    type: DataTypes.DECIMAL(15,3), 
    defaultValue: 0 
  },

  avg_content: {
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },

  rate: { 
    type: DataTypes.DECIMAL(12,2), 
    defaultValue: 0 
  },

  rate_per: {
    type: DataTypes.STRING
  },

  identification_mark: {
    type: DataTypes.STRING
  },
  

  from_no: {
    type: DataTypes.STRING
  },

  to_no: {
    type: DataTypes.STRING
  },

  resale: {
    type: DataTypes.DECIMAL(12,2), 
    defaultValue: 0 
  },

  convert_to_hank: {
    type: DataTypes.DECIMAL(12,2), 
    defaultValue: 0 
  },

  convert_to_cone: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // =============================
  // CALCULATED VALUES
  // =============================
  assessable_value: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  charity_amt: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },

  vat_amt: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  cenvat_amt: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  duty_amt: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  cess_amt: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  hr_sec_cess_amt: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },

  sgst_amt: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  cgst_amt: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  igst_amt: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },

  tcs_amt: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  discount_percentage: { type: DataTypes.DECIMAL(10,2), defaultValue: 0 },
discount_amt: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  other_amt: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },

  freight_amt: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },

  sub_total: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },

  rounded_off: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },

  final_value: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 }

}, { 
  tableName: 'tbl_InvoiceDetails',
  timestamps: true
});
/**
 * ==========================================
 * 3. TRANSACTION MODELS (DIRECT SALES)
 * ==========================================
 */
const DirectInvoiceHeader = sequelize.define('DirectInvoiceHeader', {
  order_no: { type: DataTypes.STRING },
  date: { type: DataTypes.DATEONLY },
  party_id: { type: DataTypes.INTEGER },
  broker_id: { type: DataTypes.INTEGER },
  place: { type: DataTypes.STRING },
  vehicle_no: { type: DataTypes.STRING },
  is_cancelled: { type: DataTypes.BOOLEAN, defaultValue: false },
  status: { type: DataTypes.STRING, defaultValue: 'OPEN' },
  final_invoice_value: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  is_depot_inwarded: { type: DataTypes.BOOLEAN, defaultValue: false },
  depot_id: { type: DataTypes.INTEGER },
}, { tableName: 'tbl_DirectInvoiceHeaders' });

const DirectInvoiceDetail = sequelize.define('DirectInvoiceDetail', {
  product_id: { type: DataTypes.INTEGER },
  qty: { type: DataTypes.DECIMAL(15, 3) },
  bag_wt: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  rate_cr: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  rate_imm: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  rate_per: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  direct_invoice_id: {
   type: DataTypes.INTEGER,
   allowNull: false
},
packing_type: {
    type: DataTypes.STRING
},
  packs: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }
}, { tableName: 'tbl_DirectInvoiceDetails' });


/**
 * ==========================================
 * 4. DEPOT SPECIFIC MODELS
 * ==========================================
 */

// ✅ UPDATED DepotReceived model to match your ALTER TABLE
const DepotReceived = sequelize.define('DepotReceived', {
  date: { type: DataTypes.DATEONLY },
  depot_id: { type: DataTypes.INTEGER }, 
  product_id: { type: DataTypes.INTEGER }, // Added
  invoice_no: { type: DataTypes.STRING }, 
  total_kgs: { type: DataTypes.DECIMAL(15, 3), defaultValue: 0 }, // Added
  total_bags: { type: DataTypes.INTEGER, defaultValue: 0 }, // Added
  type: { type: DataTypes.STRING(20), defaultValue: 'INWARD' }, // Added (OPENING or INWARD)
  remarks: { type: DataTypes.STRING }
}, { tableName: 'tbl_DepotReceived' });

/**
 * ==========================================
 * DEPOT SALES HEADER MODEL
 * ==========================================
 */
const DepotSalesHeader = sequelize.define('DepotSalesHeader', {

  invoice_no: { 
    type: DataTypes.STRING, 
    unique: true 
  },

  date: { 
    type: DataTypes.DATEONLY 
  },

  sales_type: { 
    type: DataTypes.STRING, 
    defaultValue: 'DEPOT SALES' 
  },

  invoice_type_id: { 
    type: DataTypes.INTEGER 
  },

  invoice_type: {
    type: DataTypes.STRING
  },

  depot_id: { 
    type: DataTypes.INTEGER 
  },

  party_id: { 
    type: DataTypes.INTEGER 
  },
  broker_id: { 
  type: DataTypes.INTEGER 
},

  address: { 
    type: DataTypes.TEXT 
  },

  credit_days: { 
    type: DataTypes.INTEGER, 
    defaultValue: 0 
  },

  interest_pct: { 
    type: DataTypes.DECIMAL(5,2), 
    defaultValue: 0 
  },

  transport_id: { 
    type: DataTypes.INTEGER 
  },

  lr_no: { 
    type: DataTypes.STRING 
  },

  lr_date: { 
    type: DataTypes.DATEONLY 
  },

  vehicle_no: { 
    type: DataTypes.STRING 
  },

  removal_time: {
    type: DataTypes.DATE
  },

  agent_name: { 
    type: DataTypes.STRING 
  },

  pay_mode: { 
    type: DataTypes.STRING 
  },

  remarks: { 
    type: DataTypes.TEXT 
  },

  country: {
    type: DataTypes.STRING
  },

  are_no: {
    type: DataTypes.STRING
  },

  form_jj: {
    type: DataTypes.STRING
  },

  // =============================
  // TAX & VALUE FIELDS
  // =============================

  assessable_value: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  charity: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  vat_tax: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  cenvat: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  duty: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  cess: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  hs_cess: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  tcs: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  discount: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  gst: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  igst: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  pf_amount: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  freight: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  sub_total: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  round_off: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  final_invoice_value: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  // =============================
  // TOTALS
  // =============================

  total_charity: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_vat: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_cenvat: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_duty: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_cess: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_hr_sec_cess: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_tcs: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_sgst: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_cgst: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_igst: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_discount: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  },

  total_other: { 
    type: DataTypes.DECIMAL(15,2), 
    defaultValue: 0 
  }

}, {
  tableName: 'tbl_DepotSalesHeaders',
  timestamps: true
});
/**
 * ==========================================
 * DEPOT SALES DETAIL MODEL (MODIFIED)
 * ==========================================
 */
const DepotSalesDetail = sequelize.define('DepotSalesDetail', {

  depot_sales_id: { type: DataTypes.INTEGER },

  order_no: { type: DataTypes.STRING },

  order_type: { 
    type: DataTypes.STRING,
    defaultValue: 'WITH_ORDER'
  },

  product_id: { type: DataTypes.INTEGER },

  packs: { 
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },

  packing_type: { type: DataTypes.STRING },

  total_kgs: { 
    type: DataTypes.DECIMAL(15,3),
    defaultValue: 0
  },

  avg_content: { 
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },

  broker_code: { type: DataTypes.STRING },

  broker_percentage: { 
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },

  product_description: { type: DataTypes.STRING },

  rate_per: { type: DataTypes.STRING },

  identification_mark: { type: DataTypes.STRING },

  from_no: { type: DataTypes.STRING },

  to_no: { type: DataTypes.STRING },

  resale: { 
    type: DataTypes.DECIMAL(12,2),
    defaultValue: 0
  },

  convert_to_hank: { 
    type: DataTypes.DECIMAL(12,2),
    defaultValue: 0
  },

  convert_to_cone: { 
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  assessable_value: { 
    type: DataTypes.DECIMAL(15,2),
    defaultValue: 0
  },

  charity_amt: { 
    type: DataTypes.DECIMAL(15,2),
    defaultValue: 0
  },

  vat_per: { 
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },

  vat_amt: { 
    type: DataTypes.DECIMAL(15,2),
    defaultValue: 0
  },

  cenvat_per: { 
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },

  cenvat_amt: { 
    type: DataTypes.DECIMAL(15,2),
    defaultValue: 0
  },

  duty_per: { 
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },

  duty_amt: { 
    type: DataTypes.DECIMAL(15,2),
    defaultValue: 0
  },

  cess_per: { 
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },

  cess_amt: { 
    type: DataTypes.DECIMAL(15,2),
    defaultValue: 0
  },

  hcess_per: { 
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },

  hcess_amt: { 
    type: DataTypes.DECIMAL(15,2),
    defaultValue: 0
  },

  sgst_per: { 
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },

  sgst_amt: { 
    type: DataTypes.DECIMAL(15,2),
    defaultValue: 0
  },

  cgst_per: { 
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },

  cgst_amt: { 
    type: DataTypes.DECIMAL(15,2),
    defaultValue: 0
  },

  igst_per: { 
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },

  igst_amt: { 
    type: DataTypes.DECIMAL(15,2),
    defaultValue: 0
  },

  tcs_per: { 
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },

  tcs_amt: { 
    type: DataTypes.DECIMAL(15,2),
    defaultValue: 0
  },

  discount_percentage: { 
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },

  discount_amt: { 
    type: DataTypes.DECIMAL(15,2),
    defaultValue: 0
  },

  other_amt: { 
    type: DataTypes.DECIMAL(15,2),
    defaultValue: 0
  },

  freight_amt: { 
    type: DataTypes.DECIMAL(15,2),
    defaultValue: 0
  },

  sub_total: { 
    type: DataTypes.DECIMAL(15,2),
    defaultValue: 0
  },

  rounded_off: { 
    type: DataTypes.DECIMAL(15,2),
    defaultValue: 0
  },

  final_value: { 
    type: DataTypes.DECIMAL(15,2),
    defaultValue: 0
  }

}, {
  tableName: 'tbl_DepotSalesDetails',
  timestamps: true
});
/**
 * ==========================================
 * 5. OTHER MODELS
 * ==========================================
 */
const RG1Production = sequelize.define('RG1Production', {
  date: { type: DataTypes.DATEONLY, allowNull: false },
  product_id: { type: DataTypes.INTEGER },
  packing_type_id: { type: DataTypes.INTEGER, allowNull: false },
  weight_per_bag: { type: DataTypes.DECIMAL(10, 3), defaultValue: 0 },
  prev_closing_kgs: { type: DataTypes.DECIMAL(15, 3), defaultValue: 0 },
  production_kgs: { type: DataTypes.DECIMAL(15, 3), defaultValue: 0 },
  invoice_kgs: { type: DataTypes.DECIMAL(15, 3), defaultValue: 0 },
  stock_kgs: { type: DataTypes.DECIMAL(15, 3), defaultValue: 0 },
  stock_bags: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  stock_loose_kgs: { type: DataTypes.DECIMAL(15, 3), defaultValue: 0 }
}, { tableName: 'tbl_RG1Productions', timestamps: true });

const InvoiceType = sequelize.define("InvoiceType", {

  // =============================
  // BASIC INFORMATION
  // =============================
  code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },

  type_name: {
    type: DataTypes.STRING,
    allowNull: false
  },

  sales_type: {
    type: DataTypes.STRING
  },

  group_name: {
    type: DataTypes.STRING
  },

  is_option_ii: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  round_off_digits: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },

  account_posting: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },

  // =============================
  // ASSESS VALUE
  // =============================
  assess_checked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  assess_formula: {
    type: DataTypes.STRING
  },

  assess_account: {
    type: DataTypes.STRING
  },

  // =============================
  // CHARITY / BALE
  // =============================
  charity_checked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  charity_value: {
    type: DataTypes.DECIMAL(10,2)
  },

  charity_formula: {
    type: DataTypes.STRING
  },

  charity_account: {
    type: DataTypes.STRING
  },

  // =============================
  // VAT
  // =============================
  vat_checked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  vat_percentage: {
    type: DataTypes.DECIMAL(10,2)
  },

  vat_formula: {
    type: DataTypes.STRING
  },

  vat_account: {
    type: DataTypes.STRING
  },

  // =============================
  // DUTY
  // =============================
  duty_checked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  duty_percentage: {
    type: DataTypes.DECIMAL(10,2)
  },

  duty_formula: {
    type: DataTypes.STRING
  },

  duty_account: {
    type: DataTypes.STRING
  },

  // =============================
  // CESS
  // =============================
  cess_checked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  cess_percentage: {
    type: DataTypes.DECIMAL(10,2)
  },

  cess_formula: {
    type: DataTypes.STRING
  },

  cess_account: {
    type: DataTypes.STRING
  },

  // =============================
  // HR SEC CESS
  // =============================
  hr_sec_cess_checked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  hr_sec_cess_percentage: {
    type: DataTypes.DECIMAL(10,2)
  },

  hr_sec_cess_formula: {
    type: DataTypes.STRING
  },

  hr_sec_cess_account: {
    type: DataTypes.STRING
  },

  // =============================
  // TCS
  // =============================
  tcs_checked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  tcs_percentage: {
    type: DataTypes.DECIMAL(10,2)
  },

  tcs_formula: {
    type: DataTypes.STRING
  },

  tcs_account: {
    type: DataTypes.STRING
  },

  // =============================
  // CST
  // =============================
  cst_checked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  cst_percentage: {
    type: DataTypes.DECIMAL(10,2)
  },

  cst_formula: {
    type: DataTypes.STRING
  },

  cst_account: {
    type: DataTypes.STRING
  },

  // =============================
  // CENVAT
  // =============================
  cenvat_checked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  cenvat_percentage: {
    type: DataTypes.DECIMAL(10,2)
  },

  cenvat_formula: {
    type: DataTypes.STRING
  },

  cenvat_account: {
    type: DataTypes.STRING
  },

  // =============================
  // GST (SGST + CGST)
  // =============================
  gst_checked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  sgst_percentage: {
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },

  cgst_percentage: {
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0
  },

  sgst_formula: {
    type: DataTypes.STRING
  },

  cgst_formula: {
    type: DataTypes.STRING
  },

  sgst_account: {
    type: DataTypes.STRING
  },

  cgst_account: {
    type: DataTypes.STRING
  },

  // =============================
  // IGST
  // =============================
  igst_checked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  igst_percentage: {
    type: DataTypes.DECIMAL(10,2)
  },

  igst_formula: {
    type: DataTypes.STRING
  },

  igst_account: {
    type: DataTypes.STRING
  },

  // =============================
  // FOOTER FORMULAS
  // =============================
  sub_total_formula: {
    type: DataTypes.STRING
  },

  total_value_formula: {
    type: DataTypes.STRING
  },

  round_off_formula: {
    type: DataTypes.STRING
  },

  round_off_direction: {
    type: DataTypes.ENUM("Forward", "Reverse"),
    defaultValue: "Forward"
  },

  round_off_account: {
    type: DataTypes.STRING
  },

  lorry_freight_account: {
    type: DataTypes.STRING
  }

}, {
  tableName: "tbl_InvoiceTypes",
  timestamps: true
});

// module.exports = InvoiceType;

// models/DespatchEntry.js
const DespatchEntry = sequelize.define('DespatchEntry', {

  load_no: {
    type: DataTypes.STRING,
    allowNull: false
  },

  load_date: {
    type: DataTypes.DATEONLY
  },

  transport_id: {
    type: DataTypes.INTEGER
  },

  lr_no: {
    type: DataTypes.STRING
  },

  lr_date: {
    type: DataTypes.DATEONLY
  },

  vehicle_no: {
    type: DataTypes.STRING
  },

  delivery: {
    type: DataTypes.STRING
  },

  insurance_no: {
    type: DataTypes.STRING
  },

  in_time: {
    type: DataTypes.TIME
  },

  out_time: {
    type: DataTypes.TIME
  },

  no_of_bags: {
    type: DataTypes.DECIMAL(10, 2)
  },

  freight: {
    type: DataTypes.DECIMAL(12, 2)
  },

  freight_per_bag: {
    type: DataTypes.DECIMAL(12, 2)
  }

}, {
  tableName: 'tbl_DespatchEntries',
  timestamps: true
});

/**
 * ==========================================
 * 6. ASSOCIATIONS (RELATIONSHIPS)
 * ==========================================
 */

// Product -> Tariff
Product.belongsTo(TariffSubHead, { 
  foreignKey: 'tariff_sub_head',
  targetKey: 'tariff_code'
});

// Depot Received Associations (Opening Stock & Inward Logs)
DepotReceived.belongsTo(Account, { foreignKey: 'depot_id', as: 'Depot' });
DepotReceived.belongsTo(Product, { foreignKey: 'product_id', as: 'Product' }); // ✅ NEW

// Depot Sales Associations
DepotSalesHeader.belongsTo(Account, { foreignKey: 'party_id', as: 'Party' });
DepotSalesHeader.belongsTo(Account, { foreignKey: 'depot_id', as: 'Depot' });
DepotSalesHeader.belongsTo(Transport, { foreignKey: 'transport_id' });
DepotSalesHeader.hasMany(DepotSalesDetail, { foreignKey: 'depot_sales_id',as: 'DepotSalesDetails', onDelete: 'CASCADE' });
DepotSalesDetail.belongsTo(Product, { foreignKey: 'product_id',as: 'Product'});
// Order Associations
OrderHeader.belongsTo(Account, { foreignKey: 'party_id', as: 'Party' });
OrderHeader.belongsTo(Broker, { foreignKey: 'broker_id', as: 'Broker' });

OrderDetail.belongsTo(Product, { foreignKey: 'product_id' });
OrderHeader.hasMany(OrderDetail, { 
    foreignKey: 'order_id', 
    as: 'OrderDetails',
    onDelete: 'CASCADE' 
});
OrderDetail.belongsTo(OrderHeader, { foreignKey: 'order_id' });

// Invoice WITH Order Associations
// InvoiceHeader.belongsTo(Account, { foreignKey: 'party_id', as: 'Party' });
InvoiceHeader.belongsTo(Transport, { foreignKey: 'transport_id' });
InvoiceHeader.hasMany(InvoiceDetail, { foreignKey: 'invoice_id', onDelete: 'CASCADE' });
// ADD THIS LINE
InvoiceDetail.belongsTo(InvoiceHeader, { foreignKey: 'invoice_id' });
InvoiceDetail.belongsTo(Product, { foreignKey: 'product_id' });
DepotSalesDetail.belongsTo(DepotSalesHeader, { foreignKey: 'depot_sales_id' });

// DIRECT Invoice Associations
DirectInvoiceHeader.belongsTo(Broker, { foreignKey: 'broker_id', as: 'Broker' });
DirectInvoiceHeader.hasMany(DirectInvoiceDetail, { foreignKey: 'direct_invoice_id', as: 'DirectInvoiceDetails', onDelete: 'CASCADE' });
DirectInvoiceDetail.belongsTo(Product, { foreignKey: 'product_id', as: 'Product' });
DirectInvoiceDetail.belongsTo(DirectInvoiceHeader, { foreignKey: 'direct_invoice_id', as: 'Header' });

// Production Associations
RG1Production.belongsTo(Product, { foreignKey: 'product_id' });
RG1Production.belongsTo(PackingType, { foreignKey: 'packing_type_id' });
// InvoiceHeader.belongsTo(DespatchEntry, { foreignKey: 'load_id' });
// InvoiceHeader.belongsTo(Account, { foreignKey: 'party_id', as: 'Party' });
// InvoiceHeader.belongsTo(Transport, { foreignKey: 'transport_id' });
// Despatch
DespatchEntry.belongsTo(Transport, { foreignKey: 'transport_id' });


// InvoiceHeader.belongsTo(InvoiceType, { foreignKey: 'invoice_type_id', as: 'TypeConfig' });
// InvoiceHeader.hasMany(InvoiceDetail, { foreignKey: 'invoice_id', onDelete: 'CASCADE' });
// InvoiceDetail.belongsTo(InvoiceHeader, { foreignKey: 'invoice_id' });
// InvoiceDetail.belongsTo(Product, { foreignKey: 'product_id' });

// ==========================
// INVOICE ASSOCIATIONS
// ==========================

InvoiceHeader.belongsTo(Account, { 
  foreignKey: 'party_id',
  as: 'Party'
});

InvoiceHeader.belongsTo(Transport, { 
  foreignKey: 'transport_id'
});

InvoiceHeader.belongsTo(DespatchEntry, { 
  foreignKey: 'load_id'
});

InvoiceHeader.belongsTo(InvoiceType, { 
  foreignKey: 'invoice_type_id'
});

InvoiceHeader.hasMany(InvoiceDetail, { 
  foreignKey: 'invoice_id',
  onDelete: 'CASCADE'
});
InvoiceHeader.belongsTo(Broker, {
  foreignKey: 'broker_id',
  as: 'Broker'
});
InvoiceDetail.belongsTo(InvoiceHeader, { 
  foreignKey: 'invoice_id'
});

InvoiceDetail.belongsTo(Product, { 
  foreignKey: 'product_id'
});
DepotSalesHeader.belongsTo(Broker, {
  foreignKey: 'broker_id',
  as: 'Broker'
});
DirectInvoiceHeader.belongsTo(Account, { foreignKey: 'party_id', as: 'Party' }); 

module.exports = {
  sequelize, TariffSubHead, PackingType, Broker, Transport, Account,
  Product, OrderHeader, OrderDetail, RG1Production,
  InvoiceHeader, InvoiceDetail, DirectInvoiceHeader, DirectInvoiceDetail, 
  DepotReceived, InvoiceType, DespatchEntry, DepotSalesHeader, DepotSalesDetail
};