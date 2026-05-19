require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { DataTypes } = require('sequelize');
const sequelize = require('./config/database');
const masterRoutes = require('./routes/masterRoutes');

const ensureInvoiceDetailColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const table = 'tbl_InvoiceDetails';
  const existing = await queryInterface.describeTable(table);
  const columns = {
    broker_code1: { type: DataTypes.STRING },
    broker_code2: { type: DataTypes.STRING },
    broker_percentage2: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    lot_no: { type: DataTypes.STRING },
    convert_to_cone: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    charity_per_bale: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    other_per: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }
  };

  for (const [name, definition] of Object.entries(columns)) {
    if (!existing[name]) {
      await queryInterface.addColumn(table, name, definition);
    }
  }

  if (existing.convert_to_cone) {
    await queryInterface.changeColumn(table, 'convert_to_cone', {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    });
  }
};

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', masterRoutes);

  try {
    await sequelize.authenticate();
    console.log('Database connected');

    await sequelize.sync({ alter: false });
    await ensureInvoiceDetailColumns();

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`REST API: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Server start error:', error);
  }
}

startServer();
