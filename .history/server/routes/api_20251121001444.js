const express = require('express');
const router = express.Router();
const db = require('../database');

// Helper function to promisify database operations
const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

// Parse JSON fields for engines
const parseEngine = (engine) => {
  if (engine) {
    try {
      engine.components = JSON.parse(engine.components || '[]');
      engine.activityLog = JSON.parse(engine.activityLog || '[]');
    } catch (e) {
      engine.components = [];
      engine.activityLog = [];
    }
  }
  return engine;
};

// =============== USERS ===============
router.get('/users', async (req, res) => {
  try {
    const users = await dbAll('SELECT * FROM users');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.params.id]);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/by-username/:username', async (req, res) => {
  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ? COLLATE NOCASE', [req.params.username]);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { username, passwordHash, role, fullName } = req.body;
    const result = await dbRun(
      'INSERT INTO users (username, passwordHash, role, fullName) VALUES (?, ?, ?, ?)',
      [username, passwordHash, role, fullName]
    );
    res.json({ id: result.id, username, role, fullName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============== ENGINES ===============
router.get('/engines', async (req, res) => {
  try {
    const engines = await dbAll('SELECT * FROM engines');
    const parsedEngines = engines.map(parseEngine);
    res.json(parsedEngines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/engines/:id', async (req, res) => {
  try {
    const engine = await dbGet('SELECT * FROM engines WHERE id = ?', [req.params.id]);
    if (!engine) {
      return res.status(404).json({ error: 'Engine not found' });
    }
    res.json(parseEngine(engine));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/engines', async (req, res) => {
  try {
    console.log('=== ENGINE CREATE REQUEST ===');
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    
    const { model, serialNumber, status, totalHours, totalCycles, nextServiceDue, manufacturer, location, components, activityLog } = req.body;
    
    // Validate required fields
    if (!model || !serialNumber) {
      console.error('Validation Error: Missing required fields');
      return res.status(400).json({ error: 'Model and serialNumber are required' });
    }
    
    const result = await dbRun(
      'INSERT INTO engines (model, serialNumber, status, totalHours, totalCycles, nextServiceDue, manufacturer, location, components, activityLog) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        model, 
        serialNumber, 
        status || 'Aktif', 
        totalHours || 0, 
        totalCycles || 0, 
        nextServiceDue || '0', // NOT NULL field in DB - use '0' instead of null
        manufacturer || '-', 
        location || '', 
        JSON.stringify(components || []), 
        JSON.stringify(activityLog || [])
      ]
    );
    
    console.log('Engine created successfully with ID:', result.id);
    res.json({ id: result.id, ...req.body });
  } catch (err) {
    console.error('=== ENGINE CREATE ERROR ===');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: err.message });
  }
});

router.put('/engines/:id', async (req, res) => {
  try {
    console.log('=== ENGINE UPDATE REQUEST ===');
    console.log('Engine ID:', req.params.id);
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    
    // Önce mevcut engine'i al
    const existingEngine = await dbGet('SELECT * FROM engines WHERE id = ?', [req.params.id]);
    if (!existingEngine) {
      return res.status(404).json({ error: 'Engine not found' });
    }

    // Sadece gönderilen alanları güncelle (partial update)
    const updates = {};
    const fields = ['model', 'serialNumber', 'status', 'totalHours', 'totalCycles', 'nextServiceDue', 'manufacturer', 'location', 'components', 'activityLog'];
    
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'components' || field === 'activityLog') {
          updates[field] = JSON.stringify(req.body[field]);
        } else {
          updates[field] = req.body[field];
        }
      }
    });

    console.log('Updates:', Object.keys(updates));

    // UPDATE query'sini dinamik oluştur
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];

    console.log('SQL:', `UPDATE engines SET ${setClauses} WHERE id = ?`);

    await dbRun(
      `UPDATE engines SET ${setClauses} WHERE id = ?`,
      values
    );

    // Güncellenmiş engine'i döndür
    const updatedEngine = await dbGet('SELECT * FROM engines WHERE id = ?', [req.params.id]);
    console.log('Update successful!');
    res.json(parseEngine(updatedEngine));
  } catch (err) {
    console.error('=== ENGINE UPDATE ERROR ===');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/engines/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM engines WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/engines/count', async (req, res) => {
  try {
    const result = await dbGet('SELECT COUNT(*) as count FROM engines');
    res.json({ count: result.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============== TESTS ===============
router.get('/tests', async (req, res) => {
  try {
    const tests = await dbAll('SELECT * FROM tests ORDER BY testDate DESC');
    res.json(tests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tests/:id', async (req, res) => {
  try {
    const test = await dbGet('SELECT * FROM tests WHERE id = ?', [req.params.id]);
    res.json(test);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tests', async (req, res) => {
  try {
    const { engineId, testType, brakeType, operatorId, operatorName, testCell, description, duration, testDate, documentId, userName } = req.body;
    const result = await dbRun(
      'INSERT INTO tests (engineId, testType, brakeType, operatorId, operatorName, testCell, description, duration, testDate, documentId, userName) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [engineId, testType, brakeType, operatorId, operatorName, testCell, description, duration, testDate, documentId, userName]
    );
    res.json({ id: result.id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/tests/:id', async (req, res) => {
  try {
    const { engineId, testType, brakeType, operatorId, operatorName, testCell, description, duration, testDate, documentId, userName } = req.body;
    await dbRun(
      'UPDATE tests SET engineId = ?, testType = ?, brakeType = ?, operatorId = ?, operatorName = ?, testCell = ?, description = ?, duration = ?, testDate = ?, documentId = ?, userName = ? WHERE id = ?',
      [engineId, testType, brakeType, operatorId, operatorName, testCell, description, duration, testDate, documentId, userName, req.params.id]
    );
    res.json({ id: req.params.id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/tests/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM tests WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============== FAULTS ===============
router.get('/faults', async (req, res) => {
  try {
    const faults = await dbAll('SELECT * FROM faults ORDER BY reportDate DESC');
    res.json(faults);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/faults/:id', async (req, res) => {
  try {
    const fault = await dbGet('SELECT * FROM faults WHERE id = ?', [req.params.id]);
    res.json(fault);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/faults', async (req, res) => {
  try {
    const { engineId, componentId, description, severity, reportDate, status, documentId, userName, assignedTo } = req.body;
    const result = await dbRun(
      'INSERT INTO faults (engineId, componentId, description, severity, reportDate, status, documentId, userName, assignedTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [engineId, componentId, description, severity, reportDate, status, documentId, userName, assignedTo]
    );
    res.json({ id: result.id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/faults/:id', async (req, res) => {
  try {
    const { engineId, componentId, description, severity, reportDate, status, documentId, userName, assignedTo } = req.body;
    await dbRun(
      'UPDATE faults SET engineId = ?, componentId = ?, description = ?, severity = ?, reportDate = ?, status = ?, documentId = ?, userName = ?, assignedTo = ? WHERE id = ?',
      [engineId, componentId, description, severity, reportDate, status, documentId, userName, assignedTo, req.params.id]
    );
    res.json({ id: req.params.id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/faults/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM faults WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============== SWAPS ===============
router.get('/swaps', async (req, res) => {
  try {
    const swaps = await dbAll('SELECT * FROM swaps ORDER BY swapDate DESC');
    res.json(swaps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/swaps/:id', async (req, res) => {
  try {
    const swap = await dbGet('SELECT * FROM swaps WHERE id = ?', [req.params.id]);
    res.json(swap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/swaps', async (req, res) => {
  try {
    const { engineId, componentInstalledId, componentRemovedId, swapDate, swapType, assemblyGroup, documentId, userName, installedSerialNumber, removedSerialNumber } = req.body;
    const result = await dbRun(
      'INSERT INTO swaps (engineId, componentInstalledId, componentRemovedId, swapDate, swapType, assemblyGroup, documentId, userName, installedSerialNumber, removedSerialNumber) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [engineId, componentInstalledId, componentRemovedId, swapDate, swapType || 'Component', assemblyGroup, documentId, userName, installedSerialNumber, removedSerialNumber]
    );
    res.json({ id: result.id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/swaps/:id', async (req, res) => {
  try {
    const { engineId, componentInstalledId, componentRemovedId, swapDate, swapType, assemblyGroup, documentId, userName, installedSerialNumber, removedSerialNumber } = req.body;
    await dbRun(
      'UPDATE swaps SET engineId = ?, componentInstalledId = ?, componentRemovedId = ?, swapDate = ?, swapType = ?, assemblyGroup = ?, documentId = ?, userName = ?, installedSerialNumber = ?, removedSerialNumber = ? WHERE id = ?',
      [engineId, componentInstalledId, componentRemovedId, swapDate, swapType || 'Component', assemblyGroup, documentId, userName, installedSerialNumber, removedSerialNumber, req.params.id]
    );
    res.json({ id: req.params.id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/swaps/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM swaps WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============== INVENTORY ===============
router.get('/inventory', async (req, res) => {
  try {
    const inventory = await dbAll('SELECT * FROM inventory');
    // Add createdAt to items that don't have it (legacy data)
    const inventoryWithDates = inventory.map(item => ({
      ...item,
      createdAt: item.createdAt || new Date().toISOString()
    }));
    res.json(inventoryWithDates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/inventory/:id', async (req, res) => {
  try {
    const item = await dbGet('SELECT * FROM inventory WHERE id = ?', [req.params.id]);
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/inventory', async (req, res) => {
  try {
    console.log('=== INVENTORY CREATE REQUEST ===');
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    
    const { partNumber, serialNumber, description, location, userName, assemblyGroup, assemblyPartNumber, assemblySerialNumber, currentHours, lifeLimit } = req.body;
    
    // Validate required fields
    if (!partNumber || !serialNumber || !description) {
      console.error('Validation Error: Missing required fields');
      return res.status(400).json({ error: 'Parça numarası, seri numarası ve açıklama gereklidir' });
    }
    
    // Check for duplicate serial number
    const existingBySerial = await dbGet(
      'SELECT id, serialNumber FROM inventory WHERE serialNumber = ?',
      [serialNumber]
    );
    
    if (existingBySerial) {
      console.log('Duplicate serial number found:', existingBySerial.id);
      return res.status(409).json({ 
        error: `Bu seri numarası zaten kullanımda (ID: ${existingBySerial.id})`,
        field: 'serialNumber',
        existingId: existingBySerial.id
      });
    }
    
    const createdAt = new Date().toISOString();
    
    // quantity alanı DB'de NOT NULL olduğu için default 1 değerini gönderiyoruz
    // Her parçanın benzersiz seri numarası var, UI'da quantity gösterilmiyor
    const result = await dbRun(
      'INSERT INTO inventory (partNumber, serialNumber, description, quantity, location, userName, createdAt, assemblyGroup, assemblyPartNumber, assemblySerialNumber, currentHours, lifeLimit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [partNumber, serialNumber, description, 1, location || 'Depo', userName, createdAt, assemblyGroup || null, assemblyPartNumber || null, assemblySerialNumber || null, currentHours || 0, lifeLimit || 0]
    );
    
    console.log('Inventory item created successfully with ID:', result.id);
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
      assemblySerialNumber: assemblySerialNumber || null,
      currentHours: currentHours || 0,
      lifeLimit: lifeLimit || 0
    });
  } catch (err) {
    console.error('=== INVENTORY CREATE ERROR ===');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    
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

router.put('/inventory/:id', async (req, res) => {
  try {
    const { partNumber, serialNumber, description, location, userName, assemblyGroup, assemblyPartNumber, assemblySerialNumber, currentHours, lifeLimit } = req.body;
    const itemId = parseInt(req.params.id);
    
    console.log('=== INVENTORY UPDATE REQUEST ===');
    console.log('ID:', itemId);
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    
    // Check for duplicate serial number (excluding current item)
    const existingBySerial = await dbGet(
      'SELECT id, serialNumber FROM inventory WHERE serialNumber = ? AND id != ?',
      [serialNumber, itemId]
    );
    
    if (existingBySerial) {
      console.log('Duplicate serial number found:', existingBySerial.id);
      return res.status(409).json({ 
        error: `Bu seri numarası başka bir parçada kullanılıyor (ID: ${existingBySerial.id})`,
        field: 'serialNumber',
        existingId: existingBySerial.id
      });
    }
    
    // quantity alanını 1 olarak koruyoruz (DB şeması gereksinimleri)
    await dbRun(
      'UPDATE inventory SET partNumber = ?, serialNumber = ?, description = ?, quantity = ?, location = ?, userName = ?, assemblyGroup = ?, assemblyPartNumber = ?, assemblySerialNumber = ?, currentHours = ?, lifeLimit = ? WHERE id = ?',
      [partNumber, serialNumber, description, 1, location, userName, assemblyGroup || null, assemblyPartNumber || null, assemblySerialNumber || null, currentHours || 0, lifeLimit || 0, itemId]
    );
    
    console.log('Inventory item updated successfully');
    res.json({ id: itemId, ...req.body, quantity: 1 });
  } catch (err) {
    console.error('=== INVENTORY UPDATE ERROR ===');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    
    // Handle UNIQUE constraint violations that slipped through
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ 
        error: 'Bu seri numarası zaten kullanımda',
        technical: err.message
      });
    }
    
    res.status(500).json({ error: 'Parça güncellenirken bir hata oluştu' });
  }
});

router.delete('/inventory/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM inventory WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============== DOCUMENTS ===============
router.get('/documents', async (req, res) => {
  try {
    const documents = await dbAll('SELECT id, fileName FROM documents');
    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/documents/:id', async (req, res) => {
  try {
    const document = await dbGet('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    res.json(document);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/documents', async (req, res) => {
  try {
    const { fileName, fileData, fileType, fileSize, relatedType, relatedId, uploadedBy } = req.body;
    const result = await dbRun(
      'INSERT INTO documents (fileName, fileData, fileType, fileSize, relatedType, relatedId, uploadedBy, uploadedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [fileName, fileData, fileType, fileSize, relatedType, relatedId, uploadedBy, new Date().toISOString()]
    );
    res.json({ id: result.id, fileName, fileType, fileSize, relatedType, relatedId, uploadedBy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload document with base64 encoded file data
router.post('/documents/upload', async (req, res) => {
  try {
    const { fileName, fileData, fileType, fileSize, relatedType, relatedId, uploadedBy } = req.body;
    
    if (!fileName || !fileData) {
      return res.status(400).json({ error: 'fileName and fileData are required' });
    }
    
    const result = await dbRun(
      'INSERT INTO documents (fileName, fileData, fileType, fileSize, relatedType, relatedId, uploadedBy, uploadedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [fileName, fileData, fileType, fileSize, relatedType, relatedId, uploadedBy, new Date().toISOString()]
    );
    res.json({ id: result.id, fileName, fileType, fileSize, relatedType, relatedId, uploadedBy, uploadedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download document
router.get('/documents/:id/download', async (req, res) => {
  try {
    const document = await dbGet('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(document);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/documents/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM documents WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============== BUILD REPORT HISTORY ===============
router.get('/engines/:id/build-report-history', async (req, res) => {
  try {
    const engineId = parseInt(req.params.id);
    const history = await dbAll(
      'SELECT * FROM build_report_history WHERE engineId = ? ORDER BY uploadDate DESC', 
      [engineId]
    );
    
    // Parse components JSON
    const parsedHistory = history.map(item => ({
      ...item,
      components: JSON.parse(item.components || '[]'),
      changesSummary: {
        added: item.addedCount,
        updated: item.updatedCount,
        removed: item.removedCount
      }
    }));
    
    res.json(parsedHistory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/engines/:id/build-report-history', async (req, res) => {
  try {
    const engineId = parseInt(req.params.id);
    const { uploadedBy, fileName, components, addedCount, updatedCount, removedCount } = req.body;
    
    const result = await dbRun(
      'INSERT INTO build_report_history (engineId, uploadDate, uploadedBy, fileName, components, addedCount, updatedCount, removedCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        engineId, 
        new Date().toISOString(), 
        uploadedBy, 
        fileName, 
        JSON.stringify(components),
        addedCount || 0,
        updatedCount || 0,
        removedCount || 0
      ]
    );
    
    res.json({ 
      id: result.id, 
      engineId, 
      uploadDate: new Date().toISOString(),
      uploadedBy,
      fileName,
      components,
      changesSummary: {
        added: addedCount || 0,
        updated: updatedCount || 0,
        removed: removedCount || 0
      }
    });
  } catch (err) {
    console.error('Build Report History create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// =============== ENGINE ACTIVITY LOG ===============
// Get activity log for a specific engine (combining tests, faults, swaps)
router.get('/engines/:id/activities', async (req, res) => {
  try {
    const engineId = parseInt(req.params.id);
    
    // Get tests
    const tests = await dbAll('SELECT * FROM tests WHERE engineId = ? ORDER BY testDate DESC', [engineId]);
    
    // Get faults
    const faults = await dbAll('SELECT * FROM faults WHERE engineId = ? ORDER BY reportDate DESC', [engineId]);
    
    // Get swaps
    const swaps = await dbAll('SELECT * FROM swaps WHERE engineId = ? ORDER BY swapDate DESC', [engineId]);
    
    // Combine and format activities
    const activities = [];
    
    // Add tests
    tests.forEach(test => {
      activities.push({
        type: 'Test',
        details: `${test.testType} (${test.testCell})`,
        date: test.testDate,
        duration: test.duration,
        id: test.id,
        fullData: test
      });
    });
    
    // Add faults
    faults.forEach(fault => {
      activities.push({
        type: 'Fault',
        details: fault.description,
        date: fault.reportDate,
        severity: fault.severity,
        id: fault.id,
        fullData: fault
      });
    });
    
    // Add swaps
    swaps.forEach(swap => {
      activities.push({
        type: 'Swap',
        details: `Component Swap (ID: ${swap.componentInstalledId} → ${swap.componentRemovedId})`,
        date: swap.swapDate,
        id: swap.id,
        fullData: swap
      });
    });
    
    // Sort by date (newest first)
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============== LIFE LIMIT ALERTS ===============
// Get all life limit alerts across all engines
router.get('/life-limit-alerts', async (req, res) => {
  try {
    // Get all engines
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
            
            // Critical: <= 10h, Warning: <= 50h
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

// Get life limit alerts for a specific engine
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

// Record action taken on a life limit alert
router.post('/life-limit-alerts/:alertId/action', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { engineId, componentId, actionType, actionBy, notes, swapId } = req.body;
    
    const result = await dbRun(
      'INSERT INTO life_limit_actions (alertId, engineId, componentId, actionType, actionDate, actionBy, notes, swapId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [alertId, engineId, componentId, actionType, new Date().toISOString(), actionBy, notes || null, swapId || null]
    );
    
    res.json({ 
      id: result.id, 
      alertId, 
      engineId,
      componentId,
      actionType,
      actionDate: new Date().toISOString(),
      actionBy,
      notes,
      swapId
    });
  } catch (err) {
    console.error('Error recording life limit action:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get actions for a specific alert
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

// Get all life limit alerts with their action status
router.get('/life-limit-alerts-with-status', async (req, res) => {
  try {
    // Get all engines
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
          
          if (comp.children && comp.children.length > 0) {
            checkComponents(comp.children, engineId, engineSerialNumber);
          }
        });
      }
      
      checkComponents(components, engine.id, engine.serialNumber);
    });
    
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
        alert.swapId = action.swapId;
      } else {
        alert.actionTaken = false;
      }
    }
    
    // Sort by remaining (most critical first)
    alerts.sort((a, b) => a.remaining - b.remaining);
    
    res.json(alerts);
  } catch (err) {
    console.error('Error getting life limit alerts with status:', err);
    res.status(500).json({ error: err.message });
  }
});

// =============== CONTROL REQUESTS ===============
router.get('/control-requests', async (req, res) => {
  try {
    const { engineId } = req.query;
    let query = 'SELECT * FROM control_requests';
    let params = [];
    
    if (engineId) {
      query += ' WHERE engineId = ?';
      params.push(engineId);
    }
    
    query += ' ORDER BY createdAt DESC';
    const requests = await dbAll(query, params);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/control-requests', async (req, res) => {
  try {
    const { engineId, controlType, description, requestDate, priority, status, createdBy, documentId, documentName } = req.body;
    
    const result = await dbRun(
      'INSERT INTO control_requests (engineId, controlType, description, requestDate, priority, status, createdBy, createdAt, documentId, documentName) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [engineId, controlType, description, requestDate, priority || 'Orta', status || 'Beklemede', createdBy, new Date().toISOString(), documentId || null, documentName || null]
    );
    
    res.json({ id: result.id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/control-requests/:id', async (req, res) => {
  try {
    // Get current record first
    const current = await dbGet('SELECT * FROM control_requests WHERE id = ?', [req.params.id]);
    if (!current) {
      return res.status(404).json({ error: 'Control request not found' });
    }

    // Merge with updates
    const updated = {
      controlType: req.body.controlType !== undefined ? req.body.controlType : current.controlType,
      description: req.body.description !== undefined ? req.body.description : current.description,
      requestDate: req.body.requestDate !== undefined ? req.body.requestDate : current.requestDate,
      priority: req.body.priority !== undefined ? req.body.priority : current.priority,
      status: req.body.status !== undefined ? req.body.status : current.status,
      completedBy: req.body.completedBy !== undefined ? req.body.completedBy : current.completedBy,
      completedAt: req.body.completedAt !== undefined ? req.body.completedAt : current.completedAt,
      documentId: req.body.documentId !== undefined ? req.body.documentId : current.documentId,
      documentName: req.body.documentName !== undefined ? req.body.documentName : current.documentName
    };
    
    await dbRun(
      'UPDATE control_requests SET controlType = ?, description = ?, requestDate = ?, priority = ?, status = ?, completedBy = ?, completedAt = ?, documentId = ?, documentName = ? WHERE id = ?',
      [updated.controlType, updated.description, updated.requestDate, updated.priority, updated.status, updated.completedBy, updated.completedAt, updated.documentId, updated.documentName, req.params.id]
    );
    
    const result = await dbGet('SELECT * FROM control_requests WHERE id = ?', [req.params.id]);
    res.json(result);
  } catch (err) {
    console.error('Control request update error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/control-requests/:id/complete', async (req, res) => {
  try {
    const { completedBy } = req.body;
    const completedAt = new Date().toISOString();
    
    await dbRun(
      'UPDATE control_requests SET status = ?, completedBy = ?, completedAt = ? WHERE id = ?',
      ['Tamamlandı', completedBy, completedAt, req.params.id]
    );
    
    const request = await dbGet('SELECT * FROM control_requests WHERE id = ?', [req.params.id]);
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/control-requests/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM control_requests WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============== LIFE LIMIT ALERTS ===============
// Get life limit alerts for an engine
router.get('/engines/:id/life-limit-alerts', async (req, res) => {
  try {
    const engineId = parseInt(req.params.id);
    const engine = await dbGet('SELECT * FROM engines WHERE id = ?', [engineId]);
    
    if (!engine) {
      return res.status(404).json({ error: 'Engine not found' });
    }
    
    const components = JSON.parse(engine.components || '[]');
    const alerts = [];
    
    // Recursively check all components for life limit warnings
    function checkComponents(comps, parentPath = '') {
      comps.forEach(comp => {
        if (comp.lifeLimit > 0) {
          const remaining = comp.lifeLimit - comp.currentHours;
          
          // Critical: ≤10h, Warning: ≤50h
          if (remaining <= 50) {
            alerts.push({
              engineId: engine.id,
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
          checkComponents(comp.children, `${parentPath}/${comp.description}`);
        }
      });
    }
    
    checkComponents(components);
    
    // Sort by remaining hours (most critical first)
    alerts.sort((a, b) => a.remaining - b.remaining);
    
    res.json(alerts);
  } catch (err) {
    console.error('Life limit alerts error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all life limit alerts across all engines
router.get('/life-limit-alerts', async (req, res) => {
  try {
    const engines = await dbAll('SELECT * FROM engines');
    const allAlerts = [];
    
    for (const engine of engines) {
      const components = JSON.parse(engine.components || '[]');
      
      function checkComponents(comps) {
        comps.forEach(comp => {
          if (comp.lifeLimit > 0) {
            const remaining = comp.lifeLimit - comp.currentHours;
            
            if (remaining <= 50) {
              allAlerts.push({
                engineId: engine.id,
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
    }
    
    // Sort by remaining hours
    allAlerts.sort((a, b) => a.remaining - b.remaining);
    
    res.json(allAlerts);
  } catch (err) {
    console.error('All life limit alerts error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get next maintenance info for an engine
router.get('/engines/:id/next-maintenance', async (req, res) => {
  try {
    const engineId = parseInt(req.params.id);
    const engine = await dbGet('SELECT * FROM engines WHERE id = ?', [engineId]);
    
    if (!engine) {
      return res.status(404).json({ error: 'Engine not found' });
    }
    
    const currentHours = engine.totalHours;
    const result = {
      engineId: engine.id,
      lifeLimitAlerts: 0
    };
    
    // Find next periodic maintenance
    const periodicPlans = await dbAll(
      `SELECT * FROM maintenance_plans 
       WHERE engineId = ? 
       AND maintenanceType = 'periodic' 
       AND status IN ('Approved', 'Active')`,
      [engineId]
    );
    
    if (periodicPlans.length > 0) {
      let closestPeriodic = null;
      let minRemaining = Infinity;
      
      periodicPlans.forEach(plan => {
        const lastPerformed = plan.lastPerformedHours || 0;
        const interval = plan.periodicIntervalHours;
        
        if (interval) {
          let nextDue = lastPerformed + interval;
          while (nextDue <= currentHours) {
            nextDue += interval;
          }
          
          const remaining = nextDue - currentHours;
          
          if (remaining < minRemaining) {
            minRemaining = remaining;
            closestPeriodic = {
              planType: plan.planType,
              nextDueHours: nextDue,
              remainingHours: remaining,
              intervalHours: interval
            };
          }
        }
      });
      
      if (closestPeriodic) {
        result.nextPeriodicMaintenance = closestPeriodic;
      }
    }
    
    // Find upcoming one-time maintenance
    const oneTimePlans = await dbAll(
      `SELECT * FROM maintenance_plans 
       WHERE engineId = ? 
       AND maintenanceType = 'one-time' 
       AND status IN ('Pending', 'Approved')
       ORDER BY scheduledDate ASC
       LIMIT 1`,
      [engineId]
    );
    
    if (oneTimePlans.length > 0) {
      const plan = oneTimePlans[0];
      const scheduledDate = new Date(plan.scheduledDate);
      const today = new Date();
      const daysUntil = Math.ceil((scheduledDate - today) / (1000 * 60 * 60 * 24));
      
      result.upcomingOneTime = {
        planType: plan.planType,
        scheduledDate: plan.scheduledDate,
        daysUntil: daysUntil
      };
    }
    
    // Count life limit alerts
    const components = JSON.parse(engine.components || '[]');
    let alertCount = 0;
    
    function countAlerts(comps) {
      comps.forEach(comp => {
        if (comp.lifeLimit > 0) {
          const remaining = comp.lifeLimit - comp.currentHours;
          if (remaining <= 50) alertCount++;
        }
        if (comp.children) countAlerts(comp.children);
      });
    }
    
    countAlerts(components);
    result.lifeLimitAlerts = alertCount;
    
    res.json(result);
  } catch (err) {
    console.error('Next maintenance info error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get maintenance plans that are due
router.get('/maintenance-plans/due', async (req, res) => {
  try {
    // Get all approved periodic plans
    const periodicPlans = await dbAll(
      `SELECT mp.*, e.totalHours, e.totalCycles, e.serialNumber as engineSerialNumber
       FROM maintenance_plans mp 
       JOIN engines e ON mp.engineId = e.id 
       WHERE mp.maintenanceType = 'periodic' 
       AND mp.status IN ('Approved', 'Active')`
    );
    
    const duePlans = [];
    
    for (const plan of periodicPlans) {
      let isDue = false;
      
      // Check if due based on hours
      if (plan.periodicIntervalHours && plan.totalHours) {
        const lastPerformed = plan.lastPerformedHours || 0;
        const hoursSinceLastMaintenance = plan.totalHours - lastPerformed;
        
        if (hoursSinceLastMaintenance >= plan.periodicIntervalHours) {
          isDue = true;
        }
      }
      
      // Check if due based on cycles
      if (plan.periodicIntervalCycles && plan.totalCycles) {
        const lastPerformed = plan.lastPerformedCycles || 0;
        const cyclesSinceLastMaintenance = plan.totalCycles - lastPerformed;
        
        if (cyclesSinceLastMaintenance >= plan.periodicIntervalCycles) {
          isDue = true;
        }
      }
      
      if (isDue) {
        duePlans.push({
          ...plan,
          overdueHours: plan.totalHours - (plan.lastPerformedHours || 0) - (plan.periodicIntervalHours || 0)
        });
      }
    }
    
    res.json(duePlans);
  } catch (err) {
    console.error('Due maintenance plans error:', err);
    res.status(500).json({ error: err.message });
  }
});

// =============== MAINTENANCE AUTOMATION ===============
// Check and create periodic maintenance tasks
router.post('/maintenance-plans/check-periodic', async (req, res) => {
  try {
    // Get all active periodic maintenance plans
    const periodicPlans = await dbAll(
      `SELECT mp.*, e.totalHours, e.totalCycles 
       FROM maintenance_plans mp 
       JOIN engines e ON mp.engineId = e.id 
       WHERE mp.maintenanceType = 'periodic' 
       AND mp.status IN ('Approved', 'Active')`
    );
    
    const newMaintenanceTasks = [];
    
    for (const plan of periodicPlans) {
      let needsMaintenance = false;
      
      // Check if maintenance is due based on hours
      if (plan.periodicIntervalHours && plan.totalHours) {
        const lastPerformed = plan.lastPerformedHours || 0;
        const hoursSinceLastMaintenance = plan.totalHours - lastPerformed;
        
        if (hoursSinceLastMaintenance >= plan.periodicIntervalHours) {
          needsMaintenance = true;
        }
      }
      
      // Check if maintenance is due based on cycles
      if (plan.periodicIntervalCycles && plan.totalCycles) {
        const lastPerformed = plan.lastPerformedCycles || 0;
        const cyclesSinceLastMaintenance = plan.totalCycles - lastPerformed;
        
        if (cyclesSinceLastMaintenance >= plan.periodicIntervalCycles) {
          needsMaintenance = true;
        }
      }
      
      if (needsMaintenance) {
        // Calculate next due
        let nextDueHours = null;
        if (plan.periodicIntervalHours) {
          nextDueHours = plan.totalHours + plan.periodicIntervalHours;
        }
        
        // Create new maintenance task
        const result = await dbRun(
          `INSERT INTO maintenance_plans 
           (engineId, planType, maintenanceType, description, scheduledDate, dueHours, dueCycles, 
            periodicIntervalHours, periodicIntervalCycles, status, createdBy, createdAt) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            plan.engineId,
            plan.planType,
            'one-time', // Generated task is one-time
            `${plan.description} (Otomatik Oluşturuldu)`,
            new Date().toISOString(),
            plan.totalHours,
            plan.totalCycles,
            null,
            null,
            'Pending',
            'System',
            new Date().toISOString()
          ]
        );
        
        // Update parent plan's last performed
        await dbRun(
          'UPDATE maintenance_plans SET lastPerformedHours = ?, nextDueHours = ? WHERE id = ?',
          [plan.totalHours, nextDueHours, plan.id]
        );
        
        newMaintenanceTasks.push({
          id: result.id,
          planId: plan.id,
          engineId: plan.engineId
        });
      }
    }
    
    res.json({ 
      checked: periodicPlans.length,
      created: newMaintenanceTasks.length,
      tasks: newMaintenanceTasks
    });
  } catch (err) {
    console.error('Periodic maintenance check error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get maintenance history for a plan
router.get('/maintenance-plans/:id/history', async (req, res) => {
  try {
    const history = await dbAll(
      `SELECT * FROM maintenance_history 
       WHERE maintenancePlanId = ? 
       ORDER BY performedDate DESC`,
      [req.params.id]
    );
    res.json(history);
  } catch (err) {
    console.error('Maintenance history error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mark maintenance as completed and update periodic tracking
router.patch('/maintenance-plans/:id/complete', async (req, res) => {
  try {
    const { completedBy, completedAt, notes } = req.body;
    
    // Get the maintenance plan
    const plan = await dbGet('SELECT * FROM maintenance_plans WHERE id = ?', [req.params.id]);
    if (!plan) {
      return res.status(404).json({ error: 'Maintenance plan not found' });
    }
    
    // Get engine current hours
    const engine = await dbGet('SELECT totalHours, totalCycles FROM engines WHERE id = ?', [plan.engineId]);
    
    // For periodic plans, just update the tracking and add to history
    // Don't change status to Completed - keep it Active
    if (plan.maintenanceType === 'periodic') {
      // Calculate next due
      let nextDueHours = null;
      let nextDueCycles = null;
      
      if (plan.periodicIntervalHours && engine) {
        nextDueHours = engine.totalHours + plan.periodicIntervalHours;
      }
      if (plan.periodicIntervalCycles && engine) {
        nextDueCycles = engine.totalCycles + plan.periodicIntervalCycles;
      }
      
      // Update parent plan tracking
      await dbRun(
        'UPDATE maintenance_plans SET lastPerformedHours = ?, lastPerformedCycles = ?, nextDueHours = ?, nextDueCycles = ? WHERE id = ?',
        [engine?.totalHours || 0, engine?.totalCycles || 0, nextDueHours, nextDueCycles, plan.id]
      );
      
      // Add to maintenance history
      try {
        await dbRun(
          `INSERT INTO maintenance_history 
           (maintenancePlanId, engineId, performedAtHours, performedAtCycles, performedDate, performedBy, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            plan.id,
            plan.engineId,
            engine?.totalHours || 0,
            engine?.totalCycles || 0,
            completedAt || new Date().toISOString(),
            completedBy,
            notes || null
          ]
        );
      } catch (historyErr) {
        console.error('Failed to insert maintenance history:', historyErr);
        // Continue even if history insert fails
      }
      
      const updated = await dbGet('SELECT * FROM maintenance_plans WHERE id = ?', [plan.id]);
      res.json(updated);
    } else {
      // For one-time plans, mark as completed
      await dbRun(
        'UPDATE maintenance_plans SET status = ?, approvedBy = ?, approvedAt = ? WHERE id = ?',
        ['Completed', completedBy, completedAt || new Date().toISOString(), req.params.id]
      );
      
      const updated = await dbGet('SELECT * FROM maintenance_plans WHERE id = ?', [req.params.id]);
      res.json(updated);
    }
  } catch (err) {
    console.error('Complete maintenance error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

