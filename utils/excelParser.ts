import * as XLSX from 'xlsx';
import { Component } from '../types';

export interface BuildReportRow {
  altAssyIsmi?: string;
  altAssyPartNumber?: string;
  altAssySerialNumber?: string;
  parcaIsmi: string;
  parcaNumarasi: string;
  parcaSeriNumarasi: string;
  calismaaSaati: number;
  parcaOmru: number;
}

/**
 * Excel'den Build Report'u parse eder
 * Expected columns: Alt Assy İsmi | Alt Assy P/N | Alt Assy S/N | Parça İsmi | Parça P/N | Parça S/N | Çalışma Saati | Parça Ömrü
 */
export function parseBuildReport(file: File): Promise<BuildReportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // İlk sheet'i al
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // JSON'a çevir
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length < 2) {
          throw new Error('Excel dosyası boş veya geçersiz format');
        }
        
        // Header'ı kontrol et (ilk satır)
        const headers = jsonData[0];
        const expectedHeaders = [
          'Alt Assy İsmi',
          'Alt Assy Parça Numarası', 
          'Alt Assy Seri Numarası',
          'Parça İsmi',
          'Parça Numarası',
          'Parça Seri Numarası',
          'Parça Çalışma Saati',
          'Parça Ömrü'
        ];
        
        // Header validation (opsiyonel - case insensitive)
        const normalizedHeaders = headers.map((h: string) => h?.trim().toLowerCase());
        
        // Parse data rows
        const rows: BuildReportRow[] = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          
          // Boş satırları atla
          if (!row || row.length === 0 || !row[3]) continue;
          
          const buildReportRow: BuildReportRow = {
            altAssyIsmi: row[0] && row[0] !== '-' ? String(row[0]).trim() : undefined,
            altAssyPartNumber: row[1] && row[1] !== '-' ? String(row[1]).trim() : undefined,
            altAssySerialNumber: row[2] && row[2] !== '-' ? String(row[2]).trim() : undefined,
            parcaIsmi: String(row[3]).trim(),
            parcaNumarasi: String(row[4]).trim(),
            parcaSeriNumarasi: String(row[5]).trim(),
            calismaaSaati: parseFloat(row[6]) || 0,
            parcaOmru: parseFloat(row[7]) || 0
          };
          
          // Validasyon: Zorunlu alanlar
          if (!buildReportRow.parcaIsmi || !buildReportRow.parcaNumarasi || !buildReportRow.parcaSeriNumarasi) {
            console.warn(`Satır ${i + 1} atlandı: Zorunlu alanlar eksik`, row);
            continue;
          }
          
          rows.push(buildReportRow);
        }
        
        if (rows.length === 0) {
          throw new Error('Excel dosyasında geçerli veri bulunamadı');
        }
        
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Excel dosyası okunamadı'));
    };
    
    reader.readAsBinaryString(file);
  });
}

/**
 * Build Report satırlarından hiyerarşik component tree oluşturur
 */
export function buildComponentTree(rows: BuildReportRow[]): Component[] {
  const components: Component[] = [];
  const assemblyMap = new Map<string, Component>();
  const seenSerials = new Set<string>();
  
  // ID'ler için counter (unique ID oluşturmak için)
  let idCounter = 1;

  const isGeneric = (sn: string) => !sn || sn === '-' || sn === 'N/A' || sn === '';
  
  for (const row of rows) {
    // Assembly var mı?
    if (row.altAssyIsmi && row.altAssyPartNumber && row.altAssySerialNumber) {
      // Assembly key (unique identifier)
      const assemblyKey = `${row.altAssyPartNumber}-${row.altAssySerialNumber}`;
      
      // Assembly'i daha önce görmedik mi?
      let assembly = assemblyMap.get(assemblyKey);
      
      if (!assembly) {
        // Check duplicate assembly SN
        // Eğer SN zaten varsa ve generic değilse, bu assembly'i tekrar oluşturma
        if (!isGeneric(row.altAssySerialNumber) && seenSerials.has(row.altAssySerialNumber)) {
             console.warn(`Duplicate assembly skipped: ${row.altAssySerialNumber}`);
             // Skip creating assembly
        } else {
            // Yeni assembly oluştur
            assembly = {
              id: idCounter++,
              description: row.altAssyIsmi,
              partNumber: row.altAssyPartNumber,
              serialNumber: row.altAssySerialNumber,
              currentHours: row.calismaaSaati,
              lifeLimit: 0, // Assembly'ler genelde life limit'e sahip değil
              children: []
            };
            
            assemblyMap.set(assemblyKey, assembly);
            components.push(assembly);
            if (!isGeneric(row.altAssySerialNumber)) seenSerials.add(row.altAssySerialNumber);
        }
      }
      
      // Assembly'i map'ten tekrar al (yukarıda oluşturulmadıysa undefined kalır)
      assembly = assemblyMap.get(assemblyKey);
      if (!assembly) continue; // Assembly duplicate ise içindeki parçayı da atla

      // Parçayı assembly'nin altına ekle
      if (!isGeneric(row.parcaSeriNumarasi) && seenSerials.has(row.parcaSeriNumarasi)) {
          console.warn(`Duplicate part skipped in assembly: ${row.parcaSeriNumarasi}`);
          continue;
      }

      const part: Component = {
        id: idCounter++,
        description: row.parcaIsmi,
        partNumber: row.parcaNumarasi,
        serialNumber: row.parcaSeriNumarasi,
        currentHours: row.calismaaSaati,
        lifeLimit: row.parcaOmru
      };
      
      assembly.children = assembly.children || [];
      assembly.children.push(part);
      if (!isGeneric(row.parcaSeriNumarasi)) seenSerials.add(row.parcaSeriNumarasi);
      
    } else {
      // Tekli parça (assembly yok)
      if (!isGeneric(row.parcaSeriNumarasi) && seenSerials.has(row.parcaSeriNumarasi)) {
          console.warn(`Duplicate standalone part skipped: ${row.parcaSeriNumarasi}`);
          continue;
      }

      const part: Component = {
        id: idCounter++,
        description: row.parcaIsmi,
        partNumber: row.parcaNumarasi,
        serialNumber: row.parcaSeriNumarasi,
        currentHours: row.calismaaSaati,
        lifeLimit: row.parcaOmru
      };
      
      components.push(part);
      if (!isGeneric(row.parcaSeriNumarasi)) seenSerials.add(row.parcaSeriNumarasi);
    }
  }
  
  return components;
}

/**
 * Mevcut components ile yeni components arasındaki farkları tespit eder
 */
export function compareComponents(
  oldComponents: Component[],
  newComponents: Component[]
): {
  added: Component[];
  removed: Component[];
  updated: Component[];
  unchanged: Component[];
} {
  const result = {
    added: [] as Component[],
    removed: [] as Component[],
    updated: [] as Component[],
    unchanged: [] as Component[]
  };
  
  // Helper: Component'i serial number'a göre bul
  const findBySerial = (components: Component[], serialNumber: string): Component | undefined => {
    for (const comp of components) {
      if (comp.serialNumber === serialNumber) return comp;
      if (comp.children) {
        const found = findBySerial(comp.children, serialNumber);
        if (found) return found;
      }
    }
    return undefined;
  };
  
  // Helper: Tüm component'leri flat list'e çevir
  const flattenComponents = (components: Component[]): Component[] => {
    const flat: Component[] = [];
    for (const comp of components) {
      flat.push(comp);
      if (comp.children) {
        flat.push(...flattenComponents(comp.children));
      }
    }
    return flat;
  };
  
  const oldFlat = flattenComponents(oldComponents);
  const newFlat = flattenComponents(newComponents);
  
  // Yeni component'leri kontrol et
  for (const newComp of newFlat) {
    const oldComp = oldFlat.find(c => c.serialNumber === newComp.serialNumber);
    
    if (!oldComp) {
      result.added.push(newComp);
    } else {
      // Değişiklik var mı?
      if (
        oldComp.currentHours !== newComp.currentHours ||
        oldComp.lifeLimit !== newComp.lifeLimit ||
        oldComp.partNumber !== newComp.partNumber ||
        oldComp.description !== newComp.description
      ) {
        result.updated.push(newComp);
      } else {
        result.unchanged.push(newComp);
      }
    }
  }
  
  // Kaldırılan component'leri kontrol et
  for (const oldComp of oldFlat) {
    const exists = newFlat.find(c => c.serialNumber === oldComp.serialNumber);
    if (!exists) {
      result.removed.push(oldComp);
    }
  }
  
  return result;
}

