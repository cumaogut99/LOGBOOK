require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const testTypesRoutes = require('./routes/testTypes');
const brakeTypesRoutes = require('./routes/brakeTypes');
const operatorsRoutes = require('./routes/operators');
const maintenancePlansRoutes = require('./routes/maintenancePlans');

const app = express();
const PORT = process.env.PORT || 5001;

// CORS Configuration (Güvenlik: Sadece izin verilen origin'lere erişim)
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3002', 'http://localhost:5173'];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'CORS policy: Bu origin\'den erişim izni yok.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parser Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api/auth', authRoutes); // Authentication endpoints (public)
app.use('/api', apiRoutes);
app.use('/api/test-types', testTypesRoutes);
app.use('/api/brake-types', brakeTypesRoutes);
app.use('/api/operators', operatorsRoutes);
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

