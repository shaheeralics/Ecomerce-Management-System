const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from the root .env file if it exists
const rootEnvPath = path.join(__dirname, '../.env');
if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath });
} else {
    dotenv.config(); // fallback
}
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
const apiRoutes = require('./modules/api');
const productRoutes = require('./modules/api/products');

app.use('/webhook/whatsapp', whatsappRoutes);
app.use('/api/products', productRoutes);
app.use('/api', apiRoutes);

// Catch-all to serve frontend index.html for React Router
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
