# PM Logbook - Geliştirme Planı

---

## 🏢 Proje Hakkında

Bu uygulama, **profesyonel bir havacılık/motor bakım şirketi** için geliştirilmektedir. Uygulama, **enterprise-level** bir çözüm olarak tasarlanmakta olup aşağıdaki kritik gereksinimleri karşılamalıdır:

### 🎯 Temel Gereksinimler

- **🔒 Güvenlik:** Production-grade güvenlik standartları (şifre hashleme, JWT authentication, audit logging, role-based access control)
- **⚡ Performans:** Hızlı yükleme süreleri, optimize edilmiş veritabanı sorguları, caching mekanizmaları, lazy loading
- **🎨 UI/UX:** Modern, kullanıcı dostu, responsive design, accessibility standartları (WCAG 2.1), intuitive navigation
- **📊 Veri İzlenebilirliği:** Tüm işlemlerin loglanması, audit trail, change history
- **🔄 Güvenilirlik:** Error handling, backup/restore, data validation, retry mechanisms
- **📈 Ölçeklenebilirlik:** Büyüyen veri setleri için hazır altyapı

### 📋 Geliştirme Önceliklendirmesi

**DEMO İÇİN ÖNCELİKLİ ÖZELLIKLER (İlk Faz):**
Bu özellikler müşteri demosunda gösterilecek ve şirketin core business ihtiyaçlarını karşılamaktadır:

1. ✅ **Engines Sekmesi İyileştirmeleri** (En Yüksek Öncelik)
2. ✅ **Tests Sekmesi - Otomatik Saat Güncelleme**
3. ✅ **Assembler (Montaj) Sekmesi - Swap İyileştirmeleri**

**TEKNİK İYİLEŞTİRMELER (İkinci Faz):**
Demo sonrası, production-ready hale getirmek için uygulanacak:

1. 🔒 Güvenlik iyileştirmeleri (bcrypt, JWT, input validation)
2. ⚡ Performans optimizasyonları (memo, caching, pagination)
3. 🐛 Bug fix'ler ve code quality iyileştirmeleri
4. 🧪 Test coverage (unit, integration, e2e tests)
5. 📚 Dokümantasyon ve API documentation

---

## 📊 Mevcut Durum Analizi

### ✅ Çalışan Özellikler
1. ✅ Kullanıcı kimlik doğrulama (Login/Logout)
2. ✅ Dashboard - Motor özeti ve lifecycle uyarıları
3. ✅ Motor listesi görüntüleme ve detay sayfası
4. ✅ Test aktiviteleri kaydetme, güncelleme, silme
5. ✅ Arıza bildirimi kaydetme, güncelleme, silme
6. ✅ Komponent swap kayıtları
7. ✅ Envanter yönetimi (ekleme, silme)
8. ✅ SQLite veritabanı entegrasyonu
9. ✅ RESTful API backend

### ❌ Eksik/Tamamlanmamış Özellikler

#### 1. **Reports Modülü** (Öncelik: YÜ KSEK)
**Durum:** Sadece placeholder, hiçbir fonksiyon yok
**Gerekli:**
- Motor fillosu durum raporu
- Komponent lifecycle raporu
- Arıza geçmişi raporu
- Test aktivitesi özeti
- PDF/Excel export

#### 2. **Motor Ekleme/Düzenleme** (Öncelik: YÜKSEK)
**Durum:** "Add Engine" butonu var ama işlevsel değil
**Gerekli:**
- Motor ekleme modalı
- Motor bilgilerini düzenleme
- Status güncelleme (şu an sadece dropdown var ama kaydetmiyor)

#### 3. **Komponent Yönetimi** (Öncelik: ORTA)
**Durum:** Edit butonları var ama işlevsel değil
**Gerekli:**
- Komponent ekleme/çıkarma
- Komponent bilgilerini güncelleme
- Komponent geçmişi takibi

#### 4. **Doküman Yönetimi** (Öncelik: ORTA)
**Durum:** Backend API hazır, UI yok
**Gerekli:**
- Dosya yükleme (test raporları, arıza fotoğrafları)
- Dosya listeleme ve indirme
- Dosya önizleme

#### 5. **Swap Edit Fonksiyonu** (Öncelik: DÜŞÜK)
**Durum:** Assembler sayfasında edit butonu disabled
**Gerekli:**
- Swap kaydı düzenleme modalı

---

## 🚀 Rakip Uygulamalardan İlham

### CMMS (Computerized Maintenance Management System) Standart Özellikleri:

#### 1. **Dashboard İyileştirmeleri**
- **Grafikler ve Charts:**
  - Motor sağlık durumu pie chart
  - Zaman içinde test aktiviteleri (line chart)
  - Arıza sayıları trend analizi
  - Bakım maliyetleri grafiği
  
- **KPI Kartları:**
  - MTBF (Mean Time Between Failures)
  - MTTR (Mean Time To Repair)
  - Bakım maliyetleri
  - Disponibilite oranı

#### 2. **Bakım Planlaması**
- Otomatik bakım hatırlatıcıları
- Periyodik bakım takvimi
- Work order sistemi
- Bakım checklist'leri

#### 3. **Gelişmiş Arama ve Filtreleme**
- Global arama (tüm modüllerde)
- Gelişmiş filtreler
- Kayıtlı filtreler/aramalar
- Quick filters

#### 4. **Bildirimler Sistemi**
- Bakım zamanı yaklaşınca bildiri
- Kritik arıza bildirimleri
- Stok seviyesi uyarıları
- E-posta bildirimleri

#### 5. **İstatistik ve Analitik**
- Motor performans metrikleri
- Maliyet analizi
- Pareto analizi (en sık arızalanan parçalar)

#### 6. **Mobil Uyumluluk**
- Responsive design
- QR kod ile hızlı erişim
- Offline mod desteği

#### 7. **İzlenebilirlik ve Denetim**
- Audit log (kim ne değiştirdi)
- Değişiklik geçmişi
- Veri backup/restore

#### 8. **Entegrasyonlar**
- Barcode/QR kod okuyucu
- ERP sistemleri entegrasyonu

---

## 🎯 Öncelikli Geliştirmeler (Faz 1)

### 1. Reports Modülü İmplementasyonu
**Süre:** 2-3 gün
**Özellikler:**
- Fleet status raporu
- Fault history raporu
- Test summary raporu
- PDF export

### 2. Motor Ekleme/Düzenleme
**Süre:** 1-2 gün
**Özellikler:**
- Add Engine modalı
- Edit Engine modalı
- Validation
- API entegrasyonu

### 3. Dashboard Grafikleri
**Süre:** 2-3 gün
**Kütüphaneler:** Recharts veya Chart.js
**Grafikler:**
- Motor durumu pie chart
- Test aktiviteleri zaman serisi
- Arıza trendleri

### 4. Gelişmiş Filtreleme
**Süre:** 1 gün
**Özellikler:**
- Tarih aralığı filtresi
- Status filtresi
- Search box (tüm sayfalarda)

---

## 🔧 Teknik İyileştirmeler

### 1. SQLite Optimizasyonu
```sql
-- İndeksler ekle
CREATE INDEX idx_tests_engineId ON tests(engineId);
CREATE INDEX idx_tests_testDate ON tests(testDate);
CREATE INDEX idx_faults_engineId ON faults(engineId);
CREATE INDEX idx_faults_status ON faults(status);
CREATE INDEX idx_swaps_engineId ON swaps(engineId);
```

### 2. API Performansı
- Response caching
- Pagination (şu an tüm data geliy or)
- Query optimizasyonu

### 3. Frontend Performansı
- React.memo kullanımı
- useMemo/useCallback optimizasyonları
- Lazy loading (code splitting)
- Virtual scrolling (uzun listeler için)

### 4. Hata Yönetimi
- Global error boundary
- API error handling
- User-friendly error messages
- Retry mekanizması

### 5. Güvenlik
- Input validation (frontend + backend)
- SQL injection koruması (✅ parametreli sorgular var)
- XSS koruması
- Rate limiting
- JWT authentication (şu anda basic auth)

---

## 📈 İleri Seviye Özellikler (Faz 2)

### 1. Predictive Maintenance
- Machine learning ile arıza tahmini
- Anomali tespiti
- Optimal bakım zamanı önerisi

### 2. Real-time Monitoring
- WebSocket entegrasyonu
- Gerçek zamanlı sensör verileri
- Canlı dashboard güncellemeleri

### 3. Multi-tenancy
- Farklı şirketler/departmanlar için ayrı alanlar
- Veri izolasyonu

### 4. Gelişmiş Raporlama
- Custom report builder
- Scheduled reports
- Email reports

### 5. Mobile App
- React Native ile mobil uygulama
- Barcode/QR kod tarama
- Offline sync

---

## 🛠️ Kullanılabilecek Kütüphaneler

### Frontend
- **Recharts** - Grafikler ve charts
- **React-PDF** - PDF oluşturma
- **XLSX** - Excel export
- **React-Query** - Gelişmiş data fetching ve caching
- **React-Hook-Form** - Form yönetimi
- **Zod** - Schema validation
- **date-fns** - Tarih işlemleri
- **React-Toastify** - Bildirimler

### Backend
- **node-cron** - Zamanlanmış görevler
- **nodemailer** - E-posta gönderimi
- **multer** - Dosya yükleme
- **express-validator** - Input validation
- **jsonwebtoken** - JWT auth
- **bcrypt** - Şifre hashleme

---

## 📝 Sonraki Adımlar

1. ✅ Mevcut durumu analiz et
2. ⏳ Öncelikli özellikleri belirle
3. ⏳ Reports modülünü geliştir
4. ⏳ Motor ekleme/düzenleme ekle
5. ⏳ Dashboard grafiklerini ekle
6. ⏳ Doküman yönetimini tamamla
7. ⏳ Gelişmiş filtreleme ekle
8. ⏳ Bildirimler sistemini kur
9. ⏳ Performans optimizasyonları yap
10. ⏳ Test coverage artır

---

## 🎨 UI/UX İyileştirmeleri

1. **Loading states** - Skeleton screens
2. **Empty states** - Veri olmadığında gösterilecek güzel mesajlar
3. **Success/Error toasts** - İşlem geri bildirimleri
4. **Confirm dialogs** - Silme işlemlerinde onay
5. **Keyboard shortcuts** - Power user'lar için
6. **Dark/Light mode** - Tema değiştirme
7. **Responsive design** - Mobil uyumluluk
8. **Accessibility** - WCAG standartları

---

## 📊 Rakip Analizi

### Benzer Uygulamalar:
1. **Flightdocs** - Aviation maintenance tracking
2. **Camp Systems** - Aircraft maintenance management
3. **UpKeep** - Modern CMMS
4. **Fiix** - Cloud-based CMMS
5. **Maintenance Connection** - Enterprise CMMS

### Öne Çıkan Özellikler:
- Mobile-first approach
- Barcode/QR integration
- Predictive analytics
- Comprehensive reporting
- Asset hierarchy
- Work order management
- Vendor management
- Compliance tracking

---

## 💡 Hemen Başlanabilecek Kolay Geliştirmeler

1. **Loading spinners** - useQuery'lerde loading state'i göster
2. **Toast notifications** - İşlem başarılı/hatalı mesajları
3. **Confirm dialogs** - Silme işlemlerinde "Emin misiniz?"
4. **Search boxes** - Her tabloya arama kutusu
5. **Date formatters** - Tarih formatını düzelt (DD.MM.YYYY)
6. **Empty states** - Veri yoksa güzel mesaj göster
7. **Pagination** - Uzun listelere sayfalama
8. **Sort columns** - Tablo başlıklarına sıralama
9. **Export CSV** - Basit export özelliği
10. **Print view** - Yazdırma için optimize edilmiş görünüm

---

## 🔍 Detaylı Kod İnceleme Raporu

### 📊 Kod Kalitesi Değerlendirmesi

| Kategori | Puan | Durum | Notlar |
|----------|------|-------|--------|
| **Mimari & Yapı** | 8/10 | ✅ İyi | Temiz, modüler yapı. Katmanlı mimari mevcut |
| **Type Safety** | 7/10 | ⚠️ Orta | Bazı type eksiklikleri var (location field vb.) |
| **Güvenlik** | 4/10 | ❌ Kritik | Şifre hashleme yok, plain text şifreler |
| **Hata Yönetimi** | 5/10 | ⚠️ Orta | Basit error handling, geliştirilebilir |
| **Performans** | 6/10 | ⚠️ Orta | Pagination yok, optimizasyon eksik |
| **UI/UX** | 8/10 | ✅ İyi | Modern, kullanışlı arayüz |
| **Dokümantasyon** | 7/10 | ✅ İyi | README var, inline comments az |
| **Test Coverage** | 0/10 | ❌ Yok | Hiç test yok |

**Genel Ortalama: 5.6/10** - İyi bir temel var, production için iyileştirme gerekli

### 🐛 Tespit Edilen Kritik Sorunlar

#### 1. Güvenlik Açıkları (KRİTİK - İkinci Fazda Düzeltilecek)

```typescript
// types.ts - Line 6
passwordHash: string; // In a real app, this would be a hash
```
❌ **Sorun:** Plain text şifre saklama
⚠️ **Risk Seviyesi:** YÜKSEK
✅ **Çözüm (Faz 2):** bcrypt kullanarak şifre hashleme

```javascript
// database.js - Sample data
{ username: 'admin', passwordHash: 'adminpass' }
```
❌ **Sorun:** Hardcoded plain text şifreler
⚠️ **Risk Seviyesi:** YÜKSEK
✅ **Çözüm (Faz 2):** bcrypt hash'leri kullan

#### 2. API ve Backend Sorunları (Faz 1'de Düzeltilecek)

**Tests.tsx - Line 4:**
```typescript
import { documentsApi } from '../lib/client.ts';
import { documentsApi as newDocsApi } from '../lib/newApis.ts';
```
❌ **Sorun:** Duplicate import, ilk import kullanılmıyor
✅ **Çözüm:** İlk import'u kaldır

**server/routes/api.js - POST /tests endpoint:**
```javascript
// Line 176 - brakeType parametresi backend'de eksik
const { engineId, testType, testCell, ... } = req.body;
// brakeType alınmıyor ama veritabanında kolon var
```
❌ **Sorun:** Frontend brakeType gönderiyor ama backend kaydetmiyor
✅ **Çözüm:** Backend'e brakeType parametresi ekle

**Reports.tsx - Lines 59, 70:**
```typescript
'Location': e.location
```
❌ **Sorun:** Engine type'ında location field'ı yok
✅ **Çözüm:** Engine interface'ine location ekle veya kaldır

#### 3. İşlevsel Eksiklikler (Faz 1'de Tamamlanacak)

**Engines.tsx - Line 250:**
```typescript
<select defaultValue={engine.status} className="...">
```
❌ **Sorun:** Status dropdown çalışmıyor (onChange handler yok)
✅ **Çözüm:** onChange handler ekle ve API call yap

**Engines.tsx - Line 166:**
```typescript
<button className="..."><PencilIcon /></button>
```
❌ **Sorun:** Component edit butonu disabled
✅ **Çözüm:** Edit fonksiyonalitesi ekle

**Assembler.tsx:**
❌ **Sorun:** Swap edit butonu çalışmıyor
✅ **Çözüm:** Edit modalı ve API entegrasyonu

#### 4. Performans Sorunları (Faz 2'de Optimize Edilecek)

- ❌ Pagination yok (tüm veri bir anda yükleniyor)
- ❌ React.memo kullanımı yok
- ❌ useMemo/useCallback optimizasyonları eksik
- ❌ Lazy loading/code splitting yok
- ❌ Virtual scrolling eksik (uzun listeler için)

#### 5. Eksik Error Handling (Faz 2'de İyileştirilecek)

```typescript
catch (error) {
  console.error(error);
  return null;
}
```
❌ **Sorunlar:**
- Global error boundary yok
- Retry mekanizması yok
- Error logging/monitoring yok
- User-friendly error messages eksik

---

## 🎯 DEMO İÇİN GELİŞTİRME PLANI (FAZ 1)

### 🔧 1. ENGINES SEKMESİ İYİLEŞTİRMELERİ

#### 1.1 Engine Information - Edit Butonu Aktivasyonu

**Amaç:** Engine bilgilerini düzenleyebilme
**Süre:** 2-3 saat

**Değişiklikler:**
- ✅ Edit butonu onClick handler ekle
- ✅ EngineModal component'ini kullan (zaten mevcut)
- ✅ Status dropdown'ı çalışır hale getir
- ✅ API entegrasyonu (PUT /api/engines/:id)

**Dosyalar:**
- `pages/Engines.tsx` - handleEditEngine fonksiyonu ekle
- `components/EngineModal.tsx` - Güncelleme yapılmayacak (zaten hazır)

---

#### 1.2 Build Report (BR) Excel Import Özelliği

**Amaç:** Motor için Build Report dökümanını yükleyerek motor parça yapısını toplu güncelleme

**Excel Yapısı:**
```
| Alt Assy İsmi | Alt Assy P/N | Alt Assy S/N | Parça İsmi | Parça P/N | Parça S/N | Çalışma Saati | Parça Ömrü |
|---------------|--------------|--------------|------------|-----------|-----------|---------------|------------|
| Hava Hattı    | AM-100       | AM100-001    | Manifold   | PC-201    | PC201-123 | 150.26        | 200        |
| Hava Hattı    | AM-100       | AM100-001    | Turbo      | PC-202    | PC202-456 | 150.26        | 200        |
| Yakıt Hattı   | AM-200       | AM200-005    | Enjektör   | PC-301    | PC301-789 | 150.26        | 200        |
| -             | -            | -            | Dişli      | PC-401    | PC401-999 | 150.26        | 200        |
```

**Hiyerarşi Yapısı:**
1. **Alt Assembly (Opsiyonel):** Ana grup (Hava Hattı, Yakıt Hattı vb.)
   - Alt Assy İsmi, Alt Assy Parça Numarası, Alt Assy Seri Numarası
   
2. **Parça (Zorunlu):** Tekli parça veya alt assembly'nin altındaki parçalar
   - Parça İsmi, Parça Numarası, Parça Seri Numarası, Çalışma Saati, Parça Ömrü

**İş Mantığı:**

**Senaryo 1: İlk BR Yükleme**
- Motor için ilk kez BR yükleniyorsa → Tüm parçalar sisteme eklenir
- Hiyerarşik yapı oluşturulur (Alt Assy → Parçalar)
- Motor'un `components` array'i güncellenir

**Senaryo 2: Güncellenmiş BR Yükleme**
- Aynı motor için ikinci kez BR yüklenirse:
  - Mevcut parçalar yeni BR'ye göre güncellenir
  - Eklenen parçalar → Sisteme eklenir
  - Kaldırılan parçalar → Sistemden kaldırılır (veya arşivlenir)
  - Değiştirilen parçalar → Bilgileri güncellenir

**Teknik Detaylar:**

```typescript
// Build Report Interface
interface BuildReportRow {
  altAssyIsmi?: string;          // Opsiyonel (- ise tekli parça)
  altAssyPartNumber?: string;
  altAssySerialNumber?: string;
  parcaIsmi: string;             // Zorunlu
  parcaNumarasi: string;         // Zorunlu
  parcaSeriNumarasi: string;     // Zorunlu
  calismaaSaati: number;         // Zorunlu
  parcaOmru: number;             // Zorunlu (0 = sınırsız)
}

// Parser Fonksiyonu
function parseBuildReport(excelFile: File): BuildReportRow[] {
  // XLSX kütüphanesi ile Excel'i parse et
  // Her satırı BuildReportRow'a dönüştür
  // Validasyon yap (zorunlu alanlar dolu mu?)
  // Return parsed data
}

// Component Yapısı Oluşturucu
function buildComponentTree(rows: BuildReportRow[]): Component[] {
  // Alt Assy gruplarını belirle
  // Her Alt Assy için children array'i oluştur
  // Tekli parçaları root level'a ekle
  // Return hierarchical component tree
}

// Motor Güncelleme Fonksiyonu
async function updateEngineFromBR(
  engineId: number, 
  components: Component[]
): Promise<void> {
  // Mevcut components ile yeni components'i karşılaştır
  // Değişiklikleri tespit et (added, removed, updated)
  // Engine API'sini çağır (PUT /api/engines/:id)
  // Activity log'a kaydet: "Build Report updated - XX parts added, YY parts updated"
}
```

**API Değişiklikleri:**

Yeni endpoint gerekmez, mevcut PUT /api/engines/:id kullanılır:
```javascript
// PUT /api/engines/:id
{
  components: [
    {
      id: 1,
      description: "Hava Hattı",
      partNumber: "AM-100",
      serialNumber: "AM100-001",
      currentHours: 150.26,
      lifeLimit: 0,
      children: [
        {
          id: 100,
          description: "Manifold",
          partNumber: "PC-201",
          serialNumber: "PC201-123",
          currentHours: 150.26,
          lifeLimit: 200
        }
      ]
    }
  ]
}
```

**UI Değişiklikleri:**

`pages/Engines.tsx` - Engine Details sayfasına eklenecek:

```tsx
// Engine Information card'ının altına yeni bir section
<div className="bg-brand-card p-4 rounded-lg border border-brand-border">
  <h3 className="text-lg font-bold text-white mb-4">Build Report Import</h3>
  <div className="space-y-4">
    <div className="flex items-center gap-4">
      <input 
        type="file" 
        accept=".xlsx,.xls"
        onChange={handleBRFileSelect}
        ref={fileInputRef}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="bg-brand-primary hover:bg-blue-600 px-4 py-2 rounded-md"
      >
        📊 Import Build Report (Excel)
      </button>
      {selectedFile && (
        <span className="text-brand-light">{selectedFile.name}</span>
      )}
    </div>
    
    {selectedFile && (
      <button
        onClick={handleBRUpload}
        className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-md"
      >
        ✅ Upload & Update Engine
      </button>
    )}
    
    <div className="text-sm text-brand-light">
      <p>📝 Excel formatı:</p>
      <p className="ml-4">• Alt Assy İsmi | Alt Assy P/N | Alt Assy S/N | Parça İsmi | Parça P/N | Parça S/N | Çalışma Saati | Parça Ömrü</p>
      <p className="ml-4">• Tekli parçalar için Alt Assy kolonları boş bırakılabilir</p>
    </div>
  </div>
</div>
```

**Uygulama Adımları:**

1. ✅ XLSX kütüphanesi kurulu (zaten var - package.json'da)
2. ✅ Excel parser fonksiyonu yaz (`utils/excelParser.ts`)
3. ✅ Component tree builder fonksiyonu yaz
4. ✅ BR upload UI'ı ekle (Engines.tsx)
5. ✅ handleBRUpload fonksiyonu ekle
6. ✅ Validasyon ve error handling
7. ✅ Success/error toast notifications
8. ✅ Activity log'a BR update kaydı

**Süre Tahmini:** 1 gün (8 saat)

---

### 🧪 2. TESTS SEKMESİ - OTOMATİK SAAT GÜNCELLEME

**Amaç:** Test eklendiğinde motor ve parça saatlerini otomatik güncelleme

**Mevcut Durum:**
```typescript
// Tests.tsx - Line 56-82
const handleLogSubmit = async (e: React.FormEvent) => {
  // Test oluştur
  await testsApi.create({...});
  
  // Motor saatini güncelle
  const newTotalHours = engine.totalHours + duration;
  await enginesApi.update(engineId, { totalHours: newTotalHours });
}
```
✅ **Motor saati güncelleniyor**
❌ **Parça saatleri güncellenmiyor**

**Yeni İş Mantığı:**

Test kaydedildiğinde:
1. ✅ Motor `totalHours` güncellenir (zaten yapılıyor)
2. ✅ Motor `totalCycles` +1 artırılır (yeni)
3. ✅ Motor üzerindeki **tüm parçaların** `currentHours` güncellenir (yeni)
4. ✅ Parça saati life limit'i aştıysa warning göster (yeni)

**Teknik Uygulama:**

```typescript
const handleLogSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  try {
    // 1. Test oluştur
    const createdTest = await testsApi.create({...});
    
    // 2. Motor bilgisini al
    const engine = engines?.find(e => e.id === parseInt(newTest.engineId));
    if (!engine) throw new Error('Engine not found');
    
    const duration = parseFloat(newTest.duration);
    
    // 3. Tüm parça saatlerini güncelle
    const updatedComponents = updateComponentHours(
      engine.components, 
      duration
    );
    
    // 4. Life limit kontrolü
    const exceedingParts = checkLifeLimits(updatedComponents);
    if (exceedingParts.length > 0) {
      showWarning(
        `⚠️ ${exceedingParts.length} parça life limit'i aştı veya yaklaştı!`
      );
    }
    
    // 5. Motor güncelle
    await enginesApi.update(engine.id, {
      totalHours: engine.totalHours + duration,
      totalCycles: engine.totalCycles + 1,
      components: updatedComponents
    });
    
    showSuccess('Test logged and engine hours updated!');
    refetch();
  } catch (error) {
    showError('Failed to log test');
  }
};

// Recursive parça saati güncelleme
function updateComponentHours(
  components: Component[], 
  additionalHours: number
): Component[] {
  return components.map(comp => ({
    ...comp,
    currentHours: comp.currentHours + additionalHours,
    children: comp.children 
      ? updateComponentHours(comp.children, additionalHours)
      : undefined
  }));
}

// Life limit kontrolü
function checkLifeLimits(components: Component[]): Component[] {
  const exceeding: Component[] = [];
  
  function traverse(comps: Component[]) {
    comps.forEach(comp => {
      if (comp.lifeLimit > 0) {
        const remaining = comp.lifeLimit - comp.currentHours;
        if (remaining <= 0) {
          exceeding.push(comp);
        } else if (remaining <= 50) { // 50 saat altı uyarı
          exceeding.push(comp);
        }
      }
      if (comp.children) traverse(comp.children);
    });
  }
  
  traverse(components);
  return exceeding;
}
```

**UI İyileştirmeleri:**

Test log formunun altına bilgilendirme ekle:
```tsx
<div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-3 text-sm">
  <p className="font-semibold text-blue-400">ℹ️ Otomatik Güncellemeler:</p>
  <ul className="list-disc list-inside text-brand-light ml-2 mt-1">
    <li>Motor toplam saati güncellenecek</li>
    <li>Motor cycle sayısı +1 artırılacak</li>
    <li>Motor üzerindeki tüm parça saatleri güncellenecek</li>
    <li>Life limit aşan parçalar için uyarı verilecek</li>
  </ul>
</div>
```

**Süre Tahmini:** 3-4 saat

---

### 🔧 3. ASSEMBLER (MONTAJ) SEKMESİ - SWAP İYİLEŞTİRMELERİ

**Amaç:** Parça takma/çıkarma işlemlerinde motor components'ini otomatik güncelleme

**Mevcut Durum:**
- ✅ Swap kaydı oluşturuluyor
- ❌ Motor üzerindeki parçalar güncellenmiyor
- ❌ Takılan/çıkarılan parçaların saatleri senkronize değil

**Yeni İş Mantığı:**

**Senaryo 1: Tek Parça Değişimi**
```
Motor: PD170
Çıkarılan: PC-201 (S/N: PC201-123) - 150.26 saat
Takılan: PC-201 (S/N: PC201-999) - 0 saat (yeni parça)
```

İşlem:
1. Motor'dan PC201-123 kaldırılır
2. PC201-999 motor'a eklenir (`currentHours` = motor'un total hours)
3. Swap kaydı oluşturulur
4. Activity log'a eklenir

**Senaryo 2: Alt Assembly Değişimi**
```
Motor: PD170
Çıkarılan Alt Assy: AM-100 (Hava Hattı) - içinde 3 parça
Takılan Alt Assy: AM-100 (Hava Hattı - Yeni) - içinde 3 parça
```

İşlem:
1. Eski alt assy ve tüm children'ı kaldırılır
2. Yeni alt assy ve children'ı eklenir
3. Tüm parçaların `currentHours` motor saati ile senkronize edilir

**Teknik Uygulama:**

```typescript
// Assembler.tsx - handleSwapSubmit
const handleSwapSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  try {
    const engine = engines?.find(e => e.id === parseInt(swap.engineId));
    if (!engine) throw new Error('Engine not found');
    
    // 1. Swap kaydı oluştur
    const swapRecord = await swapsApi.create({
      engineId: swap.engineId,
      componentInstalledId: swap.componentInstalledId,
      componentRemovedId: swap.componentRemovedId,
      swapDate: new Date().toISOString(),
      swapType: swap.swapType, // 'Component' veya 'Assembly'
      assemblyGroup: swap.assemblyGroup, // Opsiyonel
      userName: user.fullName
    });
    
    // 2. Motor components'ini güncelle
    const updatedComponents = performSwapOnEngine(
      engine.components,
      swap.componentRemovedId,
      swap.componentInstalledId,
      engine.totalHours,
      swap.swapType
    );
    
    // 3. Motor API'sini güncelle
    await enginesApi.update(engine.id, {
      components: updatedComponents
    });
    
    showSuccess('Swap completed and engine updated!');
    refetch();
  } catch (error) {
    showError('Failed to complete swap');
  }
};

// Swap işlemi
function performSwapOnEngine(
  components: Component[],
  removedId: number,
  installedId: number,
  engineTotalHours: number,
  swapType: 'Component' | 'Assembly'
): Component[] {
  // Warehouse'dan takılan parçayı al
  const installedComponent = inventory.find(i => i.id === installedId);
  if (!installedComponent) throw new Error('Installed component not found');
  
  // Takılan parçanın saatini motor saati ile senkronize et
  const newComponent: Component = {
    id: installedComponent.id,
    description: installedComponent.description,
    partNumber: installedComponent.partNumber,
    serialNumber: installedComponent.serialNumber,
    currentHours: engineTotalHours,
    lifeLimit: installedComponent.lifeLimit || 0,
    children: []
  };
  
  // Çıkarılan parçayı bul ve değiştir
  return replaceComponent(components, removedId, newComponent);
}

// Recursive component replacement
function replaceComponent(
  components: Component[],
  removeId: number,
  newComponent: Component
): Component[] {
  return components.map(comp => {
    if (comp.id === removeId) {
      return newComponent;
    }
    if (comp.children) {
      return {
        ...comp,
        children: replaceComponent(comp.children, removeId, newComponent)
      };
    }
    return comp;
  });
}
```

**Ek Özellik: Assembly Group Swap**

Assembly group seçildiğinde, o gruptaki tüm parçalar birlikte değiştirilir:

```typescript
function replaceAssemblyGroup(
  components: Component[],
  assemblyGroup: string,
  newAssembly: Component
): Component[] {
  return components.map(comp => {
    if (comp.description === assemblyGroup) {
      // Tüm assembly'i değiştir
      return {
        ...newAssembly,
        currentHours: engineTotalHours,
        children: newAssembly.children?.map(child => ({
          ...child,
          currentHours: engineTotalHours
        }))
      };
    }
    return comp;
  });
}
```

**UI İyileştirmeleri:**

```tsx
// Swap form'una bilgilendirme ekle
<div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 text-sm">
  <p className="font-semibold text-yellow-400">⚠️ Swap İşlemi:</p>
  <ul className="list-disc list-inside text-brand-light ml-2 mt-1">
    <li>Çıkarılan parça motor'dan kaldırılacak</li>
    <li>Takılan parça motor'a eklenecek</li>
    <li>Takılan parçanın saati motor saati ile senkronize edilecek</li>
    <li>Activity log'a swap kaydı eklenecek</li>
  </ul>
</div>

// Assembly group seçimi için dropdown
{swap.swapType === 'Assembly' && (
  <select
    value={swap.assemblyGroup}
    onChange={e => setSwap({...swap, assemblyGroup: e.target.value})}
    className="bg-brand-dark border border-brand-border rounded-md p-2"
  >
    <option value="">-- Select Assembly Group --</option>
    {getAssemblyGroups(engine).map(group => (
      <option key={group} value={group}>{group}</option>
    ))}
  </select>
)}
```

**Süre Tahmini:** 4-5 saat

---

### 📝 FAZ 1 TOPLAM SÜRE TAHMİNİ

| Özellik | Süre |
|---------|------|
| 1. Engines - Edit Button | 2-3 saat |
| 2. Engines - BR Import | 8 saat |
| 3. Tests - Auto Hour Update | 3-4 saat |
| 4. Assembler - Swap Improvements | 4-5 saat |
| **TOPLAM** | **17-20 saat (~2.5 gün)** |

---

## 🔧 TEKNİK İYİLEŞTİRMELER (FAZ 2 - Demo Sonrası)

### 1. Güvenlik İyileştirmeleri

#### 1.1 Şifre Hashleme (bcrypt)
**Öncelik:** KRİTİK

```javascript
// server/routes/auth.js (yeni)
const bcrypt = require('bcrypt');

// Şifre hashleme
const hashedPassword = await bcrypt.hash(plainPassword, 10);

// Şifre doğrulama
const isValid = await bcrypt.compare(plainPassword, hashedPassword);
```

**Değişecek Dosyalar:**
- `server/database.js` - Sample users'ın şifrelerini hash'le
- `server/routes/api.js` - User creation'da hashleme ekle
- Login sayfası - Şifre doğrulama

**Süre:** 2-3 saat

#### 1.2 JWT Authentication
**Öncelik:** YÜKSEK

```javascript
const jwt = require('jsonwebtoken');

// Token oluştur
const token = jwt.sign(
  { userId: user.id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '8h' }
);

// Token doğrula (middleware)
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

**Süre:** 4-5 saat

#### 1.3 Input Validation
**Öncelik:** ORTA

```javascript
const { body, validationResult } = require('express-validator');

// Validation middleware
const validateEngineCreation = [
  body('serialNumber').notEmpty().trim(),
  body('model').notEmpty().trim(),
  body('totalHours').isNumeric().toFloat(),
  // ...
];

router.post('/engines', validateEngineCreation, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // ...
});
```

**Süre:** 3-4 saat

---

### 2. Performans Optimizasyonları

#### 2.1 Pagination
**Öncelik:** ORTA

```typescript
// Backend
router.get('/tests', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  
  const tests = await dbAll(
    'SELECT * FROM tests ORDER BY testDate DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );
  
  const total = await dbGet('SELECT COUNT(*) as count FROM tests');
  
  res.json({
    data: tests,
    pagination: {
      page,
      limit,
      total: total.count,
      pages: Math.ceil(total.count / limit)
    }
  });
});
```

**Süre:** 4-5 saat (tüm liste sayfaları için)

#### 2.2 React Optimizasyonları

```typescript
// React.memo
const EngineCard = React.memo(({ engine, onSelect }) => {
  // ...
});

// useMemo
const filteredTests = useMemo(() => {
  return tests?.filter(t => t.engineId === selectedEngineId);
}, [tests, selectedEngineId]);

// useCallback
const handleSelect = useCallback((engine) => {
  setSelectedEngine(engine);
}, []);
```

**Süre:** 3-4 saat

---

### 3. Bug Fix'ler

#### 3.1 brakeType Backend Desteği
```javascript
// server/routes/api.js - Line 174
router.post('/tests', async (req, res) => {
  const { 
    engineId, testType, brakeType, testCell, 
    description, duration, testDate, documentId, userName 
  } = req.body;
  
  await dbRun(
    'INSERT INTO tests (engineId, testType, brakeType, testCell, ...) VALUES (?, ?, ?, ?, ...)',
    [engineId, testType, brakeType, testCell, ...]
  );
});
```

**Süre:** 30 dakika

#### 3.2 Duplicate Import Düzeltmesi
```typescript
// Tests.tsx - Line 3-4
// ❌ Kaldır: import { documentsApi } from '../lib/client.ts';
import { testTypesApi, brakeTypesApi, documentsApi } from '../lib/newApis.ts';
```

**Süre:** 5 dakika

#### 3.3 Engine location Field
```typescript
// types.ts - Engine interface
export interface Engine {
  id?: number;
  model: string;
  serialNumber: string;
  status: 'Active' | 'Maintenance Due' | 'AOG';
  totalHours: number;
  totalCycles: number;
  nextServiceDue: number | string;
  manufacturer: string;
  location?: string; // YENİ
  components: Component[];
  activityLog: ActivityLogItem[];
}
```

**Süre:** 10 dakika

---

### 4. Test Coverage

```typescript
// tests/engine.test.ts
describe('Engine API', () => {
  test('should create new engine', async () => {
    const engine = await enginesApi.create({
      model: 'TEST-100',
      serialNumber: 'TEST-001',
      // ...
    });
    expect(engine.id).toBeDefined();
  });
  
  test('should update engine hours after test', async () => {
    // ...
  });
});
```

**Süre:** 2-3 gün (kapsamlı test coverage için)

---

## 📋 FAZ 2 TOPLAM SÜRE TAHMİNİ

| Kategori | Süre |
|----------|------|
| Güvenlik İyileştirmeleri | 9-12 saat |
| Performans Optimizasyonları | 7-9 saat |
| Bug Fix'ler | 1 saat |
| Test Coverage | 16-24 saat |
| **TOPLAM** | **33-46 saat (~5-6 gün)** |

---

## 🎯 ÖNCELİKLENDİRME ÖZETİ

### Demo Öncesi (Faz 1) - 2.5 Gün
1. ✅ Engines - Edit & BR Import
2. ✅ Tests - Auto Hour Update
3. ✅ Assembler - Swap Improvements

### Demo Sonrası (Faz 2) - 5-6 Gün
1. 🔒 Güvenlik (bcrypt, JWT, validation)
2. ⚡ Performans (pagination, memo, caching)
3. 🐛 Bug fixes
4. 🧪 Testing

### Uzun Vadeli (Faz 3) - İhtiyaca Göre
1. 📱 Mobile app
2. 🤖 Predictive maintenance
3. 📊 Advanced analytics
4. 🔔 Real-time notifications

