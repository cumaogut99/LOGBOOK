const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pm-logbook.db');
const db = new sqlite3.Database(dbPath);

function promisify(fn) {
    return function(...args) {
        return new Promise((resolve, reject) => {
            fn.call(db, ...args, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    };
}

const dbAll = promisify(db.all);
const dbRun = promisify(db.run);

function removeDuplicateComponents(components) {
    const seenIds = new Set();
    const seenSerialNumbers = new Set();
    let duplicatesRemoved = 0;
    
    function cleanArray(comps) {
        const cleaned = [];
        
        for (const comp of comps) {
            // Check both ID and serial number for duplicates
            const isDuplicateId = seenIds.has(comp.id);
            const isDuplicateSerial = seenSerialNumbers.has(comp.serialNumber);
            
            if (!isDuplicateId && !isDuplicateSerial) {
                seenIds.add(comp.id);
                seenSerialNumbers.add(comp.serialNumber);
                
                // Recursively clean children
                if (comp.children && comp.children.length > 0) {
                    const result = cleanArray(comp.children);
                    comp.children = result.cleaned;
                    duplicatesRemoved += result.removed;
                }
                
                cleaned.push(comp);
            } else {
                duplicatesRemoved++;
                console.log(`   ✗ Duplicate kaldırıldı: ID=${comp.id}, SN=${comp.serialNumber}, ${comp.description}`);
            }
        }
        
        return { cleaned, removed: duplicatesRemoved };
    }
    
    const result = cleanArray(components);
    return { components: result.cleaned, duplicatesRemoved: result.removed };
}

async function fixDuplicates() {
    try {
        console.log('🔧 Motor component tree duplicate\'leri temizleniyor...\n');
        
        const engines = await dbAll('SELECT id, serialNumber, components FROM engines');
        
        let totalDuplicatesRemoved = 0;
        let enginesFixed = 0;
        
        for (const engine of engines) {
            const components = JSON.parse(engine.components || '[]');
            
            const result = removeDuplicateComponents(components);
            
            if (result.duplicatesRemoved > 0) {
                console.log(`\n🔧 Motor: ${engine.serialNumber} (ID: ${engine.id})`);
                
                // Update engine with cleaned components
                await dbRun(
                    'UPDATE engines SET components = ? WHERE id = ?',
                    [JSON.stringify(result.components), engine.id]
                );
                
                totalDuplicatesRemoved += result.duplicatesRemoved;
                enginesFixed++;
                
                console.log(`   ✅ ${result.duplicatesRemoved} duplicate component kaldırıldı`);
            } else {
                console.log(`✓ Motor: ${engine.serialNumber} - duplicate yok`);
            }
        }
        
        console.log(`\n${'='.repeat(50)}`);
        if (enginesFixed === 0) {
            console.log('✅ Hiçbir motorda duplicate bulunamadı!');
        } else {
            console.log(`✅ Temizleme tamamlandı!`);
            console.log(`📊 ${enginesFixed} motor güncellendi`);
            console.log(`📊 Toplam ${totalDuplicatesRemoved} duplicate component kaldırıldı`);
        }
        
    } catch (error) {
        console.error('❌ Hata:', error);
    } finally {
        db.close();
    }
}

fixDuplicates();

