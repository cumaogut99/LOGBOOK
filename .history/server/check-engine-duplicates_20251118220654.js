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
const dbGet = promisify(db.get);
const dbRun = promisify(db.run);

function flattenComponents(components, result = []) {
    for (const comp of components) {
        result.push({
            id: comp.id,
            serialNumber: comp.serialNumber,
            partNumber: comp.partNumber,
            description: comp.description
        });
        if (comp.children && comp.children.length > 0) {
            flattenComponents(comp.children, result);
        }
    }
    return result;
}

async function checkEngineDuplicates() {
    try {
        console.log('🔍 Motor component tree\'lerinde duplicate kontrol ediliyor...\n');
        
        const engines = await dbAll('SELECT id, serialNumber, components FROM engines');
        
        let totalDuplicatesFound = 0;
        
        for (const engine of engines) {
            const components = JSON.parse(engine.components || '[]');
            const flatComponents = flattenComponents(components);
            
            // Group by serial number
            const serialMap = {};
            for (const comp of flatComponents) {
                if (!serialMap[comp.serialNumber]) {
                    serialMap[comp.serialNumber] = [];
                }
                serialMap[comp.serialNumber].push(comp);
            }
            
            // Find duplicates
            const duplicates = Object.entries(serialMap).filter(([sn, comps]) => comps.length > 1);
            
            if (duplicates.length > 0) {
                console.log(`\n🔧 Motor: ${engine.serialNumber} (ID: ${engine.id})`);
                totalDuplicatesFound += duplicates.length;
                
                for (const [serialNumber, comps] of duplicates) {
                    console.log(`   ⚠️  Seri No: ${serialNumber} - ${comps.length} adet duplicate`);
                    for (const comp of comps) {
                        console.log(`      - ID: ${comp.id}, PN: ${comp.partNumber}, ${comp.description}`);
                    }
                }
            }
        }
        
        if (totalDuplicatesFound === 0) {
            console.log('\n✅ Motor component tree\'lerinde duplicate bulunamadı!');
        } else {
            console.log(`\n📊 Toplam ${totalDuplicatesFound} duplicate seri numarası bulundu`);
            console.log('\n⚠️  NOT: Motor component tree\'sindeki duplicate\'ler manuel olarak düzeltilmeli.');
            console.log('   Montaj (Assembler) sekmesinden swap işlemi yaparak düzeltebilirsiniz.');
        }
        
    } catch (error) {
        console.error('❌ Hata:', error);
    } finally {
        db.close();
    }
}

checkEngineDuplicates();

