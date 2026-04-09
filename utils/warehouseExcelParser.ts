import * as XLSX from 'xlsx';

/**
 * Depo toplu yükleme Excel formatı (BR ile aynı sütun düzeni + Konum sütunu)
 *
 * Sütun sırası:
 * A: Alt Assy İsmi         (opsiyonel)
 * B: Alt Assy Parça No     (opsiyonel)
 * C: Alt Assy Seri No      (opsiyonel)
 * D: Parça İsmi            (zorunlu)
 * E: Parça Numarası        (zorunlu)
 * F: Parça Seri Numarası   (zorunlu)
 * G: Çalışma Saati         (sayı, opsiyonel)
 * H: Parça Ömrü            (sayı, opsiyonel)
 * I: Konum                 (metin, opsiyonel — yoksa "Depo" varsayılır)
 */
export interface WarehouseExcelRow {
  altAssyIsmi?: string;
  altAssyPartNumber?: string;
  altAssySerialNumber?: string;
  parcaIsmi: string;
  parcaNumarasi: string;
  parcaSeriNumarasi: string;
  currentHours: number;
  lifeLimit: number;
  location: string;
}

export interface WarehouseImportResult {
  rows: WarehouseExcelRow[];
  skipped: { rowIndex: number; reason: string }[];
}

export function parseWarehouseExcel(file: File): Promise<WarehouseImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
          throw new Error('Excel dosyası boş veya geçersiz format');
        }

        const rows: WarehouseExcelRow[] = [];
        const skipped: { rowIndex: number; reason: string }[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];

          // Boş satırları atla
          if (!row || row.length === 0 || !row[3]) continue;

          const parcaIsmi = row[3] != null ? String(row[3]).trim() : '';
          const parcaNumarasi = row[4] != null ? String(row[4]).trim() : '';
          const parcaSeriNumarasi = row[5] != null ? String(row[5]).trim() : '';

          if (!parcaIsmi || !parcaNumarasi || !parcaSeriNumarasi) {
            skipped.push({
              rowIndex: i + 1,
              reason: `Zorunlu alanlar eksik (Parça İsmi/Numarası/Seri Numarası)`
            });
            continue;
          }

          rows.push({
            altAssyIsmi: row[0] && row[0] !== '-' ? String(row[0]).trim() : undefined,
            altAssyPartNumber: row[1] && row[1] !== '-' ? String(row[1]).trim() : undefined,
            altAssySerialNumber: row[2] && row[2] !== '-' ? String(row[2]).trim() : undefined,
            parcaIsmi,
            parcaNumarasi,
            parcaSeriNumarasi,
            currentHours: parseFloat(row[6]) || 0,
            lifeLimit: parseFloat(row[7]) || 0,
            location: row[8] && String(row[8]).trim() ? String(row[8]).trim() : 'Depo'
          });
        }

        if (rows.length === 0) {
          throw new Error('Excel dosyasında geçerli veri bulunamadı');
        }

        resolve({ rows, skipped });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Excel dosyası okunamadı'));
    reader.readAsBinaryString(file);
  });
}

/**
 * Depo toplu yükleme için örnek Excel şablonu indirir
 */
export function downloadWarehouseTemplate() {
  const headers = [
    'Alt Assy İsmi',
    'Alt Assy Parça Numarası',
    'Alt Assy Seri Numarası',
    'Parça İsmi',
    'Parça Numarası',
    'Parça Seri Numarası',
    'Çalışma Saati',
    'Parça Ömrü',
    'Konum'
  ];

  const sampleRows = [
    ['Silindir Kafası', 'CH-001', 'CH-SN-001', 'Supap Yayı', 'VS-001', 'VS-SN-001', 120, 6000, 'Raf A-1'],
    ['Silindir Kafası', 'CH-001', 'CH-SN-001', 'Supap', 'V-001', 'V-SN-001', 120, 6000, 'Raf A-1'],
    ['', '', '', 'Piston Segmanı', 'PR-001', 'PR-SN-001', 80, 4500, 'Raf B-3'],
  ];

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Sütun genişlikleri
  ws['!cols'] = [
    { wch: 22 }, { wch: 22 }, { wch: 22 },
    { wch: 22 }, { wch: 18 }, { wch: 18 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Depo Parçaları');
  XLSX.writeFile(wb, 'depo_toplu_yukleme_sablonu.xlsx');
}
