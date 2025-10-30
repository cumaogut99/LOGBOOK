const express = require('express');
const router = express.Router();
const db = require('../database');

// Get all maintenance plans or filter by engineId
router.get('/', (req, res) => {
  const { engineId } = req.query;
  
  let query = 'SELECT * FROM maintenance_plans';
  let params = [];
  
  if (engineId) {
    query += ' WHERE engineId = ?';
    params.push(engineId);
  }
  
  query += ' ORDER BY scheduledDate DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get maintenance plan by ID
router.get('/:id', (req, res) => {
  db.get('SELECT * FROM maintenance_plans WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Maintenance plan not found' });
      return;
    }
    res.json(row);
  });
});

// Create maintenance plan
router.post('/', (req, res) => {
  const { 
    engineId, 
    planType, 
    description, 
    scheduledDate, 
    dueHours, 
    dueCycles, 
    status, 
    createdBy, 
    createdAt 
  } = req.body;
  
  db.run(
    `INSERT INTO maintenance_plans 
    (engineId, planType, description, scheduledDate, dueHours, dueCycles, status, createdBy, createdAt) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [engineId, planType, description, scheduledDate, dueHours, dueCycles, status, createdBy, createdAt],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(201).json({ 
        id: this.lastID, 
        engineId, 
        planType, 
        description, 
        scheduledDate, 
        dueHours, 
        dueCycles, 
        status, 
        createdBy, 
        createdAt 
      });
    }
  );
});

// Update maintenance plan
router.put('/:id', (req, res) => {
  const { 
    planType, 
    description, 
    scheduledDate, 
    dueHours, 
    dueCycles, 
    status, 
    approvedBy, 
    approvedAt 
  } = req.body;
  
  db.run(
    `UPDATE maintenance_plans 
    SET planType = ?, description = ?, scheduledDate = ?, dueHours = ?, dueCycles = ?, 
        status = ?, approvedBy = ?, approvedAt = ? 
    WHERE id = ?`,
    [planType, description, scheduledDate, dueHours, dueCycles, status, approvedBy, approvedAt, req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Maintenance plan not found' });
        return;
      }
      res.json({ 
        id: req.params.id, 
        planType, 
        description, 
        scheduledDate, 
        dueHours, 
        dueCycles, 
        status, 
        approvedBy, 
        approvedAt 
      });
    }
  );
});

// Approve maintenance plan
router.patch('/:id/approve', (req, res) => {
  const { approvedBy } = req.body;
  const approvedAt = new Date().toISOString();
  
  db.run(
    'UPDATE maintenance_plans SET status = ?, approvedBy = ?, approvedAt = ? WHERE id = ?',
    ['Approved', approvedBy, approvedAt, req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Maintenance plan not found' });
        return;
      }
      
      // Get the updated plan
      db.get('SELECT * FROM maintenance_plans WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(row);
      });
    }
  );
});

// Delete maintenance plan
router.delete('/:id', (req, res) => {
  db.run('DELETE FROM maintenance_plans WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Maintenance plan not found' });
      return;
    }
    res.json({ message: 'Maintenance plan deleted successfully' });
  });
});

module.exports = router;
