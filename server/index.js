const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');
const testTypesRoutes = require('./routes/testTypes');
const brakeTypesRoutes = require('./routes/brakeTypes');
const maintenancePlansRoutes = require('./routes/maintenancePlans');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api', apiRoutes);
app.use('/api/test-types', testTypesRoutes);
app.use('/api/brake-types', brakeTypesRoutes);
app.use('/api/maintenance-plans', maintenancePlansRoutes);

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

