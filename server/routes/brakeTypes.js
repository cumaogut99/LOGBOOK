const express = require('express');
const router = express.Router();
const db = require('../database');

// Get all brake types
router.get('/', (req, res) => {
  db.all('SELECT * FROM brake_types ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get brake type by ID
router.get('/:id', (req, res) => {
  db.get('SELECT * FROM brake_types WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Brake type not found' });
      return;
    }
    res.json(row);
  });
});

// Create brake type
router.post('/', (req, res) => {
  const { name, description, createdBy, createdAt } = req.body;
  
  db.run(
    'INSERT INTO brake_types (name, description, createdBy, createdAt) VALUES (?, ?, ?, ?)',
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

// Update brake type
router.put('/:id', (req, res) => {
  const { name, description } = req.body;
  
  db.run(
    'UPDATE brake_types SET name = ?, description = ? WHERE id = ?',
    [name, description, req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Brake type not found' });
        return;
      }
      res.json({ id: req.params.id, name, description });
    }
  );
});

// Delete brake type
router.delete('/:id', (req, res) => {
  db.run('DELETE FROM brake_types WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Brake type not found' });
      return;
    }
    res.json({ message: 'Brake type deleted successfully' });
  });
});

module.exports = router;
