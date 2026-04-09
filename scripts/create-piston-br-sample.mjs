/**
 * Gerçekçi ölçekte pistonlu motor Build Report (.xlsx) üretir:
 * - 10+ alt montaj (alt assy)
 * - 500+ parça satırı
 *
 * Çalıştır: node scripts/create-piston-br-sample.mjs
 */
import XLSX from 'xlsx';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'samples');

const HEADER = [
  'Alt Assy İsmi',
  'Alt Assy Parça Numarası',
  'Alt Assy Seri Numarası',
  'Parça İsmi',
  'Parça Numarası',
  'Parça Seri Numarası',
  'Parça Çalışma Saati',
  'Parça Ömrü',
];

/** Motor üzerindeki ortak çalışma saati (örnek) */
const ENGINE_HOURS = 428.35;

/**
 * Parça ömrü (saat) — hiçbir satırda 0 kullanılmaz.
 * “Sonsuz” yapı parçalar için yüksek limit (ör. motor ömrü / overhaul aralığı).
 */
const LIFE = {
  structural: 80000,
  casting: 80000,
  bolt: 15000,
  gasket: 4500,
  sensor: 12000,
  seat: 6000,
  plug: 9000,
  jet: 6000,
  line: 20000,
  hose: 12000,
  bracket: 25000,
  electrical: 15000,
  pinSmall: 10000,
  shim: 15000,
  shield: 8000,
  ringClip: 5000,
  turboHot: 12000,
  cat: 60000,
  filterHousing: 30000,
  separator: 12000,
  pulley: 12000,
  harness: 18000,
};

/** Global benzersiz seri (parser duplicate atlar) */
let serialSeq = 880000;

function nextSerial(prefix = 'TEI') {
  serialSeq += 1;
  return `SN-${prefix}-${String(serialSeq).slice(-8)}`;
}

function pushAssyRow(rows, assy, desc, partPn, life) {
  rows.push([
    assy.name,
    assy.pn,
    assy.sn,
    desc,
    partPn,
    nextSerial(),
    ENGINE_HOURS,
    life,
  ]);
}

function pushStandalone(rows, desc, partPn, life) {
  rows.push(['-', '-', '-', desc, partPn, nextSerial(), ENGINE_HOURS, life]);
}

// --- Alt montaj tanımları (V12, iki bank + 12 silindir + sistem modülleri) ---

function buildHeadBankRows(bank, cylStart, cylEnd) {
  const name = `Silindir Kafası Bank ${bank}`;
  const pn = `SK-V12-${bank}`;
  const sn = `ASM-SK-V12-${bank}-2024`;
  const assy = { name, pn, sn };
  const rows = [];

  for (let c = cylStart; c <= cylEnd; c++) {
    pushAssyRow(rows, assy, `Emme Supabı Silindir ${c}`, `SPV-EM-V12-${String(c).padStart(2, '0')}`, 4500);
    pushAssyRow(rows, assy, `Egzoz Supabı Silindir ${c}`, `SPV-EG-V12-${String(c).padStart(2, '0')}`, 4500);
    pushAssyRow(rows, assy, `Emme Supap Yayı Sil ${c}`, `SPY-EM-V12-${String(c).padStart(2, '0')}`, 3000);
    pushAssyRow(rows, assy, `Egzoz Supap Yayı Sil ${c}`, `SPY-EG-V12-${String(c).padStart(2, '0')}`, 3000);
    pushAssyRow(rows, assy, `Supap Oturağı (Emme) Sil ${c}`, `STS-EM-V12-${String(c).padStart(2, '0')}`, LIFE.seat);
    pushAssyRow(rows, assy, `Supap Oturağı (Egzoz) Sil ${c}`, `STS-EG-V12-${String(c).padStart(2, '0')}`, LIFE.seat);
    pushAssyRow(rows, assy, `Supap Klavuzu Emme Sil ${c}`, `GD-EM-V12-${String(c).padStart(2, '0')}`, 8000);
    pushAssyRow(rows, assy, `Supap Klavuzu Egzoz Sil ${c}`, `GD-EG-V12-${String(c).padStart(2, '0')}`, 8000);
    pushAssyRow(rows, assy, `Buji Silindir ${c}`, `SPK-IR-V12-${String(c).padStart(2, '0')}`, 2500);
    pushAssyRow(rows, assy, `Direkt Enjektör Silindir ${c}`, `INJ-DI-V12-${String(c).padStart(2, '0')}`, 6000);
  }

  // Bank ortak: kapak contası, civata setleri, yağlama / su tapaları
  for (let i = 1; i <= 14; i++) {
    pushAssyRow(rows, assy, `Silindir Kafası Kapak Civatası M10 (${i})`, `BLT-HC-M10-${String(i).padStart(2, '0')}`, LIFE.bolt);
  }
  for (let i = 1; i <= 8; i++) {
    pushAssyRow(rows, assy, `Eksantrik Kapak Civatası (${bank}-${i})`, `BLT-CC-${bank}-${i}`, LIFE.bolt);
  }
  pushAssyRow(rows, assy, `Üst Kapak Contası Bank ${bank}`, `GSK-UC-${bank}-V12`, LIFE.gasket);
  pushAssyRow(rows, assy, `Eksantrik Contası Bank ${bank}`, `GSK-CC-${bank}-V12`, LIFE.gasket);
  pushAssyRow(rows, assy, `Emme Kanalı Sensörü Bank ${bank}`, `SNS-MAP-${bank}-01`, LIFE.sensor);
  pushAssyRow(rows, assy, `Yağ Besleme Tapası Bank ${bank}`, `PLG-OIL-${bank}-01`, LIFE.plug);

  return rows;
}

function buildPistonRodAssembly(cylinderIndex) {
  const c = String(cylinderIndex).padStart(2, '0');
  const name = `Piston–Kol Grubu Silindir ${c}`;
  const pn = `PKG-V12-S${c}`;
  const sn = `ASM-PKG-V12-${c}-2024`;
  const assy = { name, pn, sn };
  const rows = [];

  const parts = [
    ['Piston Gövdesi', `PST-V12-${c}`, 6500],
    ['Segman Üst', `RNG-U-V12-${c}`, 4000],
    ['Segman Orta', `RNG-M-V12-${c}`, 4000],
    ['Segman Yağ', `RNG-O-V12-${c}`, 4000],
    ['Piston Pimi', `PIN-V12-${c}`, 8000],
    ['Pimi Segmanı', `CIR-PIN-${c}`, LIFE.ringClip],
    ['Pimi Civata A', `SCR-PIN-${c}A`, LIFE.bolt],
    ['Pimi Civata B', `SCR-PIN-${c}B`, LIFE.bolt],
    ['Biyel Gövdesi', `CON-V12-${c}`, 8000],
    ['Biyel Kapağı', `CAP-CON-${c}`, 8000],
    ['Biyel Kapak Civata 1', `SCR-CON-${c}1`, LIFE.bolt],
    ['Biyel Kapak Civata 2', `SCR-CON-${c}2`, LIFE.bolt],
    ['Kol Yatak Kabuğu Üst', `BRG-CON-U-${c}`, 4000],
    ['Kol Yatak Kabuğu Alt', `BRG-CON-L-${c}`, 4000],
    ['Biyel Burcu', `BSH-CON-${c}`, 6000],
    ['Kol Yatak Yayı', `SPR-BRG-${c}`, 3000],
    ['Piston Soğutma Memesi', `JET-PIST-${c}`, LIFE.jet],
    ['Külbütör Emme Silindir', `RKR-EM-${c}`, 6000],
    ['Külbütör Egzoz Silindir', `RKR-EG-${c}`, 6000],
    ['Külbütör Mil Burcu', `BSH-RKR-${c}`, 8000],
    ['Yağ Püskürtme Memesi', `JET-OIL-${c}`, LIFE.jet],
    ['Silindir Contası (Tek Sil)', `GSK-CYL-${c}`, LIFE.gasket],
    ['Silindir Gövdesi Burç Takımı', `LIN-CYL-${c}`, 12000],
    ['Krank Dişlisi Hizalama Pul', `SHM-CK-${c}`, LIFE.shim],
    ['Piston Alt Isı Kalkanı', `SHD-HT-${c}`, LIFE.shield],
    ['Biyel Kolu Yağ Kanalı Tapası', `PLG-ROD-${c}`, LIFE.plug],
    ['Kol Yatak Yağ Jeti', `JET-BRG-${c}`, LIFE.jet],
    ['Montaj Kilidi / Segman', `LCK-RNG-${c}`, LIFE.ringClip],
  ];

  for (const [desc, pPn, life] of parts) {
    pushAssyRow(rows, assy, desc, pPn, life);
  }
  return rows;
}

function buildModuleRows(config) {
  const { title, pn, sn, templates } = config;
  const assy = { name: title, pn, sn };
  const rows = [];
  for (const [desc, partPn, life] of templates) {
    pushAssyRow(rows, assy, desc, partPn, life);
  }
  return rows;
}

function generateAllDataRows() {
  const rows = [];

  // 1–2: Silindir kafaları (sol / sağ bank)
  rows.push(...buildHeadBankRows('L', 1, 6));
  rows.push(...buildHeadBankRows('R', 7, 12));

  // 3–14: 12 adet piston–kol alt montajı
  for (let i = 1; i <= 12; i++) {
    rows.push(...buildPistonRodAssembly(i));
  }

  // 15: Triger / zamanlama modülü
  rows.push(
    ...buildModuleRows({
      title: 'Triger ve Eksantrik Tahrik Modülü',
      pn: 'MOD-TIM-V12',
      sn: 'ASM-TIM-V12-001',
      templates: [
        ['Zincir Seti (Üst)', 'CHN-UP-V12', 6000],
        ['Zincir Seti (Alt)', 'CHN-LO-V12', 6000],
        ['Zincir Gerdirici Mekanizması', 'TEN-CHN-V12', 4000],
        ['Zincir Kılavuz Ray Sol', 'GD-CHN-L', 8000],
        ['Zincir Kılavuz Ray Sağ', 'GD-CHN-R', 8000],
        ['Eksantrik Mili Emme Bank L', 'CAM-EM-L', 12000],
        ['Eksantrik Mili Egzoz Bank L', 'CAM-EG-L', 12000],
        ['Eksantrik Mili Emme Bank R', 'CAM-EM-R', 12000],
        ['Eksantrik Mili Egzoz Bank R', 'CAM-EG-R', 12000],
        ['Krank Dişlisi (Zincir)', 'SPK-CRK-48', 12000],
        ['Yağ Pompa Tahrik Dişlisi', 'SPK-OIL-22', 8000],
        ['Su Pompa Tahrik Kasnağı', 'PUL-WTR-01', 6000],
        ['Triger Kapak Contası Ön', 'GSK-TIM-F', LIFE.gasket],
        ['Triger Kapak Contası Arka', 'GSK-TIM-R', LIFE.gasket],
        ['Eksantrik Yatak Kabuğu (Set 1)', 'BRG-CAM-S1', 8000],
        ['Eksantrik Yatak Kabuğu (Set 2)', 'BRG-CAM-S2', 8000],
        ['Eksantrik Yatak Kabuğu (Set 3)', 'BRG-CAM-S3', 8000],
        ['Eksantrik Yatak Kabuğu (Set 4)', 'BRG-CAM-S4', 8000],
        ['Triger Muhafaza Civataları (1–12)', 'BLT-TIM-01', LIFE.bolt],
        ['Triger Muhafaza Civataları (13–24)', 'BLT-TIM-02', LIFE.bolt],
        ['Eksantrik Sensörü Bank L', 'SNS-CAM-L', LIFE.sensor],
        ['Eksantrik Sensörü Bank R', 'SNS-CAM-R', LIFE.sensor],
        ['Faz Regülatör Aktüatörü', 'ACT-VVT-01', 5000],
        ['Faz Regülatör Aktüatörü', 'ACT-VVT-02', 5000],
        ['VVT Yağ Selenoid A', 'SOL-VVT-A', 4000],
        ['VVT Yağ Selenoid B', 'SOL-VVT-B', 4000],
        ['Triger Gergin Bilezik', 'SLV-TEN-01', 6000],
        ['Triger Gergin Bilezik', 'SLV-TEN-02', 6000],
        ['Triger Yağ Püskürtme Memesi', 'JET-TIM-01', LIFE.jet],
        ['Triger Yağ Püskürtme Memesi', 'JET-TIM-02', LIFE.jet],
        ['Ön Krank Keçesi', 'SEAL-CRK-F', 4000],
        ['Arka Krank Keçesi', 'SEAL-CRK-R', 4000],
        ['Triger Kapak Distans Pul', 'SPH-TIM-01', LIFE.shim],
        ['Triger Kapak Distans Pul', 'SPH-TIM-02', LIFE.shim],
        ['Eksantrik Dişli Pimi', 'PIN-CAM-01', LIFE.pinSmall],
        ['Eksantrik Dişli Pimi', 'PIN-CAM-02', LIFE.pinSmall],
        ['Zincir Gergin Plakası', 'PLT-TEN-01', LIFE.structural],
        ['Zincir Gergin Plakası', 'PLT-TEN-02', LIFE.structural],
        ['Triger Modülü Topraklama Tırnağı', 'GRD-TIM-01', LIFE.electrical],
      ],
    })
  );

  // 16: Yağlama
  rows.push(
    ...buildModuleRows({
      title: 'Yağlama ve Filtrasyon Modülü',
      pn: 'MOD-OIL-V12',
      sn: 'ASM-OIL-V12-001',
      templates: (() => {
        const t = [];
        t.push(['Yağ Pompası Gövdesi', 'PMP-OIL-BODY', 8000]);
        t.push(['Yağ Pompası Dişlisi', 'GR-OIL-PMP', 8000]);
        t.push(['Yağ Pompası Basınç Tahliye Valfi', 'VLV-OIL-PR', 4000]);
        t.push(['Yağ Soğutucu', 'CLR-OIL-01', LIFE.structural]);
        t.push(['Yağ Soğutucu Contası', 'GSK-OIL-CLR', LIFE.gasket]);
        t.push(['Yağ Filtre Gövdesi', 'HUB-FIL-OIL', LIFE.filterHousing]);
        t.push(['Yağ Filtre Elemanı', 'ELM-FIL-OIL', 5000]);
        t.push(['Yağ Seviye Sensörü', 'SNS-OIL-LVL', LIFE.sensor]);
        t.push(['Yağ Basınç Sensörü', 'SNS-OIL-P', LIFE.sensor]);
        t.push(['Yağ Sıcaklık Sensörü', 'SNS-OIL-T', LIFE.sensor]);
        for (let i = 1; i <= 18; i++) {
          t.push([`Ana Yağ Kanalı Tapası (${i})`, `PLG-OIL-M${String(i).padStart(2, '0')}`, LIFE.plug]);
        }
        for (let i = 1; i <= 12; i++) {
          t.push([`Kol Yağ Jeti Hat Montajı (${i})`, `LIN-OIL-R${String(i).padStart(2, '0')}`, LIFE.line]);
        }
        t.push(['Turbo Yağ Besleme Hattı', 'LIN-OIL-TB', 6000]);
        t.push(['Turbo Yağ Dönüş Hattı', 'LIN-OIL-TB-R', 6000]);
        t.push(['Karter Havalandırma Valfi', 'VLV-PCV-01', 4000]);
        t.push(['Yağ Buharı Ayrıştırıcı', 'SEP-OIL-VP', LIFE.separator]);
        return t;
      })(),
    })
  );

  // 17: Soğutma
  rows.push(
    ...buildModuleRows({
      title: 'Soğutma Sirkülasyon Modülü',
      pn: 'MOD-COOL-V12',
      sn: 'ASM-COOL-V12-001',
      templates: [
        ['Su Pompası', 'PMP-WTR-01', 6000],
        ['Su Pompası Kasnağı', 'PUL-WTR-PMP', LIFE.pulley],
        ['Termostat Gövdesi', 'HUB-THM-01', LIFE.structural],
        ['Termostat Elemanı', 'ELM-THM-82', 4000],
        ['Radyatör Üst Hortumu', 'HOS-RAD-U', LIFE.hose],
        ['Radyatör Alt Hortumu', 'HOS-RAD-L', LIFE.hose],
        ['Isıtıcı Çıkış Hortumu', 'HOS-HT-O', LIFE.hose],
        ['Genleşme Tankı', 'TNK-EXP-01', LIFE.structural],
        ['Genleşme Tankı Kapağı', 'CAP-EXP-01', LIFE.structural],
        ['Su Sıcaklık Sensörü', 'SNS-COOL-T', LIFE.sensor],
        ['Soğutma Fanı Kavraması', 'FAN-CLU-01', 5000],
        ['Su Basınç Sensörü', 'SNS-WTR-P', LIFE.sensor],
        ['Blok Su Tapası', 'PLG-WTR-BLK', LIFE.plug],
        ['Silindir Kafası Su Tapası', 'PLG-WTR-HD', LIFE.plug],
        ['Turbo Soğutma Giriş Hortumu', 'HOS-TB-IN', LIFE.hose],
        ['Turbo Soğutma Çıkış Hortumu', 'HOS-TB-OUT', LIFE.hose],
        ['İçten Yanmalı Su Kanalı Contası', 'GSK-WTR-J', LIFE.gasket],
        ['Su Pompası Civata Seti', 'BLT-WTR-PMP', LIFE.bolt],
        ['Termostat Civata Seti', 'BLT-THM', LIFE.bolt],
        ['Yağ/Su Isı Eşanjörü Contası', 'GSK-OIL-WTR', LIFE.gasket],
        ['Soğutma Modülü Braketi', 'BRK-COOL-01', LIFE.bracket],
        ['Soğutma Modülü Braketi', 'BRK-COOL-02', LIFE.bracket],
        ['Devirdaim Sensörü', 'SNS-WTR-F', LIFE.sensor],
        ['Antifriz Seviye Sensörü', 'SNS-AFZ', LIFE.sensor],
      ],
    })
  );

  // 18: Emme
  rows.push(
    ...buildModuleRows({
      title: 'Emme Manifoldu ve Gaz Yönetimi',
      pn: 'MOD-INT-V12',
      sn: 'ASM-INT-V12-001',
      templates: [
        ['Emme Manifoldu Gövdesi', 'MAN-INT-V12', LIFE.structural],
        ['Gaz Kelebeği Gövdesi', 'BDY-TB-V12', LIFE.structural],
        ['Gaz Kelebeği Aktüatörü', 'ACT-TB-01', 5000],
        ['MAP Sensörü', 'SNS-MAP-01', LIFE.sensor],
        ['MAF Sensörü', 'SNS-MAF-01', LIFE.sensor],
        ['IAT Sensörü', 'SNS-IAT-01', LIFE.sensor],
        ['Emme Hava Sıcaklık Sensörü', 'SNS-IAT-02', LIFE.sensor],
        ['PCV Bağlantı Hortumu', 'HOS-PCV-INT', LIFE.hose],
        ['Emme Contası Üst', 'GSK-INT-U', LIFE.gasket],
        ['Emme Contası Alt', 'GSK-INT-L', LIFE.gasket],
        ['EGR Valfi', 'VLV-EGR-01', 5000],
        ['EGR Soğutucu', 'CLR-EGR-01', LIFE.structural],
        ['Emme Manifoldu Civata (1–8)', 'BLT-INT-01', LIFE.bolt],
        ['Emme Manifoldu Civata (9–16)', 'BLT-INT-02', LIFE.bolt],
        ['Gaz Kelebeği Civata Seti', 'BLT-TB-01', LIFE.bolt],
        ['Emme Kanalı Braketi', 'BRK-INT-01', LIFE.bracket],
        ['Emme Kanalı Braketi', 'BRK-INT-02', LIFE.bracket],
        ['Hava Filtre Kutusu Bağlantısı', 'ADP-AIR-BOX', LIFE.structural],
        ['Intercooler Besleme Flanşı', 'FLG-IC-IN', LIFE.structural],
        ['Intercooler Basınç Sensörü', 'SNS-BOOST', LIFE.sensor],
        ['Emme Modülü Topraklama', 'GRD-INT-01', LIFE.electrical],
      ],
    })
  );

  // 19: Egzoz / turbo giriş
  rows.push(
    ...buildModuleRows({
      title: 'Egzoz Manifoldu ve Turbo Beslemesi',
      pn: 'MOD-EXH-V12',
      sn: 'ASM-EXH-V12-001',
      templates: [
        ['Egzoz Manifoldu Bank L', 'MAN-EXH-L', LIFE.turboHot],
        ['Egzoz Manifoldu Bank R', 'MAN-EXH-R', LIFE.turboHot],
        ['Turboşarj Gövdesi', 'TUR-CHG-V12', 12000],
        ['Turbo Wastegate Aktüatörü', 'ACT-WG-01', 5000],
        ['Oksijen Sensörü Bank 1', 'SNS-O2-B1', 8000],
        ['Oksijen Sensörü Bank 2', 'SNS-O2-B2', 8000],
        ['Katalitik Konvertör Ön', 'CAT-FR-01', LIFE.cat],
        ['Katalitik Konvertör Arka', 'CAT-RR-01', LIFE.cat],
        ['Egzoz Contası Manifold', 'GSK-EXH-M', LIFE.gasket],
        ['Turbo Yağ Hatları Bağlantısı', 'ADP-TB-OIL', LIFE.structural],
        ['Turbo Soğutma Bağlantısı', 'ADP-TB-COOL', LIFE.structural],
        ['Egzoz Manifold Civata Seti L', 'BLT-EXH-L', LIFE.bolt],
        ['Egzoz Manifold Civata Seti R', 'BLT-EXH-R', LIFE.bolt],
        ['Egzoz Basınç Sensörü', 'SNS-EXH-P', LIFE.sensor],
        ['Egzoz Sıcaklık Sensörü', 'SNS-EXH-T', LIFE.sensor],
        ['Downpipe Flanşı', 'FLG-DP-01', LIFE.turboHot],
        ['Flex Hortum Bağlantısı', 'FLEX-EXH-01', LIFE.hose],
        ['Egzoz Askı Takozu', 'HNG-EXH-01', LIFE.bracket],
        ['Egzoz Askı Takozu', 'HNG-EXH-02', LIFE.bracket],
        ['Turbo Ses Kısıcı Braketi', 'BRK-TB-01', LIFE.bracket],
      ],
    })
  );

  // 20: Yakıt
  rows.push(
    ...buildModuleRows({
      title: 'Yüksek Basınç Yakıt Dağıtımı',
      pn: 'MOD-FUEL-V12',
      sn: 'ASM-FUEL-V12-001',
      templates: [
        ['Yakıt Rampası Gövdesi', 'RAIL-FUEL-HP', LIFE.structural],
        ['Basınç Regülatörü', 'REG-FUEL-HP', 5000],
        ['Yakıt Basınç Sensörü', 'SNS-FUEL-P', LIFE.sensor],
        ['Yakıt Sıcaklık Sensörü', 'SNS-FUEL-T', LIFE.sensor],
        ...Array.from({ length: 12 }, (_, i) => {
          const n = String(i + 1).padStart(2, '0');
          return [`Yüksek Basınç Hat Bağlantısı Sil ${n}`, `LIN-HP-${n}`, LIFE.line];
        }),
        ['Yakıt Filtre Gövdesi', 'HUB-FIL-FUEL', LIFE.filterHousing],
        ['Yakıt Filtre Elemanı', 'ELM-FIL-FUEL', 4000],
        ['Emniyet Valfi Yakıt', 'VLV-FUEL-SV', LIFE.structural],
        ['Yakıt Modülü Braketi', 'BRK-FUEL-01', LIFE.bracket],
        ['Yakıt Modülü Braketi', 'BRK-FUEL-02', LIFE.bracket],
      ],
    })
  );

  // 21: Sensör / kablo demeti arayüzü
  rows.push(
    ...buildModuleRows({
      title: 'Sensör ve Motor İçi Elektrik Arayüzü',
      pn: 'MOD-EL-V12',
      sn: 'ASM-EL-V12-001',
      templates: [
        ['Krank Pozisyon Sensörü', 'SNS-CKP-01', LIFE.sensor],
        ['Krank Dişlisi Hedef Plakası', 'TGT-CKP-01', LIFE.structural],
        ['Krank Konum Sensörü Yedek', 'SNS-CKP-02', LIFE.sensor],
        ['Knock Sensörü Bank L', 'SNS-KNK-L', LIFE.sensor],
        ['Knock Sensörü Bank R', 'SNS-KNK-R', LIFE.sensor],
        ['Ateşleme Bobini Bank L (1–3)', 'COIL-IGN-L1', 6000],
        ['Ateşleme Bobini Bank L (4–6)', 'COIL-IGN-L2', 6000],
        ['Ateşleme Bobini Bank R (7–9)', 'COIL-IGN-R1', 6000],
        ['Ateşleme Bobini Bank R (10–12)', 'COIL-IGN-R2', 6000],
        ['Motor Kontrol Ünitesi Konnektörü', 'CN-ECU-M1', LIFE.electrical],
        ['Motor Kontrol Ünitesi Konnektörü', 'CN-ECU-M2', LIFE.electrical],
        ['Topraklama Tırnağı Motor Bloğu', 'GRD-ENG-01', LIFE.electrical],
        ['Alternatör Besleme Kablo Pimi', 'PIN-ALT-B+', LIFE.electrical],
        ['Marş Motoru Tetik Kablo Pimi', 'PIN-STR-S', LIFE.electrical],
        ['Yağ Basınç Anahtarı', 'SW-OIL-P', LIFE.sensor],
        ['Soğutma Fanı Rölesi Bağlantısı', 'RLY-FAN-01', LIFE.electrical],
        ['Lambda Sensörü Uzatma Kablosu', 'EXT-O2-01', LIFE.harness],
        ['Lambda Sensörü Uzatma Kablosu', 'EXT-O2-02', LIFE.harness],
        ['Turbo Boost Sensörü Kablo Demeti', 'HAR-TB-MAP', LIFE.harness],
        ['Motor Kablo Demeti Braketi', 'BRK-HAR-01', LIFE.bracket],
        ['Motor Kablo Demeti Braketi', 'BRK-HAR-02', LIFE.bracket],
        ['Motor Kablo Demeti Braketi', 'BRK-HAR-03', LIFE.bracket],
        ['Motor Kablo Demeti Braketi', 'BRK-HAR-04', LIFE.bracket],
        ['Motor Kablo Demeti Braketi', 'BRK-HAR-05', LIFE.bracket],
        ['Motor Kablo Demeti Braketi', 'BRK-HAR-06', LIFE.bracket],
        ['Motor Kablo Demeti Braketi', 'BRK-HAR-07', LIFE.bracket],
        ['Motor Kablo Demeti Braketi', 'BRK-HAR-08', LIFE.bracket],
      ],
    })
  );

  // 22: Marş / alternatör
  rows.push(
    ...buildModuleRows({
      title: 'Marş ve Alternatör Tahrik Tarafı',
      pn: 'MOD-ACC-FR',
      sn: 'ASM-ACC-FR-001',
      templates: [
        ['Marş Motoru', 'MOT-STR-12V', 5000],
        ['Marş Motoru Dişlisi', 'PIN-STR-DRV', 4000],
        ['Alternatör', 'ALT-180A-01', 8000],
        ['Alternatör Kasnağı', 'PUL-ALT-01', LIFE.pulley],
        ['Alternatör Gerilim Regülatörü', 'REG-ALT-01', 8000],
        ['Çoklu V Kayışı', 'BEL-MVK-01', 4000],
        ['Kayış Gergin Rulmanı', 'IDLR-BEL-01', 6000],
        ['Kayış Gergin Rulmanı', 'IDLR-BEL-02', 6000],
        ['Ön Kapak Keçesi', 'SEAL-FR-COV', 4000],
        ['Marş Motoru Bağlantı Braketi', 'BRK-STR-01', LIFE.bracket],
        ['Alternatör Bağlantı Braketi', 'BRK-ALT-01', LIFE.bracket],
        ['Aksesuar Kasnak Seti', 'PUL-ACC-KIT', LIFE.pulley],
        ['Klima Kompresörü Bağlantı Ayağı', 'FTG-AC-01', LIFE.bracket],
        ['Hidrolik Direksiyon Pompa Bağlantısı', 'FTG-PS-01', LIFE.bracket],
        ['Ön Kapak Civata Seti', 'BLT-FR-COV', LIFE.bolt],
      ],
    })
  );

  // 23: Blok üstü / krank tek parçalar (üst seviye BOM)
  pushStandalone(rows, 'Krank Mili', 'CRK-V12-4500', 15000);
  pushStandalone(rows, 'Motor Silindir Bloğu', 'BLK-V12-4500', LIFE.casting);
  pushStandalone(rows, 'Volan', 'FLY-V12-4500', LIFE.structural);
  pushStandalone(rows, 'Karter (Yağ Mağazası)', 'PAN-OIL-V12', LIFE.structural);
  pushStandalone(rows, 'Ana Yatak Seti (1. Ana)', 'BRG-MAIN-01', 12000);
  pushStandalone(rows, 'Ana Yatak Seti (2. Ana)', 'BRG-MAIN-02', 12000);
  pushStandalone(rows, 'Ana Yatak Seti (3. Ana)', 'BRG-MAIN-03', 12000);
  pushStandalone(rows, 'Ana Yatak Seti (4. Ana)', 'BRG-MAIN-04', 12000);
  pushStandalone(rows, 'Ana Yatak Seti (5. Ana)', 'BRG-MAIN-05', 12000);
  pushStandalone(rows, 'Krank Keçe Seti Ön', 'SEAL-SET-F', 4000);
  pushStandalone(rows, 'Krank Keçe Seti Arka', 'SEAL-SET-R', 4000);
  pushStandalone(rows, 'Silindir Gövdesi Perdah Takımı', 'LIN-KIT-V12', LIFE.structural);

  return rows;
}

const dataRows = generateAllDataRows();

const zeroLife = dataRows.filter((r) => Number(r[7]) === 0);
if (zeroLife.length > 0) {
  console.error('Hata: Ömürü 0 olan satır var:', zeroLife.length);
  process.exit(1);
}

const assemblyKeys = new Set();
for (const r of dataRows) {
  if (r[0] && r[0] !== '-' && r[1] && r[2]) {
    assemblyKeys.add(`${r[1]}|${r[2]}`);
  }
}

const ws = XLSX.utils.aoa_to_sheet([HEADER, ...dataRows]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'BuildReport');

mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'BR_Ornek_Pistonlu_Motor.xlsx');
writeFileSync(outPath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

console.log('Oluşturuldu:', outPath);
console.log(`Toplam veri satırı: ${dataRows.length}`);
console.log(`Benzersiz alt montaj (Alt Assy P/N + S/N): ${assemblyKeys.size}`);
