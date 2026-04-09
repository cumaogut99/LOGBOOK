# PM Logbook - Kod İyileştirme ve Geliştirme Raporu

**Tarih:** 22 Kasım 2025 (Güncellenmiş)  
**Hazırlayan:** AI Kod Analiz Sistemi  
**Proje:** PM Logbook - Preventive Maintenance Tracking System

---

## 📋 YÖNETİCİ ÖZETİ

PM Logbook, motor bakım takibi için geliştirilmiş orta-büyük ölçekli bir web uygulamasıdır. Genel kalite **orta-iyi** seviyededir, ancak kurumsal ortamda kullanım öncesi **kritik güvenlik, stabilite ve entegrasyon iyileştirmeleri** gerekmektedir.

**Son Güncellemeler (22 Kasım 2025):**
- ✅ UI/UX testleri tamamlandı, kritik hatalar düzeltildi
- ✅ PDF raporlama sistemi eklendi (Türkçe karakter desteği ile)
- ✅ Periyodik bakım ve parça ömrü takibi stabilize edildi
- ✅ Build Report yükleme hataları giderildi
- ⏳ Şirket entegrasyonu planlaması yapıldı (IT departmanı cevabı bekleniyor)

---

## 🏢 KURUMSAL ENTEGRASYON VE GENİŞLEME PLANI

Aşağıdaki maddeler, uygulamanın şirket altyapısına tam uyumlu hale gelmesi için belirlenen stratejik hedeflerdir.

### 1. Şirket İçi Kimlik Doğrulama (SSO/LDAP)
Mevcut sistemdeki yerel kullanıcı yönetimi yerine, şirketin merkezi kimlik yönetim sistemi kullanılacaktır.

*   **IT Departmanı Yönlendirmesi Gerekenler:**
    *   Şirket hangi protokolü kullanıyor? (LDAP, Active Directory, OAuth2, SAML?)
    *   Gerekli bağlantı bilgileri (LDAP URL, Base DN, Service Account vb.) veya API anahtarları.
    *   Test ortamı erişimi.
*   **Yazılım Ekibi Aksiyonları:**
    *   Backend'de `passport.js` veya benzeri bir kütüphane ile LDAP/AD stratejisi kurulacak.
    *   `users` tablosu, dış kaynaktan gelen `uid` veya `email` ile eşleşecek şekilde güncellenecek.
    *   Login sayfası, "Kurumsal Hesap ile Giriş Yap" seçeneği ile güncellenecek.

**🔒 Güvenlik Etkisi:** SSO kullanımı aşağıdaki riskleri **azaltır**:
- ❌ Plain text şifre saklama riski ortadan kalkar (şifreler şirket sisteminde)
- ❌ Zayıf şifre seçimi riski ortadan kalkar (şirket politikası geçerli)
- ✅ Merkezi yetki yönetimi sağlanır
- ⚠️ **Ancak:** API güvenliği, session yönetimi ve input validation hala gereklidir

### 2. Yetki ve Rol Yönetimi (RBAC)
Admin kullanıcısının, diğer kullanıcıların yetkilerini (Admin, Teknisyen, İzleyici vb.) arayüz üzerinden yönetebilmesi gerekmektedir.

*   **Yazılım Ekibi Aksiyonları (IT Bağımsız):**
    *   Veritabanında `roles` ve `permissions` tabloları oluşturulacak veya `users` tablosuna `role` alanı enum olarak eklenecek (Mevcut yapıda basit `role` sütunu var, UI eksik).
    *   **Admin Paneli > Kullanıcılar** sayfası tasarlanacak.
    *   Bu sayfada: Kullanıcı listeleme, Rol değiştirme (Dropdown), Kullanıcıyı pasife alma fonksiyonları eklenecek.
    *   Backend middleware'leri (`checkRole`) bu dinamik yapıya göre güncellenecek.

### 3. Envanter ve Depo Entegrasyonu (SAP & Excel)
Manuel veri girişini azaltmak için toplu veri aktarımı sağlanacaktır.

*   **IT Departmanı Yönlendirmesi Gerekenler:**
    *   SAP sisteminden veri çekmek için bir API veya Web Servis mevcut mu?
    *   Yoksa, SAP'den hangi formatta (CSV/Excel) çıktı alınabiliyor? Örnek dosya formatı nedir?
*   **Yazılım Ekibi Aksiyonları:**
    *   **Excel Import:** `xlsx` kütüphanesi ile, belirlenen şablondaki Excel dosyasını okuyup `inventory` tablosuna `UPSERT` (varsa güncelle, yoksa ekle) yapan modül yazılacak.
    *   **SAP Entegrasyonu:** Eğer API varsa, backend'de bir cron job (zamanlanmış görev) oluşturulup her gece stokların senkronize edilmesi sağlanacak.

### 4. Veri Yedekleme Stratejisi
Veri kaybını önlemek için sağlam bir yedekleme mekanizması kurulmalıdır.

*   **IT Departmanı Yönlendirmesi Gerekenler:**
    *   Şirketin standart yedekleme politikası nedir? (Günlük/Haftalık?)
    *   Yedeklerin tutulacağı güvenli ağ konumu (Network Share / NAS) veya bulut alanı neresidir?
*   **Yazılım Ekibi Aksiyonları:**
    *   SQLite veritabanı tek bir dosya olduğu için yedeklemesi kolaydır.
    *   `node-cron` kullanılarak her gece 03:00'te veritabanı dosyasının (`pm-logbook.db`) kopyası alınıp `.zip` formatında sıkıştırılacak.
    *   Yedek dosyasının ismine tarih eklenecek (`backup-2025-11-22.zip`).
    *   Eski yedekleri (örn. 30 günden eski) otomatik silen bir temizlik scripti yazılacak.

### 5. Otomatik Mail Bildirim Sistemi
Kritik olaylarda (Parça ömrü dolumu, yaklaşan bakım) ilgili kişilerin uyarılması.

*   **IT Departmanı Yönlendirmesi Gerekenler:**
    *   Şirket SMTP sunucu bilgileri (Host, Port, Security Protocol).
    *   Mail gönderimi için yetkili bir servis hesabı (Service Account Email & Password).
    *   Firewall kuralları (Uygulama sunucusunun mail sunucusuna erişim izni).
*   **Yazılım Ekibi Aksiyonları:**
    *   Backend'de `nodemailer` kurulumu yapılacak.
    *   Mail şablonları (HTML) hazırlanacak.
    *   Periyodik kontrol servisi (Scheduler) yazılacak:
        *   Her sabah 08:00'de çalışır.
        *   `Sonraki Bakım < 50 Saat` olan motorları bulur.
        *   `Ömür Limiti < %10` kalan parçaları bulur.
        *   İlgili kullanıcılara (veya tanımlı mail grubuna) toplu özet mail atar.

### 6. Veritabanı Seçimi: SQLite vs PostgreSQL
Şu anda geliştirme kolaylığı için **SQLite** kullanılıyor, ancak production ortamı için veritabanı mimarisi kararı alınmalıdır.

#### 🔍 IT Departmanına Sorulması Gerekenler:
*   Şirketin mevcut veritabanı altyapısı nedir? (PostgreSQL, MySQL, SQL Server?)
*   DBA (Database Administrator) ekibi var mı? Yoksa yazılım ekibi DB yönetiminden sorumlu mu?
*   Veritabanı sunucuları için standart yedekleme ve disaster recovery politikası mevcut mu?
*   High Availability (Yüksek Erişilebilirlik) gereksinimi var mı?
*   Kaç eşzamanlı kullanıcı bekleniyor? (**100+ kullanıcı için SQLite UYGUN DEĞİL**)

#### 📊 Karşılaştırma Tablosu:

| Özellik | SQLite | PostgreSQL |
|---------|--------|------------|
| **Kurulum** | ✅ Çok Kolay (Tek dosya) | ⚠️ Sunucu kurulumu gerekli |
| **Bakım** | ✅ Minimal (Dosya bazlı) | ⚠️ DBA bilgisi gerekebilir |
| **Performans (Küçük Veri)** | ✅ Çok hızlı | ✅ İyi |
| **Performans (Büyük Veri)** | ⚠️ 1GB+ sonrası yavaşlar | ✅ 100GB+ sorunsuz |
| **Eşzamanlı Kullanıcı** | ⚠️ Yazma işlemlerinde kilitlenme (10-20 kullanıcı limit) | ✅ 100+ kullanıcı destekler |
| **Transaction & ACID** | ✅ Destekler | ✅ Tam destek |
| **Backup** | ✅ Basit (Dosya kopyala) | ✅ pg_dump ile profesyonel |
| **Veri Bütünlüğü** | ✅ İyi | ✅ Çok güçlü (Foreign Key cascade, trigger vb.) |
| **Replikasyon** | ❌ Yok | ✅ Master-Slave, Streaming |
| **Güvenlik** | ⚠️ Dosya yetkilerine bağlı | ✅ Role-based, SSL, şifreli bağlantı |

#### 🎯 Karar: 100+ Kullanıcı için PostgreSQL Gerekli

**Hibrit Strateji:**
- **Geliştirme:** SQLite ile devam (hızlı, kolay)
- **Production:** PostgreSQL'e geçiş (IT'den bilgi gelince 1 hafta içinde)
- **Kod Hazırlığı:** ORM (Sequelize/Prisma) kullanarak DB bağımsızlığı sağla

---

## 🔴 KRİTİK SORUNLAR (Acil Müdahale Gerekli)

### 1. GÜVENLİK AÇIKLARI (YÜKSEK ÖNCELİK)

#### 1.1 Şifre Güvenliği ⚠️ **KISMİ ÇÖZÜLDÜ**
**Mevcut Durum:** Şifreler düz metin (plain text) olarak saklanıyor

**🔒 SSO Kullanımıyla Değişen Durum:**
- ✅ **Şirket SSO kullanılırsa:** Bu risk ortadan kalkar (şifreler şirket LDAP/AD'de)
- ⚠️ **Ancak:** Eğer yerel kullanıcılar (admin, servis hesapları) varsa, onlar için `bcrypt` şart!

**Çözüm (Yerel Hesaplar İçin):**
```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

```typescript
import bcrypt from 'bcryptjs';

// Şifre hashleme (kayıt sırasında)
const salt = await bcrypt.genSalt(10);
const hashedPassword = await bcrypt.hash(password, salt);

// Şifre doğrulama (giriş sırasında)
const isValid = await bcrypt.compare(password, userFromDb.passwordHash);
```

#### 1.2 Authentication & Session Yönetimi ⚠️ **KISMİ ÇÖZÜLDÜ**
**Sorun:** JWT token veya oturum yönetimi yok, sadece localStorage kullanılıyor
```typescript
// localStorage güvenli değil - XSS saldırılarına açık
localStorage.setItem('userId', userFromDb.id!.toString());
```

**🔒 SSO Kullanımıyla Değişen Durum:**
- ✅ SSO token'ları (OAuth2, SAML) şirket tarafından yönetilir
- ✅ Oturum süresi şirket politikasıyla kontrol edilir
- ⚠️ **Ancak:** Uygulama içi API çağrıları için **JWT veya session token** hala gerekli!

**Çözüm:** JWT (JSON Web Token) implementasyonu
```bash
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

```typescript
// Backend - Token oluştur
import jwt from 'jsonwebtoken';

const token = jwt.sign(
  { userId: user.id, role: user.role }, 
  process.env.JWT_SECRET!, 
  { expiresIn: '8h' }
);

// Frontend - Token'ı httpOnly cookie'de sakla (XSS koruması)
// Veya header'da gönder
```

#### 1.3 API Güvenlik Eksiklikleri ❌ **ÇÖZÜLMEDI**
**Sorun:** API endpoint'leri authentication gerektirmiyor
```javascript
// server/routes/api.js - Tüm endpoint'ler açık
router.delete('/engines/:id', async (req, res) => {
  // Authentication kontrolü YOK!
  await dbRun('DELETE FROM engines WHERE id = ?', [req.params.id]);
});
```

**Risk:** Herhangi biri API'ye doğrudan erişerek veri silebilir veya değiştirebilir

**🔒 SSO Etkisi:**
- ⚠️ SSO sadece **giriş** için, API koruması **ayrı** bir konu!
- ✅ JWT/Session middleware **mutlaka** eklenmeli

**Çözüm:** Middleware ile authentication kontrolü
```javascript
// Middleware ekle
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
  });
};

// Tüm korumalı route'lara ekle
router.delete('/engines/:id', authenticateToken, async (req, res) => {
  // ...
});
```

#### 1.4 CORS Yapılandırması ⚠️
**Sorun:** CORS tam açık, tüm origin'lere izin veriyor
```javascript
// server/index.js
app.use(cors()); // Tüm origin'lere açık!
```

**Çözüm:**
```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3002',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
}));
```

#### 1.5 Input Validation Eksikliği ⚠️
**Sorun:** API endpoint'lerinde yeterli input validation yok

**Çözüm:** express-validator kullanımı
```bash
npm install express-validator
```

```javascript
const { body, validationResult } = require('express-validator');

router.post('/faults', [
  body('engineId').isInt().withMessage('Engine ID must be integer'),
  body('description').isLength({ min: 10, max: 500 }).trim().escape(),
  body('severity').isIn(['Minor', 'Major', 'Critical']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // ...
});
```

---

### 2. VERİTABANI SORUNLARI

#### 2.1 JSON Sütunlarda Veri Kaybı Riski ⚠️
**Sorun:** Components ve activityLog JSON.stringify ile saklanıyor

**Risk:** 
- Parse hatalarında veri kaybı
- Veritabanı seviyesinde sorgulama zorluğu
- Büyük JSON'larda performans düşüşü

**Çözüm:** İlişkisel tablo yapısına geçiş (PostgreSQL geçişi ile birlikte)

#### 2.2 Transaction Yönetimi Eksikliği ⚠️
**Sorun:** İlişkili işlemlerde transaction kullanılmıyor

**Çözüm:**
```javascript
router.post('/swaps', async (req, res) => {
  try {
    await dbRun('BEGIN TRANSACTION');
    
    // 1. Swap kaydı
    const swapResult = await dbRun('INSERT INTO swaps ...');
    
    // 2. Engine güncelle
    await dbRun('UPDATE engines ...');
    
    // 3. Inventory güncelle
    await dbRun('UPDATE inventory ...');
    
    await dbRun('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await dbRun('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});
```

---

### 3. HATA YÖNETİMİ VE LOGGİNG

#### 3.1 Frontend Error Boundary Yok ❌
**Sorun:** React Error Boundary implementasyonu yok
**Çözüm:** Sonraki adımda eklenecek (bu görüşmede)

#### 3.2 Logging Sistemi Eksikliği ⚠️
**Sorun:** Sadece console.log kullanılıyor (temizlendi ama logger yok)

**Çözüm:** Winston logger implementasyonu
```bash
npm install winston
```

---

## ✅ SON GÜNCELLEMELER VE İYİLEŞTİRMELER

### UI/UX İyileştirmeleri (22 Kasım 2025)
1. ✅ **Tests Sayfası:** İngilizce mesajlar Türkçeleştirildi, form validasyonları eklendi
2. ✅ **Warehouse Sayfası:** Console.log'lar temizlendi
3. ✅ **Faults Sayfası:** Severity filtresi eklendi
4. ✅ **Assembler Sayfası:** Tooltip'ler eklendi (Kullanıcı yönlendirmesi)
5. ✅ **Reports Sayfası:** PDF export, Türkçe karakter desteği, yönetici özeti

### Backend İyileştirmeleri
1. ✅ Periyodik bakım mantığı düzeltildi
2. ✅ Build Report history endpoint'leri eklendi
3. ✅ Swaps NULL ID hatası giderildi
4. ✅ Inventory hours senkronizasyonu düzeltildi

---

## 🎯 ÖNCELİKLİ EYLEM PLANI

### Faz 1: Güvenlik ve Error Handling (ŞİMDİ)
```
☐ 1. React Error Boundary ekle
☐ 2. API Authentication middleware (JWT)
☐ 3. CORS yapılandırması
☐ 4. Input validation (express-validator)
☐ 5. Bcrypt ile şifre hashleme (yerel hesaplar için)
```

### Faz 2: Kurumsal Entegrasyon (IT Cevabı Sonrası)
```
☐ 1. SSO/LDAP entegrasyonu
☐ 2. Admin Yetki Yönetimi UI
☐ 3. Excel import modülü
☐ 4. Veritabanı yedekleme scripti
☐ 5. Mail bildirim sistemi
☐ 6. PostgreSQL migration
```

### Faz 3: Stabilite ve Performans
```
☐ 1. Transaction yönetimi
☐ 2. Logging sistemi (Winston)
☐ 3. Database indeks optimizasyonu
☐ 4. N+1 query optimizasyonu
```

---

## 📚 TEKNİK BORÇ VE İYİLEŞTİRME FIRSATLARı

### Performans
- File upload: Base64 yerine multipart/form-data (multer)
- React Query implementasyonu (cache yönetimi için)
- Database connection pool (better-sqlite3 veya PostgreSQL)

### Kod Kalitesi
- TypeScript strict mode
- Unit test coverage (hedef %50+)
- E2E test coverage (Playwright)
- ESLint + Prettier yapılandırması

### Dokümantasyon
- API dokümantasyonu (Swagger/OpenAPI)
- Kod içi JSDoc comments
- Architecture diagram
- User manual

---

**Rapor Sonu**
