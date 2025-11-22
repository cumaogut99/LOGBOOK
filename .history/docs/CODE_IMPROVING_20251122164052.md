# PM Logbook - Kod İyileştirme ve Geliştirme Raporu

**Tarih:** 22 Kasım 2025  
**Hazırlayan:** AI Kod Analiz Sistemi  
**Proje:** PM Logbook - Preventive Maintenance Tracking System

---

## 📋 YÖNETİCİ ÖZETİ

PM Logbook, motor bakım takibi için geliştirilmiş orta-büyük ölçekli bir web uygulamasıdır. Genel kalite **orta-iyi** seviyededir, ancak kurumsal ortamda kullanım öncesi **kritik güvenlik, stabilite ve entegrasyon iyileştirmeleri** gerekmektedir.

Bu döküman, mevcut kod tabanının analizi, eksiklikler ve kurumsal entegrasyon için gerekli adımları içerir.

---

## 🏢 KURUMSAL ENTEGRASYON VE GENİŞLEME PLANI (YENİ)

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
*   Kaç eşzamanlı kullanıcı bekleniyor? (10-50-100+?)

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
| **Network Erişim** | ❌ Sadece lokal | ✅ Ağ üzerinden erişim |
| **JSON Desteği** | ✅ JSON1 extension ile | ✅ Native JSONB (Çok güçlü) |
| **Full-Text Search** | ✅ FTS5 | ✅ Native + GIN Index |
| **Migration Kolaylığı** | ✅ Kolay | ⚠️ Schema migration araçları (Prisma, TypeORM) gerekli |

#### ✅ SQLite Kullanım Senaryoları (Uygun)
1.  **Küçük Ekipler:** 5-10 kullanıcı, aynı anda 2-3 kişi aktif.
2.  **Tek Sunucu:** Uygulama ve DB aynı makinede.
3.  **Veri Boyutu:** < 10 GB.
4.  **IT Altyapısı Yok:** DBA ekibi olmayan, basit backup ihtiyacı olan ortamlar.
5.  **Hızlı Deployment:** Docker container ile kolayca taşınabilir.

#### ⚠️ PostgreSQL'e Geçiş Gerektiren Durumlar (Önerilen)
1.  **Çok Kullanıcılı:** 20+ eşzamanlı kullanıcı.
2.  **Veri Büyümesi:** Yıllar içinde 10GB+ veri beklentisi.
3.  **Network Erişim:** Farklı lokasyonlardan (ofis/fabrika) erişim.
4.  **High Availability:** 7/24 kesintisiz hizmet kritik.
5.  **Kurumsal Standart:** Şirket zaten PostgreSQL altyapısına sahipse.
6.  **Gelecek Entegrasyonlar:** Başka sistemlerle veri paylaşımı (BI tools, SAP, vb.).

#### 🎯 Önerim (Hibrit Yaklaşım):
**Geliştirme:** SQLite (Hızlı, kolay test)  
**Production:** PostgreSQL (Ölçeklenebilir, güvenli, kurumsal)

**Geçiş Stratejisi:**
1.  Kod tabanında veritabanı soyutlama katmanı kullanılacak (Örn: **Sequelize ORM** veya **Prisma**).
2.  Böylece kod değişikliği minimalde kalır.
3.  Migration scriptleri hazırlanacak (SQLite -> PostgreSQL veri transferi).

**Eğer IT seçimi size bırakırsa:**
- **Kısa Vadeli (3-6 Ay):** SQLite ile devam edin, yedekleme sistemini güçlendirin.
- **Uzun Vadeli (1+ Yıl):** PostgreSQL'e geçiş planlayın. Şirket büyüyecekse, veri artacaksa bu kaçınılmaz.

**Migration Hazırlığı İçin:**
```bash
# ORM kullanımı ile DB bağımsızlığı
npm install sequelize pg sqlite3
# veya
npm install prisma @prisma/client
```

---

## 🔴 KRİTİK SORUNLAR (Acil Müdahale Gerekli)

### 1. GÜVENLİK AÇIKLARI
*   **Şifre Güvenliği:** Şifreler plain text saklanıyor. `bcrypt` entegrasyonu şart.
*   **Authentication:** JWT veya Session yapısı kurulmalı.
*   **API Güvenliği:** Endpoint'lerde yetki kontrolü yok. Middleware eklenmeli.

### 2. VERİTABANI
*   **JSON Veri Kaybı:** Kritik veriler JSON string olarak saklanıyor, ilişkisel tabloya geçilmeli.
*   **Transaction:** Parça değişimleri gibi çoklu tablo işlemlerinde `transaction` kullanılmalı.

### 3. HATA YÖNETİMİ
*   Backend hata mesajları çok genel, detaylandırılmalı.
*   Frontend'de Error Boundary eksik.

---

## 🎯 ÖNCELİKLİ EYLEM PLANI

### Faz 1: UI ve Fonksiyonel Kontrol (1 Hafta)
*   Mevcut UI fonksiyonlarının test edilmesi.
*   Hataların giderilmesi.
*   Kullanıcı deneyimi iyileştirmeleri.

### Faz 2: Kurumsal Entegrasyon Altyapısı (2-3 Hafta)
*   Authentication yapısının değiştirilmesi (SSO/LDAP hazırlığı).
*   Rol yönetimi arayüzünün kodlanması.
*   Excel import modülünün yazılması.

### Faz 3: Stabilite ve Güvenlik (2 Hafta)
*   Veritabanı yedekleme scriptlerinin yazılması.
*   Mail bildirim altyapısının kurulması.
*   Transaction yapısının kurulması.

### Faz 4: Test ve Yaygınlaştırma
*   Unit ve Integration testlerinin yazılması.
*   Pilot kullanım ve feedback toplama.

