const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pm-logbook.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Creating maintenance_history table...\n');

db.serialize(() => {
  // Create maintenance_history table
  db.run(`CREATE TABLE IF NOT EXISTS maintenance_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    maintenancePlanId INTEGER NOT NULL,
    engineId INTEGER NOT NULL,
    performedAtHours REAL,
    performedAtCycles INTEGER,
    performedDate TEXT NOT NULL,
    performedBy TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY (maintenancePlanId) REFERENCES maintenance_plans(id),
    FOREIGN KEY (engineId) REFERENCES engines(id)
  )`, (err) => {
    if (err) {
      console.error('❌ Error creating table:', err);
    } else {
      console.log('✅ maintenance_history table created successfully');
    }
  });

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_maintenance_history_planId ON maintenance_history(maintenancePlanId)`, (err) => {
    if (err) {
      console.error('❌ Error creating planId index:', err);
    } else {
      console.log('✅ Index idx_maintenance_history_planId created');
    }
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_maintenance_history_engineId ON maintenance_history(engineId)`, (err) => {
    if (err) {
      console.error('❌ Error creating engineId index:', err);
    } else {
      console.log('✅ Index idx_maintenance_history_engineId created');
    }
    
    // Close database after last operation
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err);
      } else {
        console.log('\n✅ Database closed. Table setup complete!');
      }
    });
  });
});

