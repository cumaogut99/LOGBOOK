const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * Verifies JWT token from Authorization header
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Yetkisiz erişim: Token bulunamadı' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Geçersiz token' });
        }

        // Attach user info to request
        req.user = user;
        next();
    });
};

/**
 * Role-based Authorization Middleware
 * Checks if user has required role
 */
const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Yetki kontrolü için önce giriş yapmanız gerekiyor' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz bulunmuyor' });
        }

        next();
    };
};

module.exports = { authenticateToken, checkRole };

