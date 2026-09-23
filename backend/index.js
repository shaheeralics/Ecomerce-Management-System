require('dotenv').config();
const express = require('express');
const cors = require('cors');

const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Import modules
const whatsappRoutes = require('./modules/whatsapp');
const shopifyRoutes = require('./modules/shopify');
const apiRoutes = require('./modules/api');
const productRoutes = require('./modules/api/products');

app.use('/webhook/whatsapp', whatsappRoutes);
app.use('/api/listings', shopifyRoutes);
app.use('/api/products', productRoutes);
app.use('/api', apiRoutes);

// Catch-all to serve frontend index.html for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
