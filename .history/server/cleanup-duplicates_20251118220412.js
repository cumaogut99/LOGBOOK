const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
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

async function cleanupDuplicates() {
    try {
        console.log('🔍 Duplicate seri numaraları aranıyor...');
        
        // Find all duplicate serial numbers
        const duplicates = await dbAll(`
            SELECT serialNumber, COUNT(*) as count
            FROM inventory
            GROUP BY serialNumber
            HAVING count > 1
        `);

        if (duplicates.length === 0) {
            console.log('✅ Duplicate kayıt bulunamadı!');
            db.close();
            return;
        }

        console.log(`⚠️  ${duplicates.length} duplicate seri numarası bulundu`);

        let totalDeleted = 0;

        for (const dup of duplicates) {
            // Get all records with this serial number
            const records = await dbAll(
                'SELECT * FROM inventory WHERE serialNumber = ? ORDER BY id ASC',
                [dup.serialNumber]
            );

            console.log(`\n📦 Seri No: ${dup.serialNumber} - ${records.length} kayıt`);

            // Keep the first one (oldest), delete the rest
            const toKeep = records[0];
            const toDelete = records.slice(1);

            console.log(`   ✓ Korunan: ID ${toKeep.id} - ${toKeep.description}`);

            for (const record of toDelete) {
                await dbRun('DELETE FROM inventory WHERE id = ?', [record.id]);
                console.log(`   ✗ Silinen: ID ${record.id} - ${record.description}`);
                totalDeleted++;
            }
        }

        console.log(`\n✅ Temizleme tamamlandı!`);
        console.log(`📊 Toplam ${totalDeleted} duplicate kayıt silindi`);
        console.log(`📊 ${duplicates.length} farklı seri numarası temizlendi`);

    } catch (error) {
        console.error('❌ Hata:', error);
    } finally {
        db.close();
    }
}

// Run cleanup
cleanupDuplicates();

