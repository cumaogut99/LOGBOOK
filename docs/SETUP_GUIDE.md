# PM Logbook - Setup ve Kurulum Kılavuzu

Bu dokuman, PM Logbook uygulamasının SQLite veritabanı ile kurulumu ve çalıştırılması için adım adım talimatları içerir.

## Sistem Gereksinimleri

- Node.js 16.x veya üzeri
- npm 7.x veya üzeri
- 200 MB boş disk alanı

## Kurulum Adımları

### 1. Bağımlılıkların Yüklenmesi

Proje dizininde aşağıdaki komutu çalıştırın:

```bash
npm install
```

Bu komut hem frontend hem de backend için gerekli tüm paketleri yükleyecektir:

**Frontend Paketleri:**
- React 19.2.0
- React Router DOM
- Axios
- TypeScript

**Backend Paketleri:**
- Express (Web server)
- SQLite3 (Veritabanı)
- CORS (Cross-Origin Resource Sharing)
- Concurrently (Paralel script çalıştırma)

### 2. Veritabanı Yapılandırması

Uygulama ilk çalıştırıldığında SQLite veritabanı otomatik olarak oluşturulur:
- Konum: `server/pm-logbook.db`
- Şema: Otomatik oluşturulur
- Örnek Veri: Otomatik yüklenir

### 3. Uygulamayı Çalıştırma

#### Geliştirme Modu (Development)

```bash
npm run dev
```

Bu komut aynı anda şunları başlatır:
- Backend API sunucusu: `http://localhost:5000`
- Frontend geliştirme sunucusu: `http://localhost:3000`

Tarayıcınızda `http://localhost:3002` adresini açın.

#### Sadece Backend Çalıştırma

```bash
npm run server
```

#### Sadece Frontend Çalıştırma

```bash
npm run client
```

## Kullanıcı Girişi

Uygulama örnek kullanıcılarla birlikte gelir:

| Kullanıcı Adı | Şifre | Rol |
|---------------|-------|-----|
| admin | adminpass | Administrator |
| planner | plannerpass | Planning Engineer |
| testop | testoppass | Test Operator |
| fault | faultpass | Fault Coordinator |
| assy | assypass | Assembly Engineer |
| readonly | readonlypass | Quality Control Engineer |

## Özellikler

### 1. Dashboard (Gösterge Paneli)
- Motor filosu özeti
- Toplam çalışma saatleri
- Yaşam döngüsü uyarıları
- Aktif arızalar

### 2. Engine Management (Motor Yönetimi)
- Motor listesi görüntüleme
- Motor detayları
- Komponent ağacı (BOM)
- Aktivite geçmişi

### 3. Test Management (Test Yönetimi)
- Test kaydı oluşturma
- Test geçmişi görüntüleme
- Test raporları

### 4. Fault Tracking (Arıza Takibi)
- Arıza bildirimi oluşturma
- Severity seviyeleri (Minor, Major, Critical)
- Arıza durumu takibi (Open, Closed)

### 5. Component Assembler (Komponent Montajı)
- Komponent takma/çıkarma işlemleri
- Swap aktivitesi kayıtları

### 6. Warehouse (Depo Yönetimi)
- Yedek parça envanteri
- Stok takibi
- Lokasyon yönetimi

## API Yapısı

### Veritabanı İşlemleri

Tüm veritabanı işlemleri SQLite üzerinden yapılır:

```
server/
  ├── pm-logbook.db          # SQLite veritabanı dosyası
  ├── database.js            # Veritabanı bağlantısı ve şema
  ├── routes/
  │   └── api.js             # REST API endpoints
  └── index.js               # Express sunucu
```

### API Endpoints

**Users (Kullanıcılar)**
- `GET /api/users` - Tüm kullanıcıları listele
- `GET /api/users/:id` - Belirli kullanıcıyı getir
- `GET /api/users/by-username/:username` - Kullanıcı adına göre getir

**Engines (Motorlar)**
- `GET /api/engines` - Tüm motorları listele
- `POST /api/engines` - Yeni motor ekle
- `PUT /api/engines/:id` - Motor güncelle
- `DELETE /api/engines/:id` - Motor sil

**Tests (Testler)**
- `GET /api/tests` - Tüm testleri listele
- `POST /api/tests` - Yeni test kaydı oluştur
- `PUT /api/tests/:id` - Test güncelle
- `DELETE /api/tests/:id` - Test sil

**Faults (Arızalar)**
- `GET /api/faults` - Tüm arızaları listele
- `POST /api/faults` - Yeni arıza bildirimi
- `PUT /api/faults/:id` - Arıza güncelle
- `DELETE /api/faults/:id` - Arıza sil

**Inventory (Envanter)**
- `GET /api/inventory` - Tüm envanter öğelerini listele
- `POST /api/inventory` - Yeni öğe ekle
- `DELETE /api/inventory/:id` - Öğe sil

## Veritabanı Yönetimi

### Veritabanını Sıfırlama

Veritabanını sıfırlamak ve örnek verilerle yeniden başlatmak için:

1. Sunucuyu durdurun (Ctrl+C)
2. `server/pm-logbook.db` dosyasını silin
3. Sunucuyu tekrar başlatın: `npm run dev`

### Veritabanı Yedeği

SQLite veritabanı dosyasını kopyalayarak yedekleyebilirsiniz:

```bash
cp server/pm-logbook.db server/pm-logbook-backup-$(date +%Y%m%d).db
```

### Veritabanı Yapısı

Veritabanı şu tabloları içerir:

1. **users** - Kullanıcı hesapları
2. **engines** - Motor kayıtları (components ve activityLog JSON olarak saklanır)
3. **tests** - Test aktiviteleri
4. **faults** - Arıza raporları
5. **swaps** - Komponent değişim kayıtları
6. **inventory** - Depo envanteri
7. **documents** - Döküman ekleri (isteğe bağlı)

## Sorun Giderme

### Port Çakışması

Eğer portlar kullanımdaysa:

1. Backend portunu değiştirin: `server/index.js` dosyasında `PORT` değişkenini değiştirin
2. Frontend portunu değiştirin: `vite.config.ts` dosyasında `server.port` değerini değiştirin

### Veritabanı Hatası

Eğer veritabanı hatası alırsanız:

```bash
rm server/pm-logbook.db
npm run dev
```

### Bağımlılık Hatası

Eğer paket yükleme hatası alırsanız:

```bash
rm -rf node_modules package-lock.json
npm install
```

## Üretim Ortamına Deployment

### 1. Build Oluşturma

```bash
npm run build
```

Bu komut frontend'i optimize edilmiş production build'i oluşturur (`dist/` klasörüne).

### 2. Üretim Sunucusunu Başlatma

```bash
NODE_ENV=production npm start
```

Sunucu `http://localhost:5000` adresinde çalışır ve hem API hem de static dosyaları serve eder.

## Güvenlik Notları

⚠️ **ÖNEMLİ**: Bu uygulama demo amaçlıdır ve production ortamı için ek güvenlik önlemleri gerektirir:

1. Şifreler düz metin olarak saklanıyor - production'da bcrypt kullanın
2. JWT token implementasyonu ekleyin
3. HTTPS kullanın
4. Rate limiting ekleyin
5. Input validation ve sanitization yapın
6. SQL injection koruması (parametreli sorgular kullanılıyor ✓)

## Performans Optimizasyonu

SQLite veritabanı küçük-orta ölçekli projeler için idealdir:

- **Avantajlar:**
  - Kurulum gerektirmez
  - Tek dosya olarak saklanır
  - Hızlı okuma işlemleri
  - Düşük kaynak tüketimi
  - ACID uyumlu

- **Sınırlamalar:**
  - Eşzamanlı yazma işlemlerinde kısıtlı
  - Network üzerinden erişim yok
  - Çok büyük veri setleri için uygun değil (>1M kayıt)

Büyük ölçekli uygulamalar için PostgreSQL veya MySQL kullanımı önerilir.

## Destek ve İletişim

Sorularınız için geliştirme ekibiyle iletişime geçin.

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

# PM Logbook - Hızlı Başlangıç

## 🚀 Kurulum

```bash
# 1. Paketleri yükle
npm install

# 2. Uygulamayı başlat
npm run dev
```

## 🌐 Erişim

- **Frontend:** http://localhost:3002
- **Backend API:** http://localhost:5001

## 👤 Giriş Bilgileri

| Kullanıcı | Şifre | Rol |
|-----------|-------|-----|
| admin | adminpass | Administrator |
| planner | plannerpass | Planning Engineer |
| testop | testoppass | Test Operator |
| fault | faultpass | Fault Coordinator |

## ✨ Yeni Özellikler

### 1. Toast Notifications
Tüm işlemlerde başarı/hata mesajları otomatik gösteriliyor.

### 2. Motor Ekleme/Düzenleme
- Engines sayfasında "Add Engine" butonuna tıklayın
- Formu doldurun ve kaydedin
- Edit için motor kartındaki Edit butonunu kullanın

### 3. Dashboard Grafikleri
- Motor durumu dağılımı (Pie Chart)
- Açık arızalar (Bar Chart)
- Test aktiviteleri (Bar Chart)

### 4. Raporlar
Reports sayfasında:
1. Rapor tipini seçin (Fleet/Faults/Tests)
2. Tarih aralığını seçin
3. Export formatını seçin (PDF/Excel/CSV)

### 5. Arama
Warehouse sayfasında arama kutusu ile filtreleme yapın.

### 6. Silme Onayları
Artık her silme işleminde modern bir onay dialogu çıkıyor.

## 🎯 Temel Kullanım

### Motor Ekleme
1. Engines → Add Engine
2. Serial Number, Manufacturer, Model, Location gir
3. Save

### Test Kaydı
1. Tests → Log New Test Activity
2. Engine seç, test tipini gir
3. Log Test

### Arıza Bildirimi
1. Faults → Report a New Fault
2. Engine seç, severity seç
3. Report Fault

### Rapor Alma
1. Reports → Rapor tipi seç
2. Export as PDF/Excel/CSV

## ⚠️ Önemli Notlar

- SQLite veritabanı `server/pm-logbook.db` konumunda
- İlk çalıştırmada otomatik örnek veri yüklenir
- Tüm değişiklikler otomatik kaydedilir

## 🛠️ Sorun Giderme

### Port Çakışması
Eğer port çakışması olursa:
- Frontend: `vite.config.ts` içinde `port: 3002`
- Backend: `server/index.js` içinde `PORT = 5001`

### Veritabanı Sıfırlama
```bash
# Sunucuyu durdur
# pm-logbook.db dosyasını sil
rm server/pm-logbook.db
# Sunucuyu tekrar başlat
npm run dev
```

İyi kullanımlar! 🎉

# GitHub'a Yükleme Talimatları

## 1. GitHub'da Repository Oluştur

1. https://github.com/new adresine git
2. Repository name: **LOGBOOK**
3. Description: "PM Logbook - Engine Preventive Maintenance Tracking System with SQLite"
4. Public veya Private seç
5. **Create repository**'ye tıkla

## 2. Local Repository'yi GitHub'a Bağla

GitHub'da repository oluşturduktan sonra, GitHub'ın verdiği URL'yi kullan:

```bash
# GitHub repository URL'nizi buraya yazın (örnek)
git remote add origin https://github.com/KULLANICI_ADINIZ/LOGBOOK.git

# veya SSH kullanıyorsanız:
git remote add origin git@github.com:KULLANICI_ADINIZ/LOGBOOK.git
```

## 3. Push ile GitHub'a Yükle

```bash
# Ana branch'i main olarak yeniden adlandır (modern standart)
git branch -M main

# GitHub'a push et
git push -u origin main
```

## Alternatif: Tek Komutla

GitHub'da repository oluşturduktan sonra, aşağıdaki komutu çalıştır:

```bash
git remote add origin https://github.com/KULLANICI_ADINIZ/LOGBOOK.git
git branch -M main
git push -u origin main
```

## GitHub Repository URL'nizi Söyleyin

Repository oluşturduktan sonra URL'yi bana söyleyin, ben komutları çalıştırayım!

Örnek URL'ler:
- HTTPS: `https://github.com/username/LOGBOOK.git`
- SSH: `git@github.com:username/LOGBOOK.git`

