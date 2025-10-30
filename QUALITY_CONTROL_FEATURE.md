# Quality Control Özelliği

## 📋 Genel Bakış

Yeni **Quality Control** sekmesi eklendi! Kalite mühendisleri artık:
- ✅ Bekleyen testleri onaylayabilir
- ✅ Açık arızaları kapatabilir
- ✅ Toplu işlem yapabilir (çoklu seçim)
- ✅ Arama ve filtreleme yapabilir

## 🎯 Özellikler

### 1. **İki Sekme Sistemi**
- **Pending Tests**: Onay bekleyen testler
- **Open Faults**: Açık arızalar

### 2. **Toplu İşlemler**
- Checkbox ile çoklu seçim
- "Select All" / "Deselect All" butonu
- Toplu onaylama/kapatma

### 3. **Arama ve Filtreleme**
- Real-time arama
- Test type, engine, description'da arama
- Fault severity, description'da arama

### 4. **İstatistikler**
- Pending Tests sayısı
- Open Faults sayısı
- Seçili item sayısı

### 5. **Onay Sistemi**
- Test onaylandığında: `[APPROVED by Kullanıcı Adı]` eklenir
- Fault kapatıldığında: Status "Closed" olur + `[CLOSED by Kullanıcı Adı]` eklenir

## 👥 Yetkilendirme

**Erişim:**
- ✅ Administrator
- ✅ Quality Control Engineer

**Diğer roller:** Sadece görüntüleme (onaylama/kapatma yok)

## 🎨 UI/UX

### Renkler:
- **Pending Tests:** Mavi (Blue-400)
- **Open Faults:** Kırmızı (Red-400)
- **Selected Items:** Brand Primary
- **Approve Button:** Yeşil (Green-600)

### İkonlar:
- ✅ Checkmark icon (Quality Control)
- ☑️ Checkbox'lar (seçim için)
- 🔍 Search icon

## 📊 Kullanım Senaryoları

### Senaryo 1: Test Onaylama
1. Quality Control sekmesine git
2. "Pending Tests" sekmesinde testleri gör
3. Onaylanacak testleri seç (checkbox)
4. "Approve X Test(s)" butonuna tıkla
5. ✅ Toast notification: "X test(s) approved successfully!"

### Senaryo 2: Arıza Kapatma
1. "Open Faults" sekmesine geç
2. Kapatılacak arızaları seç
3. "Close X Fault(s)" butonuna tıkla
4. ✅ Toast notification: "X fault(s) closed successfully!"

### Senaryo 3: Arama
1. Search box'a yaz
2. Real-time filtreleme
3. Engine serial, test type, description'da ara

## 🔧 Teknik Detaylar

### Dosyalar:
- `pages/QualityControl.tsx` - Ana component
- `constants.tsx` - QualityIcon ve navItems güncellendi
- `App.tsx` - Route eklendi

### State Yönetimi:
```typescript
const [selectedTab, setSelectedTab] = useState<'tests' | 'faults'>('tests');
const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
const [searchTerm, setSearchTerm] = useState('');
```

### API Çağrıları:
```typescript
// Test onaylama
await testsApi.update(id, {
    ...test,
    description: `${test.description} [APPROVED by ${user?.fullName}]`
});

// Fault kapatma
await faultsApi.update(id, {
    ...fault,
    status: 'Closed',
    description: `${fault.description} [CLOSED by ${user?.fullName}]`
});
```

## 📝 Sidebar Sıralaması

Yeni sıralama (mantıklı iş akışına göre):
1. 📊 Dashboard
2. 🛩️ Engines
3. 🧪 Tests
4. ⚠️ Faults
5. 🔧 Assembler
6. 📦 Warehouse
7. ✅ **Quality Control** (YENİ!)
8. 📄 Reports

## ✨ Öne Çıkan Özellikler

### 1. Responsive Design
- Mobil uyumlu
- Tablo scroll
- Flexible layout

### 2. User Feedback
- Toast notifications
- Loading states
- Empty states
- Permission warnings

### 3. Bulk Operations
- Çoklu seçim
- Select All
- Toplu işlem

### 4. Search & Filter
- Real-time search
- Clear button
- Placeholder hints

## 🚀 Kullanmaya Başla

```bash
# Uygulamayı başlat
npm run dev

# Quality Control Engineer olarak giriş yap
Username: readonly
Password: readonlypass

# Quality Control sekmesine git
http://localhost:3002/quality-control
```

## 📸 Ekran Görüntüleri (Konsept)

### Pending Tests View:
```
┌─────────────────────────────────────────────┐
│ Quality Control                              │
│ Review and approve maintenance activities    │
├─────────────────────────────────────────────┤
│ Pending Tests: 5  │ Open Faults: 3  │ ...  │
├─────────────────────────────────────────────┤
│ [Pending Tests (5)] [Open Faults (3)]       │
├─────────────────────────────────────────────┤
│ 🔍 Search tests...                          │
│ [Select All]           [Approve 2 Test(s)]  │
├─────────────────────────────────────────────┤
│ ☑ Date  Engine  Test Type  Duration  ...   │
│ ☑ ...                                       │
│ ☐ ...                                       │
└─────────────────────────────────────────────┘
```

## 🎉 Sonuç

Quality Control özelliği başarıyla eklendi! Artık:
- ✅ Tüm sekmeler görünür (Tests, Faults, Assembler, vb.)
- ✅ Quality Control sekmesi eklendi
- ✅ Kalite mühendisleri bakımları onaylayabilir
- ✅ Modern, kullanıcı dostu arayüz
- ✅ Toplu işlem desteği

İyi kullanımlar! 🚀

