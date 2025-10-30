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

