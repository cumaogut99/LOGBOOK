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
    const seen = new Set();
    let duplicatesRemoved = 0;
    
    function cleanArray(comps) {
        const cleaned = [];
        
        for (const comp of comps) {
            const key = `${comp.serialNumber}-${comp.partNumber}`;
            
            if (!seen.has(key)) {
                seen.add(key);
                
                // Recursively clean children
                if (comp.children && comp.children.length > 0) {
                    const result = cleanArray(comp.children);
                    comp.children = result.cleaned;
                    duplicatesRemoved += result.removed;
                }
                
                cleaned.push(comp);
            } else {
                duplicatesRemoved++;
                console.log(`   ✗ Duplicate kaldırıldı: ${comp.serialNumber} - ${comp.description}`);
            }
        }
        
        return { cleaned, removed: duplicatesRemoved };
    }
    
    const result = cleanArray(components);
    return { components: result.cleaned, duplicatesRemoved: result.removed };
}

async function fixEngineDuplicates() {
    try {
        console.log('🔧 Motor component tree duplicate\'leri temizleniyor...\n');
        
        const engines = await dbAll('SELECT id, serialNumber, components FROM engines');
        
        let totalDuplicatesRemoved = 0;
        let enginesFixed = 0;
        
        for (const engine of engines) {
            const components = JSON.parse(engine.components || '[]');
            const originalCount = JSON.stringify(components).length;
            
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
            }
        }
        
        if (enginesFixed === 0) {
            console.log('✅ Hiçbir motorda duplicate bulunamadı!');
        } else {
            console.log(`\n✅ Temizleme tamamlandı!`);
            console.log(`📊 ${enginesFixed} motor güncellendi`);
            console.log(`📊 Toplam ${totalDuplicatesRemoved} duplicate component kaldırıldı`);
        }
        
    } catch (error) {
        console.error('❌ Hata:', error);
    } finally {
        db.close();
    }
}

fixEngineDuplicates();

