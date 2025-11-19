# PM Logbook - Entegrasyon Sorunları ve Çözümler

## 🔴 KRİTİK SORUNLAR

### SORUN 1: AYNI SERİ NUMARASI KONTROLÜ YOK ⚠️

**Lokasyon:** `server/routes/api.js` - POST /inventory

**Mevcut Kod:**
```javascript
router.post('/inventory', async (req, res) => {
  const { partNumber, serialNumber, description, ... } = req.body;
  
  // Sadece boş alan kontrolü
  if (!partNumber || !serialNumber || !description) {
    return res.status(400).json({ error: 'required fields' });
  }
  
  // ❌ Direkt INSERT - duplicate kontrolü YOK
  const result = await dbRun(
    'INSERT INTO inventory (...) VALUES (...)',
    [...]
  );
});
```

**Sorun:**
- Aynı seri numaralı parça eklenmeye çalışılınca SQLite error: `SQLITE_CONSTRAINT`
- Kullanıcı **"Bu seri numarası zaten kullanımda"** mesajını görmüyor
- Generic error dönüyor: `res.status(500).json({ error: err.message })`

**ÇÖZÜM:**

```javascript
router.post('/inventory', async (req, res) => {
  try {
    const { partNumber, serialNumber, description, location, userName, assemblyGroup, assemblyPartNumber, assemblySerialNumber } = req.body;
    
    // 1. Boş alan kontrolü
    if (!partNumber || !serialNumber || !description) {
      return res.status(400).json({ 
        error: 'Parça numarası, seri numarası ve açıklama gereklidir' 
      });
    }
    
    // 2. ✅ Seri numarası duplicate kontrolü
    const existingBySerial = await dbGet(
      'SELECT id, serialNumber FROM inventory WHERE serialNumber = ?',
      [serialNumber]
    );
    
    if (existingBySerial) {
      return res.status(409).json({ 
        error: `Bu seri numarası zaten kullanımda (ID: ${existingBySerial.id})`,
        field: 'serialNumber',
        existingId: existingBySerial.id
      });
    }
    
    // 3. ✅ OPSIYONEL: Parça numarası kontrolü
    // Not: Aynı parça numaralı birden fazla parça olabilir (farklı seri no ile)
    // Bu kontrolü gerekirse ekleyin:
    /*
    const existingByPartNumber = await dbGet(
      'SELECT id, partNumber FROM inventory WHERE partNumber = ? AND serialNumber = ?',
      [partNumber, serialNumber]
    );
    
    if (existingByPartNumber) {
      return res.status(409).json({ 
        error: `Bu parça ve seri numarası kombinasyonu zaten mevcut`,
        field: 'both'
      });
    }
    */
    
    const createdAt = new Date().toISOString();
    
    // 4. INSERT
    const result = await dbRun(
      'INSERT INTO inventory (partNumber, serialNumber, description, quantity, location, userName, createdAt, assemblyGroup, assemblyPartNumber, assemblySerialNumber) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [partNumber, serialNumber, description, 1, location || 'Depo', userName, createdAt, assemblyGroup || null, assemblyPartNumber || null, assemblySerialNumber || null]
    );
    
    res.json({ 
      id: result.id, 
      partNumber, 
      serialNumber, 
      description, 
      quantity: 1, 
      location: location || 'Depo', 
      userName,
      createdAt,
      assemblyGroup: assemblyGroup || null,
      assemblyPartNumber: assemblyPartNumber || null,
      assemblySerialNumber: assemblySerialNumber || null
    });
  } catch (err) {
    console.error('=== INVENTORY CREATE ERROR ===');
    console.error('Error:', err.message);
    
    // Handle UNIQUE constraint violations that slipped through
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ 
        error: 'Bu seri numarası zaten kullanımda',
        technical: err.message
      });
    }
    
    res.status(500).json({ error: 'Parça eklenirken bir hata oluştu' });
  }
});
```

**Frontend Düzeltmesi:**

```typescript
// pages/Warehouse.tsx - handleSubmit
try {
  await inventoryApi.create(itemData);
  showSuccess('Parça başarıyla depoya eklendi!');
} catch (error: any) {
  // ✅ 409 Conflict hatalarını yakala
  if (error.response?.status === 409) {
    const errorMsg = error.response.data.error;
    showError(errorMsg);
    
    // Formdaki ilgili alanı highlight et
    if (error.response.data.field === 'serialNumber') {
      // Seri numarası input'unu kırmızı yap
      document.getElementById('serialNumber')?.classList.add('border-red-500');
    }
  } else {
    showError('Parça eklenirken hata oluştu');
  }
}
```

---

### SORUN 2: UPDATE'DE DE AYNI KONTROL LAZIM ⚠️

**Lokasyon:** `server/routes/api.js` - PUT /inventory/:id

**Sorun:** Bir parçayı edit ederken başka bir parçanın seri numarasını girersen kabul ediyor!

**ÇÖZÜM:**

```javascript
router.put('/inventory/:id', async (req, res) => {
  try {
    const { partNumber, serialNumber, description, location, userName, assemblyGroup, assemblyPartNumber, assemblySerialNumber } = req.body;
    const itemId = parseInt(req.params.id);
    
    // ✅ Seri numarası duplicate kontrolü (kendisi hariç)
    const existingBySerial = await dbGet(
      'SELECT id, serialNumber FROM inventory WHERE serialNumber = ? AND id != ?',
      [serialNumber, itemId]
    );
    
    if (existingBySerial) {
      return res.status(409).json({ 
        error: `Bu seri numarası başka bir parçada kullanılıyor (ID: ${existingBySerial.id})`,
        field: 'serialNumber',
        existingId: existingBySerial.id
      });
    }
    
    await dbRun(
      'UPDATE inventory SET partNumber = ?, serialNumber = ?, description = ?, quantity = ?, location = ?, userName = ?, assemblyGroup = ?, assemblyPartNumber = ?, assemblySerialNumber = ? WHERE id = ?',
      [partNumber, serialNumber, description, 1, location, userName, assemblyGroup || null, assemblyPartNumber || null, assemblySerialNumber || null, itemId]
    );
    
    res.json({ id: itemId, ...req.body, quantity: 1 });
  } catch (err) {
    console.error('=== INVENTORY UPDATE ERROR ===');
    console.error('Error:', err.message);
    
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ 
        error: 'Bu seri numarası zaten kullanımda',
        technical: err.message
      });
    }
    
    res.status(500).json({ error: 'Parça güncellenirken bir hata oluştu' });
  }
});
```

---

### SORUN 3: COMPONENT HOURS SENKRONİZASYONU EKSİK ⚠️

**Lokasyon:** `pages/Assembler.tsx` - handleSwap

**Sorun:** Depodaki parça tekrar motora takılınca saati sıfırlanıyor!

**Mevcut Kod:**
```typescript
// Assembler.tsx - Satır 318
const newComponent = inventoryToComponent(inventoryItem, engine.totalHours);
// ❌ Her zaman engine.totalHours ile başlıyor

// inventoryToComponent function:
function inventoryToComponent(item: InventoryItem, engineTotalHours: number): Component {
  return {
    id: item.id!,
    description: item.description,
    partNumber: item.partNumber,
    serialNumber: item.serialNumber,
    currentHours: engineTotalHours, // ❌ YANLIŞ! Item'ın kendi saatini kullanmalı
    lifeLimit: 0,
    children: []
  };
}
```

**Senaryo:**
```
1. Component motorda 500 saat çalıştı
2. Çıkarıldı, depoya eklendi (currentHours: 500 ✅)
3. Tekrar takıldı → currentHours: engine.totalHours (örn: 1000) ❌
   DOĞRU: 500 + (takıldıktan sonraki test saatleri)
```

**ÇÖZÜM:**

```typescript
// Assembler.tsx - inventoryToComponent fonksiyonunu düzelt
function inventoryToComponent(item: InventoryItem, engineTotalHours: number): Component {
  return {
    id: item.id!,
    description: item.description,
    partNumber: item.partNumber,
    serialNumber: item.serialNumber,
    // ✅ Item'ın kendi saatini kullan, yoksa 0'dan başlat
    currentHours: item.currentHours || 0,
    // ✅ Item'ın life limit'ini kullan
    lifeLimit: item.lifeLimit || 0,
    children: []
  };
}

// handleSwap içinde - Satır 318
const newComponent = inventoryToComponent(inventoryItem, engine.totalHours);

// ❌ Bu satırı KALDIR (life limit override'ı gereksiz artık)
// if (removedComponent.lifeLimit > 0) {
//   newComponent.lifeLimit = removedComponent.lifeLimit;
// }
```

**Alternatif Yaklaşım (Daha İyi):**
```typescript
// Option A: Depodaki parça takılınca saatini KORU
function inventoryToComponent(item: InventoryItem): Component {
  return {
    id: item.id!,
    description: item.description,
    partNumber: item.partNumber,
    serialNumber: item.serialNumber,
    currentHours: item.currentHours || 0, // Kendi saatini koru
    lifeLimit: item.lifeLimit || 0,
    children: []
  };
}

// Option B: Kullanıcıya sor (daha flexible)
const newComponent = {
  ...inventoryToComponent(inventoryItem),
  currentHours: resetHours ? 0 : (inventoryItem.currentHours || 0)
};
```

---

### SORUN 4: BUILD REPORT UPLOAD - SWAP KAYDI EKSİK ⚠️

**Lokasyon:** `pages/Engines.tsx` - handleBRUpload

**Sorun:** BR ile component kaldırılınca swap kaydı oluşmuyor!

**Mevcut Kod:**
```typescript
// Engines.tsx - Satır 344-365
for (const removed of diff.removed) {
  const potentialReplacement = diff.added.find(
    added => added.partNumber === removed.partNumber || added.description === removed.description
  );
  
  if (potentialReplacement) {
    // ✅ Replacement varsa swap kaydı oluşturuyor
    await swapsApi.create({
      engineId: engine.id!,
      componentInstalledId: potentialReplacement.id,
      componentRemovedId: removed.id,
      swapDate: swapDate,
      swapType: 'BR Update',
      userName: user.fullName,
      installedSerialNumber: potentialReplacement.serialNumber,
      removedSerialNumber: removed.serialNumber
    });
  }
  // ❌ SORUN: Replacement yoksa swap kaydı YOK!
  // Component sessizce siliniyor
}
```

**ÇÖZÜM:**

```typescript
// Engines.tsx - handleBRUpload düzeltmesi
for (const removed of diff.removed) {
  const potentialReplacement = diff.added.find(
    added => added.partNumber === removed.partNumber || added.description === removed.description
  );
  
  if (potentialReplacement) {
    // ✅ Replacement var - swap kaydı
    await swapsApi.create({
      engineId: engine.id!,
      componentInstalledId: potentialReplacement.id,
      componentRemovedId: removed.id,
      swapDate: swapDate,
      swapType: 'BR Update',
      userName: user.fullName,
      installedSerialNumber: potentialReplacement.serialNumber,
      removedSerialNumber: removed.serialNumber
    });
    
    // Depoya ekleme
    await inventoryApi.create({
      partNumber: removed.partNumber,
      serialNumber: removed.serialNumber,
      description: removed.description,
      location: 'Warehouse - BR Removal',
      userName: user.fullName,
      currentHours: removed.currentHours,
      lifeLimit: removed.lifeLimit
    });
  } else {
    // ✅ Replacement yok - sadece removal kaydı
    await swapsApi.create({
      engineId: engine.id!,
      componentInstalledId: null, // Yeni component yok
      componentRemovedId: removed.id,
      swapDate: swapDate,
      swapType: 'BR Removal', // Yeni tip
      userName: user.fullName,
      installedSerialNumber: null,
      removedSerialNumber: removed.serialNumber
    });
    
    // Depoya ekle
    await inventoryApi.create({
      partNumber: removed.partNumber,
      serialNumber: removed.serialNumber,
      description: removed.description,
      location: 'Warehouse - BR Removal',
      userName: user.fullName,
      currentHours: removed.currentHours,
      lifeLimit: removed.lifeLimit
    });
  }
}

// Added component'ler için de aynı mantık
for (const added of diff.added) {
  const wasReplacement = diff.removed.some(
    removed => removed.partNumber === added.partNumber || removed.description === added.description
  );
  
  if (!wasReplacement) {
    // ✅ Yeni eklenen component (replacement değil)
    await swapsApi.create({
      engineId: engine.id!,
      componentInstalledId: added.id,
      componentRemovedId: null,
      swapDate: swapDate,
      swapType: 'BR Addition',
      userName: user.fullName,
      installedSerialNumber: added.serialNumber,
      removedSerialNumber: null
    });
  }
}
```

**NOT:** SwapActivity type'ını güncelle:
```typescript
// types.ts
export interface SwapActivity {
  id?: number;
  engineId: number;
  componentInstalledId: number | null; // ✅ null olabilir
  componentRemovedId: number | null; // ✅ null olabilir
  swapDate: string;
  swapType: 'Component' | 'Assembly' | 'BR Update' | 'BR Addition' | 'BR Removal'; // ✅ Yeni tipler
  assemblyGroup?: string;
  documentId?: number;
  documents?: Document[];
  userName: string;
  installedSerialNumber?: string | null;
  removedSerialNumber?: string | null;
}
```

---

### SORUN 5: LIFE LIMIT ALERTS - BACKEND ENDPOINT YOK ⚠️

**Lokasyon:** Backend API eksik

**Sorun:** Frontend API çağrısı yapıyor ama backend endpoint yok!

```typescript
// lib/client.ts - Satır 100-102
getAllLifeLimitAlerts: async () => {
  const response = await api.get('/life-limit-alerts'); // ❌ Endpoint yok!
  return response.data;
}
```

**ÇÖZÜM:**

```javascript
// server/routes/api.js - Yeni endpoint ekle
router.get('/life-limit-alerts', async (req, res) => {
  try {
    // Tüm motorları al
    const engines = await dbAll('SELECT * FROM engines');
    const alerts = [];
    
    engines.forEach(engine => {
      // Parse components
      let components = [];
      try {
        components = JSON.parse(engine.components || '[]');
      } catch (e) {
        console.error(`Error parsing components for engine ${engine.id}:`, e);
        return;
      }
      
      // Recursive component checking
      function checkComponents(comps, engineId, engineSerialNumber) {
        comps.forEach(comp => {
          if (comp.lifeLimit > 0) {
            const remaining = comp.lifeLimit - comp.currentHours;
            
            // Critical: <= 10h
            // Warning: <= 50h
            if (remaining <= 50) {
              alerts.push({
                id: `${engineId}-${comp.id}`,
                engineId: engineId,
                engineSerialNumber: engineSerialNumber,
                componentId: comp.id,
                description: comp.description,
                partNumber: comp.partNumber,
                serialNumber: comp.serialNumber,
                currentHours: comp.currentHours,
                lifeLimit: comp.lifeLimit,
                remaining: remaining,
                status: remaining <= 10 ? 'critical' : 'warning',
                createdAt: new Date().toISOString()
              });
            }
          }
          
          // Check children
          if (comp.children && comp.children.length > 0) {
            checkComponents(comp.children, engineId, engineSerialNumber);
          }
        });
      }
      
      checkComponents(components, engine.id, engine.serialNumber);
    });
    
    // Sort by remaining (most critical first)
    alerts.sort((a, b) => a.remaining - b.remaining);
    
    res.json(alerts);
  } catch (err) {
    console.error('Error getting life limit alerts:', err);
    res.status(500).json({ error: err.message });
  }
});

// Specific engine alerts
router.get('/engines/:id/life-limit-alerts', async (req, res) => {
  try {
    const engineId = parseInt(req.params.id);
    const engine = await dbGet('SELECT * FROM engines WHERE id = ?', [engineId]);
    
    if (!engine) {
      return res.status(404).json({ error: 'Engine not found' });
    }
    
    let components = [];
    try {
      components = JSON.parse(engine.components || '[]');
    } catch (e) {
      return res.json([]);
    }
    
    const alerts = [];
    
    function checkComponents(comps) {
      comps.forEach(comp => {
        if (comp.lifeLimit > 0) {
          const remaining = comp.lifeLimit - comp.currentHours;
          
          if (remaining <= 50) {
            alerts.push({
              id: `${engineId}-${comp.id}`,
              engineId: engineId,
              engineSerialNumber: engine.serialNumber,
              componentId: comp.id,
              description: comp.description,
              partNumber: comp.partNumber,
              serialNumber: comp.serialNumber,
              currentHours: comp.currentHours,
              lifeLimit: comp.lifeLimit,
              remaining: remaining,
              status: remaining <= 10 ? 'critical' : 'warning',
              createdAt: new Date().toISOString()
            });
          }
        }
        
        if (comp.children && comp.children.length > 0) {
          checkComponents(comp.children);
        }
      });
    }
    
    checkComponents(components);
    alerts.sort((a, b) => a.remaining - b.remaining);
    
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

---

### SORUN 6: QUALITY CONTROL - LIFE LIMIT İŞLEM SONRASI GÜNCELLEME YOK ⚠️

**Lokasyon:** `pages/QualityControl.tsx`

**Sorun:** Life limit alert'e aksiyon alınca (replaced, inspected) alert listesi güncellenmiyor!

**Mevcut Durum:** QualityControl sayfası sadece gösteriyor, işlem sonrası tracking yok.

**ÇÖZÜM:** Alert action tracking tablosu ekle

```sql
-- server/database.js - Yeni tablo
CREATE TABLE IF NOT EXISTS life_limit_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alertId TEXT NOT NULL,
  engineId INTEGER NOT NULL,
  componentId INTEGER NOT NULL,
  actionType TEXT NOT NULL, -- 'replaced', 'risk-accepted', 'inspected'
  actionDate TEXT NOT NULL,
  actionBy TEXT NOT NULL,
  notes TEXT,
  swapId INTEGER, -- If replaced, link to swap record
  FOREIGN KEY (engineId) REFERENCES engines(id),
  FOREIGN KEY (swapId) REFERENCES swaps(id)
);

CREATE INDEX IF NOT EXISTS idx_life_limit_actions_alertId ON life_limit_actions(alertId);
CREATE INDEX IF NOT EXISTS idx_life_limit_actions_engineId ON life_limit_actions(engineId);
```

**Backend API:**
```javascript
// server/routes/api.js
router.post('/life-limit-alerts/:alertId/action', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { engineId, componentId, actionType, actionBy, notes, swapId } = req.body;
    
    const result = await dbRun(
      'INSERT INTO life_limit_actions (alertId, engineId, componentId, actionType, actionDate, actionBy, notes, swapId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [alertId, engineId, componentId, actionType, new Date().toISOString(), actionBy, notes, swapId || null]
    );
    
    res.json({ id: result.id, alertId, actionType });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get actions for an alert
router.get('/life-limit-alerts/:alertId/actions', async (req, res) => {
  try {
    const actions = await dbAll(
      'SELECT * FROM life_limit_actions WHERE alertId = ? ORDER BY actionDate DESC',
      [req.params.alertId]
    );
    res.json(actions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get ALL life limit alerts with action status
router.get('/life-limit-alerts-with-status', async (req, res) => {
  try {
    // ... (get alerts like before)
    
    // Add action status to each alert
    for (const alert of alerts) {
      const action = await dbGet(
        'SELECT * FROM life_limit_actions WHERE alertId = ? ORDER BY actionDate DESC LIMIT 1',
        [alert.id]
      );
      
      if (action) {
        alert.actionTaken = true;
        alert.actionType = action.actionType;
        alert.actionDate = action.actionDate;
        alert.actionBy = action.actionBy;
        alert.actionNotes = action.notes;
      } else {
        alert.actionTaken = false;
      }
    }
    
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

---

## 📋 ÖNCELİK SIRASI

### 🔴 Acil (Bu Hafta)

```
□ 1. Inventory duplicate check (POST & PUT)         [2h]
□ 2. Component hours senkronizasyonu                [3h]
□ 3. Life limit alerts endpoint                     [2h]

TOPLAM: ~7 saat (1 iş günü)
```

### 🟡 Önemli (Gelecek Hafta)

```
□ 4. BR upload swap kayıtları düzeltme              [3h]
□ 5. Life limit action tracking                     [4h]
□ 6. Frontend error handling (409 errors)           [2h]

TOPLAM: ~9 saat (1-1.5 iş günü)
```

### 🟢 İyileştirme (Zaman Kalırsa)

```
□ 7. Swap activity null handling                    [2h]
□ 8. Component history tracking                     [4h]
□ 9. Validation messages geliştirme                 [2h]

TOPLAM: ~8 saat
```

---

## 🧪 TEST SENARYOLARı

### Test 1: Duplicate Serial Number
```
1. Warehouse'a "SN-001" ile parça ekle ✅
2. Tekrar "SN-001" ile parça ekle
3. Beklenen: "Bu seri numarası zaten kullanımda" hatası ✅
```

### Test 2: Component Hours Tracking
```
1. Motor'a component tak (currentHours: 0)
2. 10 saatlik test yap
3. Component'i çıkar (currentHours: 10 olmalı)
4. Warehouse'ta kontrol et (10 saat görünmeli) ✅
5. Tekrar tak
6. Beklenen: currentHours 10'dan devam ✅
```

### Test 3: Life Limit Alerts
```
1. Component life limit: 100h
2. 95 saatlik test yap
3. Quality Control'e git
4. Beklenen: Warning alert görünmeli ✅
5. Component değiştir
6. Alert "Resolved" olmalı ✅
```

---

## 📞 ÖZET

**3 kritik sorun tespit edildi:**

1. ❌ **Duplicate serial number kontrolü yok**
   - Aynı seri no ile parça eklenebiliyor
   - ÇözümSüre: 2 saat

2. ❌ **Component hours senkronizasyonu bozuk**
   - Depoya gidip gelen component saatini kaybediyor
   - Çözüm Süre: 3 saat

3. ❌ **Life limit alerts endpoint yok**
   - Frontend çağırıyor ama backend yok
   - Çözüm Süre: 2 saat

**TOPLAM:** 7 saat (1 iş günü) düzeltme ile kritik sorunlar çözülür.

Diğer sorunlar önemli ama **demo için engelleyici değil**.

