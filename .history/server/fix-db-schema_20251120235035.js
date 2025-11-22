const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pm-logbook.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Database Repair Tool Starting...\n');

const runQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) {
        // Ignore duplicate column errors
        if (err.message.includes('duplicate column')) {
          resolve({ skipped: true });
        } else {
          reject(err);
        }
      } else {
        resolve({ changes: this.changes });
      }
    });
  });
};

async function fixDatabase() {
  try {
    // 1. Create maintenance_history if not exists
    console.log('Checking maintenance_history table...');
    await runQuery(`CREATE TABLE IF NOT EXISTS maintenance_history (
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
    )`);
    
    // 2. Add missing columns to maintenance_plans
    console.log('Checking maintenance_plans columns...');
    
    const columnsToAdd = [
      'maintenanceType TEXT DEFAULT "one-time"',
      'periodicIntervalHours REAL',
      'periodicIntervalCycles INTEGER',
      'lastPerformedHours REAL',
      'lastPerformedCycles INTEGER',
      'nextDueHours REAL',
      'nextDueCycles INTEGER'
    ];

    for (const colDef of columnsToAdd) {
      try {
        await runQuery(`ALTER TABLE maintenance_plans ADD COLUMN ${colDef}`);
        console.log(`  - Added column: ${colDef.split(' ')[0]}`);
      } catch (e) {
        // Ignore errors (likely column exists)
      }
    }

    // 3. Create Indexes
    console.log('Checking indexes...');
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_maintenance_history_planId ON maintenance_history(maintenancePlanId)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_maintenance_history_engineId ON maintenance_history(engineId)`);

    console.log('\n✅ Database repair completed successfully!');
  } catch (error) {
    console.error('\n❌ Critical error during repair:', error);
  } finally {
    db.close();
  }
}

fixDatabase();

