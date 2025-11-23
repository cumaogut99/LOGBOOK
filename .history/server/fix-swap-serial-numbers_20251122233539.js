const { db } = require('./database');

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

async function fixSwapSerialNumbers() {
  try {
    console.log('🔍 Checking swap records...');
    
    const swaps = await dbAll('SELECT * FROM swaps');
    const engines = await dbAll('SELECT * FROM engines');
    
    let fixedCount = 0;

    for (const swap of swaps) {
      let needsUpdate = false;
      let updates = {};

      // If removed serial number is missing but we have componentRemovedId
      if ((!swap.removedSerialNumber || swap.removedSerialNumber === 'null') && swap.componentRemovedId && swap.componentRemovedId !== 0) {
        // Try to find in engines (it might have been removed from motor but serial is known)
        for (const engine of engines) {
          let components = [];
          try {
            components = JSON.parse(engine.components || '[]');
          } catch(e) {}
          
          const findById = (comps, id) => {
            for (const comp of comps) {
              if (comp.id === id) return comp;
              if (comp.children) {
                const found = findById(comp.children, id);
                if (found) return found;
              }
            }
            return null;
          };
          
          const comp = findById(components, swap.componentRemovedId);
          if (comp && comp.serialNumber) {
            updates.removedSerialNumber = comp.serialNumber;
            needsUpdate = true;
            console.log(`✅ Found removed SN for swap ${swap.id}: ${comp.serialNumber}`);
            break;
          }
        }
      }

      // If installed serial number is missing but we have componentInstalledId
      if ((!swap.installedSerialNumber || swap.installedSerialNumber === 'null') && swap.componentInstalledId && swap.componentInstalledId !== 0) {
        for (const engine of engines) {
          let components = [];
          try {
            components = JSON.parse(engine.components || '[]');
          } catch(e) {}
          
          const findById = (comps, id) => {
            for (const comp of comps) {
              if (comp.id === id) return comp;
              if (comp.children) {
                const found = findById(comp.children, id);
                if (found) return found;
              }
            }
            return null;
          };
          
          const comp = findById(components, swap.componentInstalledId);
          if (comp && comp.serialNumber) {
            updates.installedSerialNumber = comp.serialNumber;
            needsUpdate = true;
            console.log(`✅ Found installed SN for swap ${swap.id}: ${comp.serialNumber}`);
            break;
          }
        }
      }

      if (needsUpdate) {
        const fields = [];
        const values = [];
        
        if (updates.removedSerialNumber) {
          fields.push('removedSerialNumber = ?');
          values.push(updates.removedSerialNumber);
        }
        if (updates.installedSerialNumber) {
          fields.push('installedSerialNumber = ?');
          values.push(updates.installedSerialNumber);
        }
        
        values.push(swap.id);
        
        await dbRun(
          `UPDATE swaps SET ${fields.join(', ')} WHERE id = ?`,
          values
        );
        fixedCount++;
      }
    }

    console.log(`\n✅ Fixed ${fixedCount} swap records.`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixSwapSerialNumbers();

