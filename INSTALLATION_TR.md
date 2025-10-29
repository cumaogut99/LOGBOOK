# PM Logbook - Hızlı Kurulum Kılavuzu

## 🚀 Hızlı Başlangıç

### 1. Bağımlılıkları Yükleyin

```bash
npm install
```

### 2. Uygulamayı Başlatın

```bash
npm run dev
```

### 3. Tarayıcıda Açın

Tarayıcınızda şu adresi açın: **http://localhost:3000**

### 4. Giriş Yapın

Örnek kullanıcı bilgileri:
- **Kullanıcı Adı:** `admin`
- **Şifre:** `adminpass`

## ✨ Özellikler

### ✅ SQLite Veritabanı
- Kurulum gerektirmez
- Otomatik oluşturulur
- Örnek verilerle gelir
- `server/pm-logbook.db` konumunda saklanır

### ✅ Modern Yapı
- **Frontend:** React + TypeScript + Vite
- **Backend:** Node.js + Express + SQLite
- **API:** RESTful architecture
- **Durum Yönetimi:** React Context + Custom Hooks

### ✅ Optimizasyonlar
- API caching stratejileri
- Lazy loading
- Verimli veri getirme
- Responsive design

## 📁 Proje Yapısı

```
pm-logbook3010/
├── server/                 # Backend sunucu
│   ├── database.js        # SQLite yapılandırması
│   ├── routes/api.js      # API route'ları
│   ├── index.js           # Express server
│   └── pm-logbook.db      # SQLite veritabanı (otomatik oluşur)
│
├── api/                   # Frontend API istemcisi
│   └── client.ts          # Axios API client
│
├── pages/                 # Uygulama sayfaları
│   ├── Dashboard.tsx      # Ana gösterge paneli
│   ├── Engines.tsx        # Motor yönetimi
│   ├── Tests.tsx          # Test yönetimi
│   ├── Faults.tsx         # Arıza takibi
│   ├── Assembler.tsx      # Komponent montajı
│   └── Warehouse.tsx      # Depo yönetimi
│
├── context/               # React Context
│   └── AuthContext.tsx    # Kimlik doğrulama
│
└── hooks/                 # Custom React hooks
    └── useData.ts         # Veri getirme hook'ları
```

## 🎯 Kullanılabilir Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | Geliştirme modunda başlat (frontend + backend) |
| `npm run server` | Sadece backend'i başlat |
| `npm run client` | Sadece frontend'i başlat |
| `npm run build` | Production build oluştur |
| `npm start` | Production modunda başlat |

## 👥 Örnek Kullanıcılar

| Kullanıcı | Şifre | Rol | Yetkiler |
|-----------|-------|-----|----------|
| admin | adminpass | Administrator | Tüm yetkiler |
| planner | plannerpass | Planning Engineer | Planlama işlemleri |
| testop | testoppass | Test Operator | Test kaydetme |
| fault | faultpass | Fault Coordinator | Arıza yönetimi |
| assy | assypass | Assembly Engineer | Montaj işlemleri |
| readonly | readonlypass | Quality Control | Salt okunur erişim |

## 🔧 Yapılandırma

### Port Değiştirme

**Backend (API) Port:** `server/index.js`
```javascript
const PORT = process.env.PORT || 5000;
```

**Frontend Port:** `vite.config.ts`
```typescript
server: {
  port: 3000,
  // ...
}
```

### API URL

Development ortamında proxy kullanılır (otomatik).

Production için `.env` dosyası oluşturun:
```env
VITE_API_URL=http://your-server:5000/api
```

## 🗃️ Veritabanı

### Veritabanı Konumu
```
server/pm-logbook.db
```

### Veritabanı Şeması

**7 Ana Tablo:**
1. `users` - Kullanıcı hesapları
2. `engines` - Motor kayıtları
3. `tests` - Test aktiviteleri
4. `faults` - Arıza raporları
5. `swaps` - Komponent değişimleri
6. `inventory` - Depo envanteri
7. `documents` - Ek dosyalar

### Veritabanını Sıfırlama

```bash
# 1. Sunucuyu durdur (Ctrl+C)
# 2. Veritabanını sil
rm server/pm-logbook.db
# 3. Sunucuyu tekrar başlat
npm run dev
```

### Veritabanı Yedeği

```bash
# Windows
copy server\pm-logbook.db server\backup.db

# Linux/Mac
cp server/pm-logbook.db server/backup.db
```

## 🐛 Sorun Giderme

### Hata: Port Already in Use

```bash
# Windows'ta port 5000'i kullanan programı bul
netstat -ano | findstr :5000

# Linux/Mac'te
lsof -i :5000
```

### Hata: Cannot find module

```bash
# Node modules'u temizle ve yeniden yükle
rm -rf node_modules package-lock.json
npm install
```

### Hata: Database is locked

```bash
# Veritabanı dosyasını sil ve yeniden başlat
rm server/pm-logbook.db
npm run dev
```

### API Bağlantı Hatası

1. Backend sunucusunun çalıştığından emin olun:
   ```bash
   npm run server
   ```

2. Backend URL'ini kontrol edin:
   - Development: `http://localhost:5000`
   - Frontend proxy otomatik yönlendirme yapar

3. CORS hatası alıyorsanız, `server/index.js` dosyasında CORS yapılandırmasını kontrol edin.

## 📊 Performans İpuçları

### SQLite Optimizasyonu

1. **İndeks kullanımı:** Sık sorgulanan alanlar için index ekleyin
2. **PRAGMA ayarları:** `database.js` içinde SQLite pragma ayarlarını optimize edin
3. **Bağlantı havuzu:** Çok kullanıcılı senaryolar için connection pooling ekleyin

### Frontend Optimizasyonu

1. **Data caching:** useQuery hook'u ile otomatik caching
2. **Lazy loading:** Route-based code splitting
3. **Debouncing:** Arama ve form işlemleri için

## 🔐 Güvenlik Notları

⚠️ **UYARI:** Bu versiyon geliştirme/demo amaçlıdır.

Production kullanımı için eklenmesi gerekenler:
- ✅ Şifre hashleme (bcrypt)
- ✅ JWT authentication
- ✅ HTTPS
- ✅ Rate limiting
- ✅ Input validation
- ✅ XSS koruması
- ✅ CSRF koruması

## 📈 Ölçeklendirme

### Veritabanı Yükseltme

SQLite yetersiz geldiğinde:

1. **PostgreSQL'e geçiş:**
   - `npm install pg`
   - `database.js` dosyasını güncelle
   - Şema yapısını koru

2. **MySQL'e geçiş:**
   - `npm install mysql2`
   - Benzer şekilde güncelle

## 📝 Notlar

- Veritabanı dosyası otomatik olarak oluşturulur
- Örnek veriler ilk başlatmada yüklenir
- Tüm değişiklikler anında kaydedilir
- Veri kaybı olmaz (SQLite ACID uyumlu)

## 🎓 Ek Kaynaklar

- **SQLite Dokümantasyonu:** https://www.sqlite.org/docs.html
- **Express.js Guide:** https://expressjs.com/
- **React Dokümantasyonu:** https://react.dev/

## 💡 Öneriler

1. Düzenli veritabanı yedeği alın
2. Log dosyalarını takip edin
3. Performans metrikleri toplayın
4. Kullanıcı geri bildirimlerini değerlendirin

## 🤝 Destek

Sorularınız için geliştirme ekibiyle iletişime geçin.

---

**Başarılar! 🚀**

