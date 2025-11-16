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
    res.json(inventory);
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
    
    const { partNumber, serialNumber, description, location, userName } = req.body;
    
    // Validate required fields
    if (!partNumber || !serialNumber || !description) {
      console.error('Validation Error: Missing required fields');
      return res.status(400).json({ error: 'partNumber, serialNumber, and description are required' });
    }
    
    // quantity alanı DB'de NOT NULL olduğu için default 1 değerini gönderiyoruz
    // Her parçanın benzersiz seri numarası var, UI'da quantity gösterilmiyor
    const result = await dbRun(
      'INSERT INTO inventory (partNumber, serialNumber, description, quantity, location, userName) VALUES (?, ?, ?, ?, ?, ?)',
      [partNumber, serialNumber, description, 1, location || 'Depo', userName]
    );
    
    console.log('Inventory item created successfully with ID:', result.id);
    res.json({ id: result.id, partNumber, serialNumber, description, quantity: 1, location: location || 'Depo', userName });
  } catch (err) {
    console.error('=== INVENTORY CREATE ERROR ===');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: err.message });
  }
});

router.put('/inventory/:id', async (req, res) => {
  try {
    const { partNumber, serialNumber, description, location, userName } = req.body;
    // quantity alanını 1 olarak koruyoruz (DB şeması gereksinimleri)
    await dbRun(
      'UPDATE inventory SET partNumber = ?, serialNumber = ?, description = ?, quantity = ?, location = ?, userName = ? WHERE id = ?',
      [partNumber, serialNumber, description, 1, location, userName, req.params.id]
    );
    res.json({ id: req.params.id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

module.exports = router;

