const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database connection
const dbPath = path.join(__dirname, 'pm-logbook.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database schema
function initializeDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL,
      fullName TEXT NOT NULL
    )`);

    // Engines table
    db.run(`CREATE TABLE IF NOT EXISTS engines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model TEXT NOT NULL,
      serialNumber TEXT NOT NULL,
      status TEXT NOT NULL,
      totalHours REAL NOT NULL DEFAULT 0,
      totalCycles INTEGER NOT NULL DEFAULT 0,
      nextServiceDue TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      components TEXT,
      activityLog TEXT
    )`);

    // Create indexes for engines
    db.run(`CREATE INDEX IF NOT EXISTS idx_engines_serialNumber ON engines(serialNumber)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_engines_status ON engines(status)`);

    // Tests table
    db.run(`CREATE TABLE IF NOT EXISTS tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      engineId INTEGER NOT NULL,
      testType TEXT NOT NULL,
      testCell TEXT NOT NULL,
      description TEXT,
      duration REAL NOT NULL,
      testDate TEXT NOT NULL,
      documentId INTEGER,
      userName TEXT NOT NULL,
      FOREIGN KEY (engineId) REFERENCES engines(id)
    )`);

    // Create indexes for tests
    db.run(`CREATE INDEX IF NOT EXISTS idx_tests_engineId ON tests(engineId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tests_testDate ON tests(testDate)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tests_testType ON tests(testType)`);

    // Faults table
    db.run(`CREATE TABLE IF NOT EXISTS faults (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      engineId INTEGER NOT NULL,
      componentId INTEGER,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      reportDate TEXT NOT NULL,
      status TEXT NOT NULL,
      documentId INTEGER,
      userName TEXT NOT NULL,
      FOREIGN KEY (engineId) REFERENCES engines(id)
    )`);

    // Create indexes for performance
    db.run(`CREATE INDEX IF NOT EXISTS idx_faults_engineId ON faults(engineId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_faults_status ON faults(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_faults_severity ON faults(severity)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_faults_reportDate ON faults(reportDate)`);

    // Swaps table
    db.run(`CREATE TABLE IF NOT EXISTS swaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      engineId INTEGER NOT NULL,
      componentInstalledId INTEGER NOT NULL,
      componentRemovedId INTEGER NOT NULL,
      swapDate TEXT NOT NULL,
      documentId INTEGER,
      userName TEXT NOT NULL,
      FOREIGN KEY (engineId) REFERENCES engines(id)
    )`);

    // Create indexes for swaps
    db.run(`CREATE INDEX IF NOT EXISTS idx_swaps_engineId ON swaps(engineId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_swaps_swapDate ON swaps(swapDate)`);

    // Inventory table
    db.run(`CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partNumber TEXT NOT NULL,
      serialNumber TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      location TEXT NOT NULL,
      userName TEXT NOT NULL
    )`);

    // Documents table (enhanced)
    db.run(`CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fileName TEXT NOT NULL,
      fileData TEXT NOT NULL,
      fileType TEXT,
      fileSize INTEGER,
      relatedType TEXT,
      relatedId INTEGER,
      uploadedBy TEXT,
      uploadedAt TEXT
    )`);

    // Test Types table
    db.run(`CREATE TABLE IF NOT EXISTS test_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )`);

    // Brake Types table
    db.run(`CREATE TABLE IF NOT EXISTS brake_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )`);

    // Maintenance Plans table
    db.run(`CREATE TABLE IF NOT EXISTS maintenance_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      engineId INTEGER NOT NULL,
      planType TEXT NOT NULL,
      description TEXT NOT NULL,
      scheduledDate TEXT NOT NULL,
      dueHours REAL,
      dueCycles INTEGER,
      status TEXT NOT NULL DEFAULT 'Pending',
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      approvedBy TEXT,
      approvedAt TEXT,
      FOREIGN KEY (engineId) REFERENCES engines(id)
    )`);

    // Create indexes for new tables
    db.run(`CREATE INDEX IF NOT EXISTS idx_maintenance_plans_engineId ON maintenance_plans(engineId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_maintenance_plans_status ON maintenance_plans(status)`);

    // Add brakeType column to tests table if it doesn't exist
    db.run(`ALTER TABLE tests ADD COLUMN brakeType TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding brakeType column:', err);
      }
    });

    // Add swapType and assemblyGroup columns to swaps table
    db.run(`ALTER TABLE swaps ADD COLUMN swapType TEXT DEFAULT 'Component'`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding swapType column:', err);
      }
    });

    db.run(`ALTER TABLE swaps ADD COLUMN assemblyGroup TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding assemblyGroup column:', err);
      }
    });

    // Create index for documents after ensuring table structure is correct
    db.run(`CREATE INDEX IF NOT EXISTS idx_documents_related ON documents(relatedType, relatedId)`, (err) => {
      if (err) {
        console.error('Error creating documents index (this is normal if columns don\'t exist yet):', err.message);
      }
    });

    // Insert sample data if tables are empty
    insertSampleData();
  });
}

function insertSampleData() {
  // Check if data already exists
  db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
    if (err) {
      console.error(err);
      return;
    }
    
    if (row.count === 0) {
      console.log('Inserting sample data...');
      
      // Sample users
      const users = [
        { username: 'admin', passwordHash: 'adminpass', role: 'Administrator', fullName: 'Admin User' },
        { username: 'planner', passwordHash: 'plannerpass', role: 'Planning Engineer', fullName: 'Pat Planner' },
        { username: 'testop', passwordHash: 'testoppass', role: 'Test Operator', fullName: 'Terry Operator' },
        { username: 'fault', passwordHash: 'faultpass', role: 'Fault Coordinator', fullName: 'Frank Fault' },
        { username: 'assy', passwordHash: 'assypass', role: 'Assembly Engineer', fullName: 'Annie Assembler' },
        { username: 'readonly', passwordHash: 'readonlypass', role: 'Quality Control Engineer', fullName: 'Quincy Checker' }
      ];

      users.forEach(user => {
        db.run('INSERT INTO users (username, passwordHash, role, fullName) VALUES (?, ?, ?, ?)',
          [user.username, user.passwordHash, user.role, user.fullName]);
      });

      // Sample engines
      const sampleEngines = [
        {
          model: 'PD170',
          serialNumber: 'PD170',
          status: 'Active',
          totalHours: 0.3,
          totalCycles: 0,
          nextServiceDue: 'N/A',
          manufacturer: 'TEI',
          components: JSON.stringify([
            {
              id: 1,
              description: 'Turbodizel (Engine)',
              partNumber: 'Turbodizel',
              serialNumber: 'TMS22013C',
              currentHours: 0.3,
              lifeLimit: 0,
              children: [
                { id: 100, description: 'AM-100', partNumber: 'SA-1761520292323-AM-100', serialNumber: 'SA-1761520292323-AM-100', currentHours: 0.3, lifeLimit: 0 },
                { id: 200, description: 'AM-200', partNumber: 'SA-1761520292323-AM-200', serialNumber: 'SA-1761520292323-AM-200', currentHours: 0.3, lifeLimit: 0 }
              ]
            }
          ]),
          activityLog: JSON.stringify([
            { type: 'Test', details: 'Vibration Analysis (PTS-2)', date: '26.10.2025', duration: 0.3 },
            { type: 'Fault', details: 'Blokta yağ kaçağı görüldü', date: '26.10.2025', severity: 'Major' },
            { type: 'Swap', details: 'Installed Igniter Plug / Removed PC202-456', date: '26.10.2025' }
          ])
        },
        {
          model: 'Scramjet',
          serialNumber: 'X-51A',
          status: 'Active',
          totalHours: 125.5,
          totalCycles: 220,
          nextServiceDue: '25',
          manufacturer: 'AeroCorp',
          components: JSON.stringify([
            { id: 4, description: 'Igniter Plug', partNumber: 'IGN-999', serialNumber: 'SN-IGN-45N-on-X51A', currentHours: 125.5, lifeLimit: 150 }
          ]),
          activityLog: JSON.stringify([])
        },
        {
          model: 'Turbofan',
          serialNumber: 'GE9X-PROTO-02',
          status: 'Maintenance Due',
          totalHours: 873.2,
          totalCycles: 550,
          nextServiceDue: '0',
          manufacturer: 'GE Aviation',
          components: JSON.stringify([]),
          activityLog: JSON.stringify([])
        }
      ];

      sampleEngines.forEach(engine => {
        db.run('INSERT INTO engines (model, serialNumber, status, totalHours, totalCycles, nextServiceDue, manufacturer, components, activityLog) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [engine.model, engine.serialNumber, engine.status, engine.totalHours, engine.totalCycles, engine.nextServiceDue, engine.manufacturer, engine.components, engine.activityLog]);
      });

      // Sample inventory
      const sampleInventory = [
        { partNumber: 'PC-201', serialNumber: 'PC201-123', description: 'PC201-123', quantity: 1, location: 'Warehouse', userName: 'Admin User' },
        { partNumber: 'PC-202', serialNumber: 'PC202-457', description: 'PC202-457', quantity: 1, location: 'Warehouse', userName: 'Admin User' },
        { partNumber: 'SN-IGN-45N', serialNumber: 'SN-IGN-45N', description: 'Igniter Plug', quantity: 1, location: 'Warehouse', userName: 'Admin User' },
        { partNumber: 'PC-301', serialNumber: 'PC301-789', description: 'PC301-789', quantity: 1, location: 'Warehouse', userName: 'Admin User' },
        { partNumber: 'PC-302', serialNumber: 'PC302-111', description: 'PC302-111', quantity: 1, location: 'Warehouse', userName: 'Admin User' },
        { partNumber: 'PC-401', serialNumber: 'PC401-999', description: 'PC401-999', quantity: 1, location: 'Warehouse', userName: 'Admin User' },
        { partNumber: 'SN-BLD-112', serialNumber: 'SN-BLD-112', description: 'Fan Blade', quantity: 1, location: 'Fan Section', userName: 'Admin User' },
        { partNumber: 'SN-JNJ-790', serialNumber: 'SN-JNJ-790', description: 'Fuel Injector', quantity: 1, location: 'Combustor Section', userName: 'Admin User' }
      ];

      sampleInventory.forEach(item => {
        db.run('INSERT INTO inventory (partNumber, serialNumber, description, quantity, location, userName) VALUES (?, ?, ?, ?, ?, ?)',
          [item.partNumber, item.serialNumber, item.description, item.quantity, item.location, item.userName]);
      });

      // Sample tests
      const sampleTests = [
        { engineId: 1, testType: 'Vibration Analysis', testCell: 'PTS-2', description: 'Blok titreşimlerini görmek için üç eksenli ivmeölçerle veri toplandı.', duration: 0.3, testDate: '26.10.2025', userName: 'Terry Operator' },
        { engineId: 2, testType: 'Performance Run', testCell: 'Cell-01 High Alt', description: 'Hypersonic Wind Tunnel Test', duration: 0.5, testDate: '15.10.2025', userName: 'Terry Operator' }
      ];

      sampleTests.forEach(test => {
        db.run('INSERT INTO tests (engineId, testType, testCell, description, duration, testDate, userName) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [test.engineId, test.testType, test.testCell, test.description, test.duration, test.testDate, test.userName]);
      });

      // Sample faults
      const sampleFaults = [
        { engineId: 1, description: 'Blokta yağ kaçağı görüldü', severity: 'Major', reportDate: '26.10.2025', status: 'Open', userName: 'Terry Operator' }
      ];

      sampleFaults.forEach(fault => {
        db.run('INSERT INTO faults (engineId, description, severity, reportDate, status, userName) VALUES (?, ?, ?, ?, ?, ?)',
          [fault.engineId, fault.description, fault.severity, fault.reportDate, fault.status, fault.userName]);
      });

      // Sample swaps
      const sampleSwaps = [
        { engineId: 1, componentInstalledId: 3, componentRemovedId: 2, swapDate: '26.10.2025', userName: 'Annie Assembler' }
      ];

      sampleSwaps.forEach(swap => {
        db.run('INSERT INTO swaps (engineId, componentInstalledId, componentRemovedId, swapDate, userName) VALUES (?, ?, ?, ?, ?)',
          [swap.engineId, swap.componentInstalledId, swap.componentRemovedId, swap.swapDate, swap.userName]);
      });

      // Sample Test Types
      const testTypes = [
        { name: 'Performance Run', description: 'Full performance test', createdBy: 'admin', createdAt: new Date().toISOString() },
        { name: 'Functional Test', description: 'Basic functional test', createdBy: 'admin', createdAt: new Date().toISOString() },
        { name: 'Endurance Test', description: 'Long duration test', createdBy: 'admin', createdAt: new Date().toISOString() },
        { name: 'Cold Start Test', description: 'Cold start performance', createdBy: 'admin', createdAt: new Date().toISOString() },
        { name: 'Hot Start Test', description: 'Hot start performance', createdBy: 'admin', createdAt: new Date().toISOString() },
        { name: 'Other', description: 'Other test type', createdBy: 'admin', createdAt: new Date().toISOString() }
      ];

      testTypes.forEach(type => {
        db.run('INSERT INTO test_types (name, description, createdBy, createdAt) VALUES (?, ?, ?, ?)',
          [type.name, type.description, type.createdBy, type.createdAt]);
      });

      // Sample Brake Types
      const brakeTypes = [
        { name: 'Water Brake', description: 'Hydraulic water brake', createdBy: 'admin', createdAt: new Date().toISOString() },
        { name: 'Eddy Current Brake', description: 'Electromagnetic brake', createdBy: 'admin', createdAt: new Date().toISOString() },
        { name: 'Air Brake', description: 'Pneumatic brake system', createdBy: 'admin', createdAt: new Date().toISOString() },
        { name: 'Dynamometer', description: 'Standard dynamometer', createdBy: 'admin', createdAt: new Date().toISOString() },
        { name: 'Other', description: 'Other brake type', createdBy: 'admin', createdAt: new Date().toISOString() }
      ];

      brakeTypes.forEach(type => {
        db.run('INSERT INTO brake_types (name, description, createdBy, createdAt) VALUES (?, ?, ?, ?)',
          [type.name, type.description, type.createdBy, type.createdAt]);
      });

      console.log('Sample data inserted successfully');
    }
  });
}

module.exports = db;

