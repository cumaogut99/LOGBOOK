const { db } = require('./database');

// Helper to get data from DB
function dbAll(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbRun(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function cleanDuplicates() {
  try {
    console.log('🔍 Duplicate scan started...');
    const engines = await dbAll('SELECT * FROM engines');
    
    for (const engine of engines) {
      let components = JSON.parse(engine.components || '[]');
      let seenSerials = new Set();
      let removedCount = 0;

      // Recursive function to filter duplicates
      function filterComponents(comps) {
        return comps.filter(comp => {
          // If generic description or no serial, keep it (or define rules for generic parts)
          // Assuming parts with serial numbers MUST be unique
          if (comp.serialNumber && comp.serialNumber !== '-' && comp.serialNumber !== 'N/A') {
            if (seenSerials.has(comp.serialNumber)) {
              console.log(`🗑️ Duplicate found in Engine ${engine.serialNumber}: ${comp.description} (${comp.serialNumber})`);
              removedCount++;
              return false; // Remove this component
            }
            seenSerials.add(comp.serialNumber);
          }

          // Recursively filter children
          if (comp.children && comp.children.length > 0) {
            comp.children = filterComponents(comp.children);
          }
          
          return true; // Keep this component
        });
      }

      const cleanedComponents = filterComponents(components);

      if (removedCount > 0) {
        console.log(`💾 Updating Engine ${engine.serialNumber}... Removed ${removedCount} duplicates.`);
        await dbRun('UPDATE engines SET components = ? WHERE id = ?', [JSON.stringify(cleanedComponents), engine.id]);
      }
    }

    console.log('✅ Cleanup completed successfully.');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

cleanDuplicates();

