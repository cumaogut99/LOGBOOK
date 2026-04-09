const express = require('express');
const router = express.Router();
const { db } = require('../database');

// Get all operators
router.get('/', (req, res) => {
  db.all('SELECT * FROM operators ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get operator by ID
router.get('/:id', (req, res) => {
  db.get('SELECT * FROM operators WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Operator not found' });
      return;
    }
    res.json(row);
  });
});

// Create operator
router.post('/', (req, res) => {
  const { name, description, createdBy, createdAt } = req.body;
  
  db.run(
    'INSERT INTO operators (name, description, createdBy, createdAt) VALUES (?, ?, ?, ?)',
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

// Update operator
router.put('/:id', (req, res) => {
  const { name, description } = req.body;
  
  db.run(
    'UPDATE operators SET name = ?, description = ? WHERE id = ?',
    [name, description, req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Operator not found' });
        return;
      }
      res.json({ id: req.params.id, name, description });
    }
  );
});

// Delete operator
router.delete('/:id', (req, res) => {
  db.run('DELETE FROM operators WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Operator not found' });
      return;
    }
    res.json({ message: 'Operator deleted successfully' });
  });
});

module.exports = router;

