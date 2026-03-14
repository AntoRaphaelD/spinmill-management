require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
// Renamed to masterRoutes as it contains all 9 master sections
const masterRoutes = require('./routes/masterRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.send('Backend for Kayaar Exports is running 🚀');
});

/** 
 * ROUTES 
 * Changed mounting from '/api/products' to '/api'
 * Now your endpoints will be:
 * - http://localhost:5000/api/products
 * - http://localhost:5000/api/brokers
 * - http://localhost:5000/api/parties
 * ... etc
 */
app.use('/api', masterRoutes);

// Generic Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// Database connection & Server Startup
(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');

    /**
     * sequelize.sync({ alter: true }) 
     * Recommended during development to automatically update table schemas 
     * when you add new fields to your models.
     */
    await sequelize.sync({ alter: false }); // Set to true if you want Sequelize to automatically alter tables to match models (use with caution in production)
    // await sequelize.sync({ force: true }); 
    console.log('✅ All 9 Models synced with database');

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Unable to start server:', error);
    process.exit(1); // Exit if DB connection fails
  }
})();