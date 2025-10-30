const express = require('express');
const router = express.Router();
const db = require('../database');

// Get all test types
router.get('/', (req, res) => {
  db.all('SELECT * FROM test_types ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get test type by ID
router.get('/:id', (req, res) => {
  db.get('SELECT * FROM test_types WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Test type not found' });
      return;
    }
    res.json(row);
  });
});

// Create test type
router.post('/', (req, res) => {
  const { name, description, createdBy, createdAt } = req.body;
  
  db.run(
    'INSERT INTO test_types (name, description, createdBy, createdAt) VALUES (?, ?, ?, ?)',
    [name, description, createdBy, createdAt],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(201).json({ id: this.lastID, name, description, createdBy, createdAt });
    }
  );
});

// Update test type
router.put('/:id', (req, res) => {
  const { name, description } = req.body;
  
  db.run(
    'UPDATE test_types SET name = ?, description = ? WHERE id = ?',
    [name, description, req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Test type not found' });
        return;
      }
      res.json({ id: req.params.id, name, description });
    }
  );
});

// Delete test type
router.delete('/:id', (req, res) => {
  db.run('DELETE FROM test_types WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Test type not found' });
      return;
    }
    res.json({ message: 'Test type deleted successfully' });
  });
});

module.exports = router;
