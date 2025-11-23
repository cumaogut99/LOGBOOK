const express = require('express');
const router = express.Router();
const { db } = require('../database');

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
    maintenanceType,
    description, 
    scheduledDate, 
    dueHours, 
    dueCycles,
    periodicIntervalHours,
    periodicIntervalCycles,
    lastPerformedHours,
    nextDueHours,
    status, 
    createdBy, 
    createdAt 
  } = req.body;
  
  db.run(
    `INSERT INTO maintenance_plans 
    (engineId, planType, maintenanceType, description, scheduledDate, dueHours, dueCycles, 
     periodicIntervalHours, periodicIntervalCycles, lastPerformedHours, nextDueHours, status, createdBy, createdAt) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [engineId, planType, maintenanceType || 'one-time', description, scheduledDate, dueHours, dueCycles,
     periodicIntervalHours, periodicIntervalCycles, lastPerformedHours, nextDueHours, status, createdBy, createdAt],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(201).json({ 
        id: this.lastID, 
        engineId, 
        planType,
        maintenanceType,
        description, 
        scheduledDate, 
        dueHours, 
        dueCycles,
        periodicIntervalHours,
        periodicIntervalCycles,
        lastPerformedHours,
        nextDueHours,
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
    maintenanceType,
    description, 
    scheduledDate, 
    dueHours, 
    dueCycles,
    periodicIntervalHours,
    periodicIntervalCycles,
    lastPerformedHours,
    nextDueHours,
    status, 
    approvedBy, 
    approvedAt 
  } = req.body;
  
  db.run(
    `UPDATE maintenance_plans 
    SET planType = ?, maintenanceType = ?, description = ?, scheduledDate = ?, dueHours = ?, dueCycles = ?,
        periodicIntervalHours = ?, periodicIntervalCycles = ?, lastPerformedHours = ?, nextDueHours = ?,
        status = ?, approvedBy = ?, approvedAt = ? 
    WHERE id = ?`,
    [planType, maintenanceType, description, scheduledDate, dueHours, dueCycles,
     periodicIntervalHours, periodicIntervalCycles, lastPerformedHours, nextDueHours,
     status, approvedBy, approvedAt, req.params.id],
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
        maintenanceType,
        description, 
        scheduledDate, 
        dueHours, 
        dueCycles,
        periodicIntervalHours,
        periodicIntervalCycles,
        lastPerformedHours,
        nextDueHours,
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

// Check periodic maintenance and generate alerts
router.get('/check-periodic/:engineId', (req, res) => {
  const { engineId } = req.params;
  
  // Get engine
  db.get('SELECT * FROM engines WHERE id = ?', [engineId], (err, engine) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!engine) {
      res.status(404).json({ error: 'Engine not found' });
      return;
    }
    
    // Get active periodic maintenance plans
    db.all(
      `SELECT * FROM maintenance_plans 
       WHERE engineId = ? AND maintenanceType = 'periodic' AND status = 'Active'`,
      [engineId],
      (err, plans) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        const alerts = [];
        plans.forEach(plan => {
          if (plan.periodicIntervalHours && engine.totalHours) {
            const hoursSinceLastMaintenance = engine.totalHours - (plan.lastPerformedHours || 0);
            const hoursUntilNext = plan.periodicIntervalHours - hoursSinceLastMaintenance;
            
            if (hoursUntilNext <= 0) {
              alerts.push({
                ...plan,
                alertType: 'overdue',
                message: `Bakım süresi doldu! ${Math.abs(hoursUntilNext).toFixed(1)} saat gecikme`,
                hoursOverdue: Math.abs(hoursUntilNext)
              });
            } else if (hoursUntilNext <= 10) {
              alerts.push({
                ...plan,
                alertType: 'warning',
                message: `${hoursUntilNext.toFixed(1)} saat sonra bakım gerekli`,
                hoursRemaining: hoursUntilNext
              });
            }
          }
        });
        
        res.json({
          engine,
          periodicPlans: plans,
          alerts
        });
      }
    );
  });
});

// Update next service due for engine based on maintenance plans
router.post('/update-next-service/:engineId', (req, res) => {
  const { engineId } = req.params;
  
  // Get all active periodic plans
  db.all(
    `SELECT * FROM maintenance_plans 
     WHERE engineId = ? AND maintenanceType = 'periodic' AND status = 'Active'
     ORDER BY periodicIntervalHours ASC`,
    [engineId],
    (err, plans) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (plans.length === 0) {
        res.json({ message: 'No periodic plans found' });
        return;
      }
      
      // Get engine current hours
      db.get('SELECT totalHours FROM engines WHERE id = ?', [engineId], (err, engine) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        // Find closest maintenance
        let nextServiceHours = null;
        plans.forEach(plan => {
          if (plan.periodicIntervalHours) {
            const hoursSinceLast = engine.totalHours - (plan.lastPerformedHours || 0);
            const hoursUntilNext = plan.periodicIntervalHours - hoursSinceLast;
            
            if (nextServiceHours === null || hoursUntilNext < nextServiceHours) {
              nextServiceHours = hoursUntilNext;
            }
          }
        });
        
        if (nextServiceHours !== null) {
          // Update engine nextServiceDue
          db.run(
            'UPDATE engines SET nextServiceDue = ? WHERE id = ?',
            [nextServiceHours.toFixed(1), engineId],
            (err) => {
              if (err) {
                res.status(500).json({ error: err.message });
                return;
              }
              res.json({ 
                nextServiceDue: nextServiceHours.toFixed(1),
                message: 'Next service due updated successfully'
              });
            }
          );
        } else {
          res.json({ message: 'Could not calculate next service due' });
        }
      });
    }
  );
});

module.exports = router;
