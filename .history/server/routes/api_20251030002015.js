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
    res.json(parseEngine(engine));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/engines', async (req, res) => {
  try {
    const { model, serialNumber, status, totalHours, totalCycles, nextServiceDue, manufacturer, components, activityLog } = req.body;
    const result = await dbRun(
      'INSERT INTO engines (model, serialNumber, status, totalHours, totalCycles, nextServiceDue, manufacturer, components, activityLog) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [model, serialNumber, status, totalHours || 0, totalCycles || 0, nextServiceDue, manufacturer, JSON.stringify(components || []), JSON.stringify(activityLog || [])]
    );
    res.json({ id: result.id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/engines/:id', async (req, res) => {
  try {
    const { model, serialNumber, status, totalHours, totalCycles, nextServiceDue, manufacturer, components, activityLog } = req.body;
    await dbRun(
      'UPDATE engines SET model = ?, serialNumber = ?, status = ?, totalHours = ?, totalCycles = ?, nextServiceDue = ?, manufacturer = ?, components = ?, activityLog = ? WHERE id = ?',
      [model, serialNumber, status, totalHours, totalCycles, nextServiceDue, manufacturer, JSON.stringify(components), JSON.stringify(activityLog), req.params.id]
    );
    res.json({ id: req.params.id, ...req.body });
  } catch (err) {
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
    const { engineId, testType, testCell, description, duration, testDate, documentId, userName } = req.body;
    const result = await dbRun(
      'INSERT INTO tests (engineId, testType, testCell, description, duration, testDate, documentId, userName) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [engineId, testType, testCell, description, duration, testDate, documentId, userName]
    );
    res.json({ id: result.id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/tests/:id', async (req, res) => {
  try {
    const { engineId, testType, testCell, description, duration, testDate, documentId, userName } = req.body;
    await dbRun(
      'UPDATE tests SET engineId = ?, testType = ?, testCell = ?, description = ?, duration = ?, testDate = ?, documentId = ?, userName = ? WHERE id = ?',
      [engineId, testType, testCell, description, duration, testDate, documentId, userName, req.params.id]
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
    const { engineId, componentId, description, severity, reportDate, status, documentId, userName } = req.body;
    const result = await dbRun(
      'INSERT INTO faults (engineId, componentId, description, severity, reportDate, status, documentId, userName) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [engineId, componentId, description, severity, reportDate, status, documentId, userName]
    );
    res.json({ id: result.id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/faults/:id', async (req, res) => {
  try {
    const { engineId, componentId, description, severity, reportDate, status, documentId, userName } = req.body;
    await dbRun(
      'UPDATE faults SET engineId = ?, componentId = ?, description = ?, severity = ?, reportDate = ?, status = ?, documentId = ?, userName = ? WHERE id = ?',
      [engineId, componentId, description, severity, reportDate, status, documentId, userName, req.params.id]
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
    const { engineId, componentInstalledId, componentRemovedId, swapDate, documentId, userName } = req.body;
    const result = await dbRun(
      'INSERT INTO swaps (engineId, componentInstalledId, componentRemovedId, swapDate, documentId, userName) VALUES (?, ?, ?, ?, ?, ?)',
      [engineId, componentInstalledId, componentRemovedId, swapDate, documentId, userName]
    );
    res.json({ id: result.id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/swaps/:id', async (req, res) => {
  try {
    const { engineId, componentInstalledId, componentRemovedId, swapDate, documentId, userName } = req.body;
    await dbRun(
      'UPDATE swaps SET engineId = ?, componentInstalledId = ?, componentRemovedId = ?, swapDate = ?, documentId = ?, userName = ? WHERE id = ?',
      [engineId, componentInstalledId, componentRemovedId, swapDate, documentId, userName, req.params.id]
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
    const { partNumber, serialNumber, description, quantity, location, userName } = req.body;
    const result = await dbRun(
      'INSERT INTO inventory (partNumber, serialNumber, description, quantity, location, userName) VALUES (?, ?, ?, ?, ?, ?)',
      [partNumber, serialNumber, description, quantity, location, userName]
    );
    res.json({ id: result.id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/inventory/:id', async (req, res) => {
  try {
    const { partNumber, serialNumber, description, quantity, location, userName } = req.body;
    await dbRun(
      'UPDATE inventory SET partNumber = ?, serialNumber = ?, description = ?, quantity = ?, location = ?, userName = ? WHERE id = ?',
      [partNumber, serialNumber, description, quantity, location, userName, req.params.id]
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
    const { fileName, fileData } = req.body;
    const result = await dbRun(
      'INSERT INTO documents (fileName, fileData) VALUES (?, ?)',
      [fileName, fileData]
    );
    res.json({ id: result.id, fileName });
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

module.exports = router;

