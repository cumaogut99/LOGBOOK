import React, { useState, useMemo } from 'react';
import { useQuery } from '../hooks/useData';
import { enginesApi, faultsApi, testsApi, swapsApi, inventoryApi } from '../lib/client';
import { maintenancePlansApi } from '../lib/newApis';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { showSuccess, showError } from '../utils/toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format as formatDate } from 'date-fns';

interface ReportItem {
    id: string;
    date: string;
    type: 'Test' | 'Arıza' | 'Parça Değişimi' | 'Bakım';
    subType: string; // Test Tipi, Arıza Derecesi, Değişim Tipi, Bakım Tipi
    engineSerial: string;
    description: string;
    user: string;
    details?: any; // Ekstra veriler için
}

const Reports: React.FC = () => {
    // Verileri Çek
  const engines = useQuery(() => enginesApi.getAll(), []);
  const faults = useQuery(() => faultsApi.getAll(), []);
  const tests = useQuery(() => testsApi.getAll(), []);
    const swaps = useQuery(() => swapsApi.getAll(), []);
    const inventory = useQuery(() => inventoryApi.getAll(), []);
    const maintenanceHistory = useQuery(() => maintenancePlansApi.getAllHistory(), []);

    // Filtre State'leri
    const [dateRange, setDateRange] = useState<'all' | '7' | '30' | '90'>('30');
    const [reportScope, setReportScope] = useState<'fleet' | 'engine' | 'component'>('fleet');
    const [selectedEngineId, setSelectedEngineId] = useState<string>('');
    const [selectedComponentSerial, setSelectedComponentSerial] = useState<string>('');
    const [componentSearchTerm, setComponentSearchTerm] = useState('');
    
    const [activityTypes, setActivityTypes] = useState({
        tests: true,
        faults: true,
        swaps: true,
        maintenance: true
    });

    const [subFilters, setSubFilters] = useState({
        testType: 'all',
        faultSeverity: 'all',
        swapType: 'all',
        maintenanceType: 'all'
    });

    // Verileri İşle ve Birleştir
    const reportData = useMemo(() => {
        if (!engines || !faults || !tests || !swaps || !maintenanceHistory) return [];

        let data: ReportItem[] = [];
    const cutoffDate = new Date();
        if (dateRange !== 'all') {
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(dateRange));
        }

        const isDateValid = (dateStr: string) => {
            if (dateRange === 'all') return true;
            return new Date(dateStr) >= cutoffDate;
        };

        const isScopeValid = (itemEngineId: number | string | undefined, itemComponentSerial?: string, itemComponentId?: number) => {
            if (reportScope === 'fleet') return true;
            
            if (reportScope === 'engine') {
                return selectedEngineId ? itemEngineId?.toString() === selectedEngineId : true;
            }
            
            if (reportScope === 'component') {
                if (!selectedComponentSerial) return true;
                // Parça bazlı filtreleme:
                // 1. Swap: installedSerialNumber veya removedSerialNumber eşleşmeli
                // 2. Fault: componentId üzerinden veya inventory'den bulup eşleşmeli (bu karmaşık, şimdilik basit tutuyoruz)
                // 3. Test: Genelde parça bazlı değil motor bazlıdır, hariç tutulabilir veya motor üzerinden gösterilebilir.
                return false; // Default false, aşağıda özel kontrol yapacağız
            }
            
            return true;
        };

        const getEngineSerial = (id: number | string | undefined) => {
            if (!id) return 'Bilinmiyor';
            const engine = engines.find(e => e.id.toString() === id.toString());
            return engine ? engine.serialNumber : 'Depo/Harici';
        };

        // 1. Testler (Sadece Motor veya Filo modunda anlamlı)
        if (activityTypes.tests && reportScope !== 'component') {
            tests.forEach(test => {
                if (isDateValid(test.testDate) && isScopeValid(test.engineId)) {
                    if (subFilters.testType === 'all' || test.testType === subFilters.testType) {
                        data.push({
                            id: `test-${test.id}`,
                            date: test.testDate,
                            type: 'Test',
                            subType: test.testType,
                            engineSerial: getEngineSerial(test.engineId),
                            description: `${test.testCell} - ${test.duration} saat`,
                            user: test.userName,
                            details: test
                        });
                    }
                }
            });
        }

        // 2. Arızalar
        if (activityTypes.faults) {
            faults.forEach(fault => {
                let include = false;
                if (isDateValid(fault.reportDate)) {
                    if (reportScope === 'component') {
                        // Parça bazlı arama: componentId varsa inventory'den seri no kontrol et
                        if (fault.componentId && inventory) {
                             const comp = inventory.find(i => i.id === fault.componentId);
                             if (comp && comp.serialNumber === selectedComponentSerial) include = true;
                        }
                    } else {
                        include = isScopeValid(fault.engineId);
                    }
                }

                if (include) {
                    if (subFilters.faultSeverity === 'all' || fault.severity === subFilters.faultSeverity) {
                        data.push({
                            id: `fault-${fault.id}`,
                            date: fault.reportDate,
                            type: 'Arıza',
                            subType: fault.severity,
                            engineSerial: getEngineSerial(fault.engineId),
                            description: fault.description,
                            user: fault.userName,
                            details: fault
                        });
                    }
                }
            });
        }

        // 3. Parça Değişimleri
        if (activityTypes.swaps) {
            swaps.forEach(swap => {
                let include = false;
                if (isDateValid(swap.swapDate)) {
                    if (reportScope === 'component') {
                        if (swap.installedSerialNumber === selectedComponentSerial || 
                            swap.removedSerialNumber === selectedComponentSerial) {
                            include = true;
                        }
                    } else {
                        include = isScopeValid(swap.engineId);
                    }
                }

                if (include) {
                    if (subFilters.swapType === 'all' || swap.swapType === subFilters.swapType) {
                        data.push({
                            id: `swap-${swap.id}`,
                            date: swap.swapDate,
                            type: 'Parça Değişimi',
                            subType: swap.swapType === 'Assembly' ? 'Alt Montaj Grubu' : 'Tekil Parça',
                            engineSerial: getEngineSerial(swap.engineId),
                            description: `${swap.installedSerialNumber || 'N/A'} takıldı, ${swap.removedSerialNumber || 'N/A'} söküldü`,
                            user: swap.userName,
                            details: swap
                        });
                    }
                }
            });
        }

        // 4. Bakım Geçmişi (Motor veya Filo modunda)
        if (activityTypes.maintenance && reportScope !== 'component') {
            maintenanceHistory.forEach(m => {
                if (isDateValid(m.performedDate) && isScopeValid(m.engineId)) {
                    if (subFilters.maintenanceType === 'all' || m.maintenanceType === subFilters.maintenanceType) {
                        data.push({
                            id: `maint-${m.id}`,
                            date: m.performedDate,
                            type: 'Bakım',
                            subType: m.maintenanceType === 'periodic' ? 'Periyodik' : 'Plansız/Tek Seferlik',
                            engineSerial: m.engineSerialNumber || getEngineSerial(m.engineId),
                            description: m.planDescription || m.notes || 'Bakım işlemi',
                            user: m.performedBy,
                            details: m
                        });
      }
                }
            });
        }

        // Tarihe göre sırala (Yeniden eskiye)
        return data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    }, [engines, faults, tests, swaps, maintenanceHistory, inventory, dateRange, reportScope, selectedEngineId, selectedComponentSerial, activityTypes, subFilters]);

    const handleExport = (format: 'excel' | 'csv' | 'pdf') => {
      if (format === 'pdf') {
            handlePDFExport();
            return;
        }

        try {
            const exportData = reportData.map(item => ({
                'Tarih': formatDate(new Date(item.date), 'dd.MM.yyyy HH:mm'),
                'Motor': item.engineSerial,
                'Faaliyet Tipi': item.type,
                'Alt Tip': item.subType,
                'Açıklama': item.description,
                'Personel': item.user
        }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Rapor");

            const fileName = `Rapor_${reportScope}_${new Date().toISOString().split('T')[0]}`;
            
            if (format === 'excel') {
                XLSX.writeFile(wb, `${fileName}.xlsx`);
      } else {
                XLSX.writeFile(wb, `${fileName}.csv`);
      }
            
            showSuccess('Rapor başarıyla indirildi');
    } catch (error) {
            console.error(error);
            showError('Rapor oluşturulurken hata oluştu');
    }
  };

    const handlePDFExport = () => {
        try {
            const doc = new jsPDF();
            const today = formatDate(new Date(), 'dd.MM.yyyy HH:mm');
            
            // Başlık
            doc.setFontSize(20);
            doc.text('PM Logbook - Yönetici Raporu', 14, 22);
            
            doc.setFontSize(10);
            doc.text(`Rapor Tarihi: ${today}`, 14, 28);
            doc.text(`Kapsam: ${reportScope === 'fleet' ? 'Tüm Filo' : reportScope === 'engine' ? `Motor: ${engines?.find(e => e.id.toString() === selectedEngineId)?.serialNumber}` : `Parça: ${selectedComponentSerial}`}`, 14, 33);

            // --- YÖNETİCİ ÖZETİ ---
            const totalEvents = reportData.length;
            const criticalFaults = reportData.filter(i => i.type === 'Arıza' && (i.subType === 'Critical' || i.subType === 'Major')).length;
            const totalTests = reportData.filter(i => i.type === 'Test').length;
            const totalMaintenance = reportData.filter(i => i.type === 'Bakım').length;
            
            // Toplam Test Süresi Hesaplama
            const totalTestDuration = reportData
                .filter(i => i.type === 'Test' && i.details?.duration)
                .reduce((acc, curr) => acc + Number(curr.details.duration), 0);

            doc.setFontSize(14);
            doc.text('Yönetici Özeti', 14, 45);
            
            const summaryData = [
                ['Toplam Aktivite', totalEvents],
                ['Kritik/Major Arızalar', criticalFaults],
                ['Tamamlanan Testler', totalTests],
                ['Toplam Test Süresi', `${totalTestDuration.toFixed(1)} saat`],
                ['Yapılan Bakımlar', totalMaintenance],
                ['Filtre Aralığı', dateRange === 'all' ? 'Tümü' : `Son ${dateRange} Gün`]
            ];

            // Türkçe Karakter Düzeltme Fonksiyonu
            const replaceTurkishChars = (text: string) => {
                if (!text) return '';
                const map: {[key: string]: string} = {
                    'ğ': 'g', 'Ğ': 'G',
                    'ü': 'u', 'Ü': 'U',
                    'ş': 's', 'Ş': 'S',
                    'ı': 'i', 'İ': 'I',
                    'ö': 'o', 'Ö': 'O',
                    'ç': 'c', 'Ç': 'C'
                };
                return text.replace(/[ğĞüÜşŞıİöÖçÇ]/g, function(match) {
                    return map[match];
                });
            };

            autoTable(doc, {
                startY: 50,
                head: [['Metrik', 'Değer']],
                body: summaryData,
                theme: 'striped',
                headStyles: { fillColor: [41, 128, 185] },
                styles: { fontSize: 10 }
            });

            // Kritik Arızalar Listesi (Varsa)
            const criticalFaultList = reportData
                .filter(i => i.type === 'Arıza' && (i.subType === 'Critical' || i.subType === 'Major'))
                .slice(0, 5); // Sadece ilk 5

            let lastY = (doc as any).lastAutoTable.finalY + 15;

            if (criticalFaultList.length > 0) {
                doc.setFontSize(12);
                doc.setTextColor(220, 53, 69); // Kırmızı
                doc.text('Dikkat Gerektiren Kritik Olaylar (Son 5)', 14, lastY);
                doc.setTextColor(0, 0, 0); // Siyah

                autoTable(doc, {
                    startY: lastY + 5,
                    head: [['Tarih', 'Motor', 'Derece', 'Açıklama']],
                    body: criticalFaultList.map(f => [
                        formatDate(new Date(f.date), 'dd.MM.yyyy HH:mm'),
                        replaceTurkishChars(f.engineSerial),
                        replaceTurkishChars(f.subType),
                        replaceTurkishChars(f.description)
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [220, 53, 69] },
                    styles: { fontSize: 9 }
                });
                lastY = (doc as any).lastAutoTable.finalY + 15;
            }

            // Ana Veri Tablosu
            doc.setFontSize(14);
            doc.text('Detaylı Aktivite Dökümü', 14, lastY);

            autoTable(doc, {
                startY: lastY + 5,
                head: [['Tarih', 'Motor', 'Tip', 'Detay', 'Açıklama', 'Personel']],
                body: reportData.map(item => [
                    formatDate(new Date(item.date), 'dd.MM.yyyy HH:mm'),
                    replaceTurkishChars(item.engineSerial),
                    replaceTurkishChars(item.type),
                    replaceTurkishChars(item.subType),
                    replaceTurkishChars(item.description.length > 30 ? item.description.substring(0, 30) + '...' : item.description),
                    replaceTurkishChars(item.user)
                ]),
                styles: { fontSize: 8 },
                headStyles: { fillColor: [52, 73, 94] },
                alternateRowStyles: { fillColor: [240, 240, 240] }
            });

            // Sayfa numaraları ekle
            const pageCount = (doc as any).internal.getNumberOfPages();
            for(let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.text(`Sayfa ${i} / ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
      }

            doc.save(`Rapor_${reportScope}_${new Date().toISOString().split('T')[0]}.pdf`);
            showSuccess('PDF raporu oluşturuldu');
    } catch (error) {
            console.error(error);
            showError('PDF oluşturulurken hata oluştu');
    }
  };

    if (!engines || !faults || !tests || !swaps || !maintenanceHistory) return <LoadingSpinner text="Rapor verileri yükleniyor..." />;

    // Benzersiz Alt Tipleri Bul (Filtreleme için)
    const testTypes = Array.from(new Set(tests.map(t => t.testType)));
    const faultSeverities = ['Critical', 'Major', 'Minor'];

    // Filtrelenmiş Inventory Listesi (Parça arama için)
    const filteredInventory = inventory?.filter(item => 
        item.serialNumber.toLowerCase().includes(componentSearchTerm.toLowerCase()) || 
        item.partNumber.toLowerCase().includes(componentSearchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(componentSearchTerm.toLowerCase())
    ).slice(0, 50) || []; // Performans için ilk 50

  return (
    <div className="space-y-6">
      <div>
                <h1 className="text-3xl font-bold text-white">Rapor Merkezi</h1>
                <p className="text-brand-light">Kapsamlı sistem raporlarını oluşturun, filtreleyin ve dışa aktarın.</p>
            </div>

            {/* Filtreleme Paneli */}
            <div className="bg-brand-card p-6 rounded-lg border border-brand-border space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 1. Kapsam ve Tarih Seçimi */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white border-b border-brand-border pb-2">Rapor Kapsamı</h3>
                        
                        {/* Scope Selector */}
                        <div className="flex gap-4 bg-brand-dark p-2 rounded-md">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    value="fleet" 
                                    checked={reportScope === 'fleet'}
                                    onChange={(e) => { setReportScope('fleet'); setSelectedEngineId(''); setSelectedComponentSerial(''); }}
                                    className="form-radio text-brand-primary"
                                />
                                <span className="text-white">Tüm Filo</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    value="engine" 
                                    checked={reportScope === 'engine'}
                                    onChange={(e) => { setReportScope('engine'); setSelectedComponentSerial(''); }}
                                    className="form-radio text-brand-primary"
                                />
                                <span className="text-white">Motor Bazlı</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    value="component" 
                                    checked={reportScope === 'component'}
                                    onChange={(e) => { setReportScope('component'); setSelectedEngineId(''); }}
                                    className="form-radio text-brand-primary"
                                />
                                <span className="text-white">Parça/Montaj Grubu</span>
                            </label>
      </div>

                        {/* Conditional Selectors */}
                        {reportScope === 'engine' && (
                            <div>
                                <label className="block text-sm text-brand-light mb-2">Motor Seçimi</label>
                                <select
                                    value={selectedEngineId}
                                    onChange={(e) => setSelectedEngineId(e.target.value)}
                                    className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white text-sm focus:border-brand-primary focus:outline-none"
                                >
                                    <option value="">Motor Seçiniz...</option>
                                    {engines.map(e => (
                                        <option key={e.id} value={e.id}>{e.serialNumber} ({e.model})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {reportScope === 'component' && (
                            <div className="space-y-2">
                                <label className="block text-sm text-brand-light">Parça Ara ve Seç</label>
                                <input 
                                    type="text" 
                                    placeholder="Seri No, Parça No veya İsim ara..." 
                                    value={componentSearchTerm}
                                    onChange={(e) => setComponentSearchTerm(e.target.value)}
                                    className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white text-sm mb-2"
                                />
                                <select
                                    value={selectedComponentSerial}
                                    onChange={(e) => setSelectedComponentSerial(e.target.value)}
                                    className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white text-sm focus:border-brand-primary focus:outline-none"
                                    size={5}
          >
                                    <option value="">Parça Seçiniz...</option>
                                    {filteredInventory.map(item => (
                                        <option key={item.id} value={item.serialNumber}>
                                            {item.description} - {item.serialNumber} ({item.partNumber})
                                        </option>
                                    ))}
                                </select>
                                {selectedComponentSerial && (
                                    <p className="text-xs text-green-400">Seçili: {selectedComponentSerial}</p>
                                )}
                            </div>
                        )}

                        {/* Date Range */}
                        <div>
                            <label className="block text-sm text-brand-light mb-2">Tarih Aralığı</label>
                            <div className="flex gap-2">
                                {['all', '7', '30', '90'].map((range) => (
          <button
                                        key={range}
                                        onClick={() => setDateRange(range as any)}
                                        className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                                            dateRange === range 
                ? 'bg-brand-primary text-white' 
                                                : 'bg-brand-dark text-brand-light hover:bg-opacity-80 border border-brand-border'
            }`}
          >
                                        {range === 'all' ? 'Tümü' : `Son ${range} Gün`}
          </button>
                                ))}
                            </div>
        </div>
      </div>

                    {/* 2. Faaliyet Seçimi ve Alt Filtreler */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white border-b border-brand-border pb-2">Faaliyet Filtreleri</h3>
                        
                        {/* Testler */}
                        <div className="flex items-center justify-between">
                            <label className={`flex items-center space-x-2 cursor-pointer ${reportScope === 'component' ? 'opacity-50' : ''}`}>
                                <input 
                                    type="checkbox" 
                                    checked={activityTypes.tests}
                                    onChange={(e) => setActivityTypes({...activityTypes, tests: e.target.checked})}
                                    disabled={reportScope === 'component'}
                                    className="form-checkbox text-brand-primary rounded bg-brand-dark border-brand-border"
                                />
                                <span className="text-white">Testler {reportScope === 'component' && '(Parça için aktif değil)'}</span>
                            </label>
                            {activityTypes.tests && reportScope !== 'component' && (
                                <select 
                                    value={subFilters.testType}
                                    onChange={(e) => setSubFilters({...subFilters, testType: e.target.value})}
                                    className="bg-brand-dark border border-brand-border rounded px-2 py-1 text-xs text-white w-40"
                                >
                                    <option value="all">Tüm Tipler</option>
                                    {testTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            )}
          </div>

                        {/* Arızalar */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={activityTypes.faults}
                                    onChange={(e) => setActivityTypes({...activityTypes, faults: e.target.checked})}
                                    className="form-checkbox text-brand-primary rounded bg-brand-dark border-brand-border"
                                />
                                <span className="text-white">Arızalar</span>
                            </label>
                            {activityTypes.faults && (
                                <select 
                                    value={subFilters.faultSeverity}
                                    onChange={(e) => setSubFilters({...subFilters, faultSeverity: e.target.value})}
                                    className="bg-brand-dark border border-brand-border rounded px-2 py-1 text-xs text-white w-40"
                                >
                                    <option value="all">Tüm Dereceler</option>
                                    {faultSeverities.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            )}
      </div>

                        {/* Parça Değişimleri */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={activityTypes.swaps}
                                    onChange={(e) => setActivityTypes({...activityTypes, swaps: e.target.checked})}
                                    className="form-checkbox text-brand-primary rounded bg-brand-dark border-brand-border"
                                />
                                <span className="text-white">Parça Değişimleri</span>
                            </label>
                            {activityTypes.swaps && (
                                <select 
                                    value={subFilters.swapType}
                                    onChange={(e) => setSubFilters({...subFilters, swapType: e.target.value})}
                                    className="bg-brand-dark border border-brand-border rounded px-2 py-1 text-xs text-white w-40"
                                >
                                    <option value="all">Tümü</option>
                                    <option value="Component">Tekil Parça</option>
                                    <option value="Assembly">Alt Montaj Grubu</option>
                                </select>
                            )}
                        </div>

                        {/* Bakım Geçmişi */}
                        <div className="flex items-center justify-between">
                            <label className={`flex items-center space-x-2 cursor-pointer ${reportScope === 'component' ? 'opacity-50' : ''}`}>
                                <input 
                                    type="checkbox" 
                                    checked={activityTypes.maintenance}
                                    onChange={(e) => setActivityTypes({...activityTypes, maintenance: e.target.checked})}
                                    disabled={reportScope === 'component'}
                                    className="form-checkbox text-brand-primary rounded bg-brand-dark border-brand-border"
                                />
                                <span className="text-white">Bakım Geçmişi {reportScope === 'component' && '(Parça için aktif değil)'}</span>
                            </label>
                            {activityTypes.maintenance && reportScope !== 'component' && (
                                <select 
                                    value={subFilters.maintenanceType}
                                    onChange={(e) => setSubFilters({...subFilters, maintenanceType: e.target.value})}
                                    className="bg-brand-dark border border-brand-border rounded px-2 py-1 text-xs text-white w-40"
                                >
                                    <option value="all">Tümü</option>
                                    <option value="periodic">Periyodik</option>
                                    <option value="one-time">Plansız/Tek Seferlik</option>
                                </select>
                            )}
                        </div>

                    </div>
                </div>
            </div>

            {/* Sonuç Özeti ve Export */}
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">
                    Rapor Sonuçları <span className="text-brand-light text-base font-normal">({reportData.length} kayıt bulundu)</span>
                </h2>
                <div className="flex gap-2">
            <button
                        onClick={() => handleExport('excel')}
                        disabled={reportData.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
                        Excel
            </button>
            <button
                        onClick={() => handleExport('csv')}
                        disabled={reportData.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
                        CSV
                    </button>
                    <button
                        onClick={() => handleExport('pdf')}
                        disabled={reportData.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        PDF
            </button>
          </div>
        </div>
        
            {/* Tablo */}
            <div className="bg-brand-card rounded-lg border border-brand-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                        <thead className="bg-brand-dark border-b border-brand-border">
                <tr>
                                <th className="p-3 text-brand-light font-medium">Tarih</th>
                                <th className="p-3 text-brand-light font-medium">Motor</th>
                                <th className="p-3 text-brand-light font-medium">Faaliyet Tipi</th>
                                <th className="p-3 text-brand-light font-medium">Detay / Alt Tip</th>
                                <th className="p-3 text-brand-light font-medium">Açıklama</th>
                                <th className="p-3 text-brand-light font-medium">Personel</th>
                </tr>
              </thead>
                        <tbody className="divide-y divide-brand-border">
                            {reportData.length > 0 ? (
                                reportData.map((item) => (
                                    <tr key={item.id} className="hover:bg-brand-dark/50 transition-colors">
                                        <td className="p-3 text-white whitespace-nowrap">
                                            {formatDate(new Date(item.date), 'dd.MM.yyyy HH:mm')}
                                        </td>
                                        <td className="p-3 text-white font-medium">{item.engineSerial}</td>
                    <td className="p-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                item.type === 'Test' ? 'bg-blue-500/20 text-blue-400' :
                                                item.type === 'Arıza' ? 'bg-red-500/20 text-red-400' :
                                                item.type === 'Bakım' ? 'bg-green-500/20 text-green-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                                                {item.type}
                      </span>
                    </td>
                                        <td className="p-3 text-brand-light">{item.subType}</td>
                                        <td className="p-3 text-white">{item.description}</td>
                                        <td className="p-3 text-brand-light">{item.user}</td>
                  </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-brand-light">
                                        Kriterlere uygun kayıt bulunamadı. Filtreleri değiştirmeyi deneyin.
                    </td>
                  </tr>
                            )}
              </tbody>
            </table>
          </div>
      </div>
    </div>
  );
};

export default Reports;
