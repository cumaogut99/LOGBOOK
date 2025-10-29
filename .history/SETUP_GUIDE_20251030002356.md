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

Tarayıcınızda `http://localhost:3000` adresini açın.

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

