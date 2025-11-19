# PM Logbook - Acil Güvenlik Düzeltmeleri

## 🚨 KRİTİK GÜVENLİK AÇIKLARI - HEMEN DÜZELTİLMELİ

Bu dokümanda en kritik güvenlik açıklarının nasıl düzeltileceği adım adım anlatılmıştır.

---

## 1. ŞİFRE GÜVENLİĞİ (EN KRİTİK)

### Adım 1: Paket Kurulumu
```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

### Adım 2: Backend - Kullanıcı Oluşturma/Güncelleme
**Dosya:** `server/routes/api.js`

```javascript
const bcrypt = require('bcryptjs');

// Kullanıcı oluşturma endpoint'ini güncelle
router.post('/users', async (req, res) => {
  try {
    const { username, passwordHash, role, fullName } = req.body;
    
    // Şifreyi hashle
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passwordHash, salt);
    
    const result = await dbRun(
      'INSERT INTO users (username, passwordHash, role, fullName) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, role, fullName]
    );
    res.json({ id: result.id, username, role, fullName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login endpoint'i ekle (şu an yok!)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Kullanıcıyı bul
    const user = await dbGet('SELECT * FROM users WHERE username = ? COLLATE NOCASE', [username]);
    
    if (!user) {
      return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    // Şifre kontrolü
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Geçersiz şifre' });
    }
    
    // TODO: JWT token oluştur ve döndür (Adım 2'de yapılacak)
    res.json({ 
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### Adım 3: Frontend - Login Güncelleme
**Dosya:** `context/AuthContext.tsx`

```typescript
const login = async (username: string, password: string): Promise<boolean> => {
  try {
    // Artık password plaintext olarak gönderiliyor, backend hashleyecek
    const userFromDb = await usersApi.getByUsername(username);
    
    if (userFromDb && userFromDb.passwordHash === password) {
      // ⚠️ BU SATIR KALDIRILACAK - Güvenli değil!
      // Backend'de bcrypt compare yapılacak
      setUser(userFromDb);
      localStorage.setItem('userId', userFromDb.id!.toString());
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Login error:", error);
    return false;
  }
};
```

**YENİ VERSİYON:**
```typescript
const login = async (username: string, password: string): Promise<boolean> => {
  try {
    // Backend'e login isteği gönder
    const response = await api.post('/login', { username, password });
    
    if (response.data.user) {
      setUser(response.data.user);
      localStorage.setItem('userId', response.data.user.id.toString());
      // TODO: JWT token'ı kaydet
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Login error:", error);
    return false;
  }
};
```

### Adım 4: Veritabanındaki Mevcut Şifreleri Güncelleme

**Script:** `server/updatePasswords.js` (Bir kere çalıştır)
```javascript
const bcrypt = require('bcryptjs');
const db = require('./database');

async function updatePasswords() {
  const users = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM users', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  for (const user of users) {
    // Eğer şifre zaten hashli değilse (kısa ve basitse)
    if (user.passwordHash.length < 30) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(user.passwordHash, salt);
      
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE users SET passwordHash = ? WHERE id = ?',
          [hashedPassword, user.id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      
      console.log(`Updated password for user: ${user.username}`);
    }
  }
  
  console.log('All passwords updated!');
  process.exit(0);
}

updatePasswords().catch(console.error);
```

**Çalıştırma:**
```bash
node server/updatePasswords.js
```

---

## 2. JWT AUTHENTICATION

### Adım 1: Paket Kurulumu
```bash
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken
npm install dotenv
```

### Adım 2: Environment Variables
**Dosya:** `.env` (YENİ DOSYA - GIT'E EKLEMEYİN!)
```env
JWT_SECRET=your-super-secret-key-change-this-in-production-min-32-chars
JWT_EXPIRES_IN=7d
NODE_ENV=development
PORT=5001
```

**Dosya:** `.env.example` (Git'e eklenebilir)
```env
JWT_SECRET=
JWT_EXPIRES_IN=7d
NODE_ENV=development
PORT=5001
```

**Dosya:** `.gitignore`
```
# Ekle
.env
.env.local
```

### Adım 3: JWT Utility
**Dosya:** `server/utils/jwt.js` (YENİ DOSYA)
```javascript
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-DO-NOT-USE-IN-PRODUCTION';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = { generateToken, verifyToken };
```

### Adım 4: Authentication Middleware
**Dosya:** `server/middleware/auth.js` (YENİ DOSYA)
```javascript
const { verifyToken } = require('../utils/jwt');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token gerekli' });
  }

  const user = verifyToken(token);
  
  if (!user) {
    return res.status(403).json({ error: 'Geçersiz veya süresi dolmuş token' });
  }

  req.user = user; // Request'e user bilgisini ekle
  next();
}

// Role-based access control
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Yetkilendirme gerekli' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }
    
    next();
  };
}

module.exports = { authenticateToken, requireRole };
```

### Adım 5: Backend Routes'u Güncelle
**Dosya:** `server/routes/api.js`

```javascript
const { authenticateToken, requireRole } = require('../middleware/auth');
const { generateToken } = require('../utils/jwt');

// Login endpoint'ini güncelle (JWT ile)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await dbGet('SELECT * FROM users WHERE username = ? COLLATE NOCASE', [username]);
    
    if (!user) {
      return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Geçersiz şifre' });
    }
    
    // JWT token oluştur
    const token = generateToken(user);
    
    res.json({ 
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tüm korumalı endpoint'lere middleware ekle
// Örnek: Engine silme sadece Admin yapabilir
router.delete('/engines/:id', authenticateToken, requireRole('Administrator'), async (req, res) => {
  try {
    await dbRun('DELETE FROM engines WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Örnek: Test oluşturma Test Operator veya üstü roller yapabilir
router.post('/tests', authenticateToken, requireRole('Administrator', 'Test Engineer', 'Test Operator'), async (req, res) => {
  // ...
});

// Public endpoint (login) dışında tüm endpoint'lere authenticateToken ekle
```

### Adım 6: Frontend API Client Güncelleme
**Dosya:** `lib/client.ts`

```typescript
import axios from 'axios';

const API_BASE_URL = import.meta.env.PROD 
  ? (import.meta.env.VITE_API_URL || '/api')
  : '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Her isteğe token ekle
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - 401/403 hatalarını yakala
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token geçersiz veya yok
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Login API
export const authApi = {
  login: async (username: string, password: string) => {
    const response = await api.post('/login', { username, password });
    return response.data; // { token, user }
  }
};

// ... diğer API'ler
```

### Adım 7: AuthContext Güncelleme
**Dosya:** `context/AuthContext.tsx`

```typescript
const login = async (username: string, password: string): Promise<boolean> => {
  try {
    const { token, user: loggedInUser } = await authApi.login(username, password);
    
    // Token'ı kaydet
    localStorage.setItem('token', token);
    localStorage.setItem('userId', loggedInUser.id.toString());
    
    setUser(loggedInUser);
    return true;
  } catch (error) {
    console.error("Login error:", error);
    return false;
  }
};

const logout = () => {
  setUser(null);
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
};
```

---

## 3. CORS GÜVENLİĞİ

### Backend Güncelleme
**Dosya:** `server/index.js`

```javascript
// Önce
app.use(cors());

// Sonra
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3002', 'http://localhost:5173'];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
```

**.env'e ekle:**
```env
ALLOWED_ORIGINS=http://localhost:3002,http://localhost:5173,https://yourdomain.com
```

---

## 4. INPUT VALIDATION

### Adım 1: Paket Kurulumu
```bash
npm install express-validator
```

### Adım 2: Validation Middleware
**Dosya:** `server/middleware/validators.js` (YENİ DOSYA)

```javascript
const { body, param, validationResult } = require('express-validator');

// Validation sonuçlarını kontrol et
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Engine validation
const engineValidation = [
  body('model').trim().isLength({ min: 2, max: 100 }).withMessage('Model 2-100 karakter olmalı'),
  body('serialNumber').trim().isLength({ min: 2, max: 50 }).withMessage('Seri numarası 2-50 karakter olmalı'),
  body('status').isIn(['Active', 'Maintenance Due', 'AOG']).withMessage('Geçersiz durum'),
  body('totalHours').isFloat({ min: 0 }).withMessage('Toplam saat 0 veya üzeri olmalı'),
  body('totalCycles').isInt({ min: 0 }).withMessage('Toplam çevrim 0 veya üzeri olmalı'),
  body('manufacturer').trim().isLength({ min: 2, max: 100 }).withMessage('Üretici 2-100 karakter olmalı'),
  handleValidationErrors
];

// Test validation
const testValidation = [
  body('engineId').isInt().withMessage('Geçerli bir motor ID gerekli'),
  body('testType').trim().isLength({ min: 2, max: 100 }).withMessage('Test tipi 2-100 karakter olmalı'),
  body('testCell').trim().isLength({ min: 2, max: 100 }).withMessage('Test hücresi 2-100 karakter olmalı'),
  body('description').trim().isLength({ max: 1000 }).withMessage('Açıklama maksimum 1000 karakter olabilir'),
  body('duration').isFloat({ min: 0, max: 10000 }).withMessage('Süre 0-10000 saat arasında olmalı'),
  handleValidationErrors
];

// Fault validation
const faultValidation = [
  body('engineId').isInt().withMessage('Geçerli bir motor ID gerekli'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Açıklama 10-1000 karakter olmalı'),
  body('severity').isIn(['Minor', 'Major', 'Critical']).withMessage('Geçersiz kritiklik seviyesi'),
  handleValidationErrors
];

// ID parameter validation
const idValidation = [
  param('id').isInt().withMessage('Geçerli bir ID gerekli'),
  handleValidationErrors
];

module.exports = {
  engineValidation,
  testValidation,
  faultValidation,
  idValidation
};
```

### Adım 3: Routes'da Kullanımı
**Dosya:** `server/routes/api.js`

```javascript
const { 
  engineValidation, 
  testValidation, 
  faultValidation,
  idValidation 
} = require('../middleware/validators');

// Engine endpoints
router.post('/engines', authenticateToken, engineValidation, async (req, res) => {
  // Artık req.body validate edilmiş durumda
  // ...
});

router.put('/engines/:id', authenticateToken, idValidation, engineValidation, async (req, res) => {
  // ...
});

// Test endpoints
router.post('/tests', authenticateToken, testValidation, async (req, res) => {
  // ...
});

// Fault endpoints
router.post('/faults', authenticateToken, faultValidation, async (req, res) => {
  // ...
});
```

---

## 5. RATE LIMITING

### Adım 1: Paket Kurulumu
```bash
npm install express-rate-limit
```

### Adım 2: Backend Yapılandırması
**Dosya:** `server/index.js`

```javascript
const rateLimit = require('express-rate-limit');

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // IP başına maksimum 100 istek
  message: 'Çok fazla istek gönderdiniz, lütfen 15 dakika sonra tekrar deneyin.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Login rate limiter (daha katı)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 5, // IP başına maksimum 5 deneme
  message: 'Çok fazla giriş denemesi, lütfen 15 dakika sonra tekrar deneyin.',
  skipSuccessfulRequests: true, // Başarılı girişleri sayma
});

// Uygula
app.use('/api/', globalLimiter);
app.post('/api/login', loginLimiter);
```

---

## 6. HELMET (SECURITY HEADERS)

### Adım 1: Paket Kurulumu
```bash
npm install helmet
```

### Adım 2: Backend Yapılandırması
**Dosya:** `server/index.js`

```javascript
const helmet = require('helmet');

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

---

## 7. ENVIRONMENT VARIABLES SETUP

### Adım 1: dotenv Kurulumu
```bash
npm install dotenv
```

### Adım 2: Backend'de Kullanımı
**Dosya:** `server/index.js` (EN ÜSTE EKLE)

```javascript
// EN ÜSTTE
require('dotenv').config();

// Artık process.env kullanılabilir
const PORT = process.env.PORT || 5001;
```

### Adım 3: .env Dosyası
**Dosya:** `.env`

```env
# Server
NODE_ENV=development
PORT=5001

# Database
DATABASE_PATH=./server/pm-logbook.db

# JWT
JWT_SECRET=your-super-secret-key-minimum-32-characters-long-change-in-production
JWT_EXPIRES_IN=7d

# CORS
ALLOWED_ORIGINS=http://localhost:3002,http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Adım 4: .env.example (Git'e ekle)
```env
NODE_ENV=development
PORT=5001
DATABASE_PATH=./server/pm-logbook.db
JWT_SECRET=
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=http://localhost:3002
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Adım 5: .gitignore'a ekle
```
.env
.env.local
.env.*.local
```

---

## 📝 UYGULAMA SIRASI

1. **Environment Variables** (5 dakika)
2. **Şifre Hashleme** (30 dakika)
3. **JWT Authentication** (1-2 saat)
4. **Input Validation** (1-2 saat)
5. **CORS Güvenliği** (15 dakika)
6. **Rate Limiting** (15 dakika)
7. **Helmet** (10 dakika)

**TOPLAM:** 4-6 saat (1 iş günü)

---

## ✅ TEST ETME

### Test Scripti
```bash
# 1. Şifre hashleme testi
node server/updatePasswords.js

# 2. Login testi
curl -X POST http://localhost:5001/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"adminpass"}'

# Response'ta token olmalı

# 3. Korumalı endpoint testi (token ile)
curl http://localhost:5001/api/engines \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# 4. Korumalı endpoint testi (token olmadan - hata vermeli)
curl http://localhost:5001/api/engines

# 5. Rate limiting testi (10+ istek gönder)
for i in {1..10}; do curl http://localhost:5001/api/engines; done
```

---

## 🚨 PRODUCTION DEPLOYMENT ÖNCESİ

```bash
# 1. .env dosyasını production için güncelle
NODE_ENV=production
JWT_SECRET=<GÜÇLÜ BİR RASTGELE KEY OLUŞTUR>
ALLOWED_ORIGINS=https://yourdomain.com

# 2. Güçlü JWT secret oluştur
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. HTTPS kullan (Let's Encrypt)

# 4. Firewall yapılandır

# 5. Database backup sistemini kur
```

---

**Bu düzeltmeleri yaptıktan sonra uygulamanız çok daha güvenli olacaktır!**

