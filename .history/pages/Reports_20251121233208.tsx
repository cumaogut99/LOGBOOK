import React, { useState, useMemo } from 'react';
import { useQuery } from '../hooks/useData';
import { enginesApi, faultsApi, testsApi, swapsApi, inventoryApi } from '../lib/client';
import { maintenancePlansApi } from '../lib/newApis';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { showSuccess, showError } from '../utils/toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportItem {
    id: string;
    date: string;
    type: 'Test' | 'Arıza' | 'Parça Değişimi' | 'Bakım';
    subType: string;
    engineSerial: string;
    description: string;
    user: string;
    details?: any;
    // Parça bazlı raporlama için ek alanlar
    componentName?: string;
    componentSerial?: string;
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
    
    // Rapor Kapsamı: 'engine' (Motor) veya 'component' (Parça/Montaj Grubu)
    const [reportScope, setReportScope] = useState<'engine' | 'component'>('engine');
    
    // Seçimler
    const [selectedEngineId, setSelectedEngineId] = useState<string>('');
    const [selectedComponentSearch, setSelectedComponentSearch] = useState<string>('');
    const [selectedComponentId, setSelectedComponentId] = useState<string>(''); // ID varsa
    
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

    // Arama için envanter listesini filtrele
    const filteredInventory = useMemo(() => {
        if (!inventory || !selectedComponentSearch) return [];
        const search = selectedComponentSearch.toLowerCase();
        return inventory.filter(item => 
            item.partNumber.toLowerCase().includes(search) || 
            item.serialNumber.toLowerCase().includes(search) || 
            item.description.toLowerCase().includes(search)
        ).slice(0, 10); // İlk 10 sonucu göster
    }, [inventory, selectedComponentSearch]);

    // Verileri İşle ve Birleştir
    const reportData = useMemo(() => {
        if (!engines || !faults || !tests || !swaps || !maintenanceHistory || !inventory) return [];

        let data: ReportItem[] = [];
        const cutoffDate = new Date();
        if (dateRange !== 'all') {
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(dateRange));
        }

        const isDateValid = (dateStr: string) => {
            if (dateRange === 'all') return true;
            return new Date(dateStr) >= cutoffDate;
        };

        const getEngineSerial = (id: number | string | null) => {
            if (!id) return '-';
            const engine = engines.find(e => e.id.toString() === id.toString());
            return engine ? engine.serialNumber : 'Bilinmiyor';
        };

        // Helper: Parça kapsamı kontrolü
        // Eğer component modu seçiliyse, kaydın o parçayla ilgili olup olmadığına bakar
        const isComponentRelevant = (record: any, type: 'Test' | 'Arıza' | 'Swap' | 'Bakım') => {
            if (reportScope === 'engine') return true;
            if (!selectedComponentId) return true; // Parça seçilmediyse hepsi (veya hiçbiri, ama UI engelliyor)

            // Seçilen parça/montaj grubunun bilgilerini bulalım
            // Not: Inventory'den ID ile buluyoruz ama kayıtlarda bazen sadece ID, bazen SerialNumber olabilir.
            // En güvenilir yöntem ID ve SerialNumber kontrolü.
            const targetComponent = inventory.find(i => i.id.toString() === selectedComponentId);
            if (!targetComponent) return false;

            if (type === 'Arıza') {
                return record.componentId?.toString() === selectedComponentId;
            }
            if (type === 'Swap') {
                // Değişimlerde hem takılan hem sökülen olabilir
                return record.componentInstalledId?.toString() === selectedComponentId ||
                       record.componentRemovedId?.toString() === selectedComponentId ||
                       record.installedSerialNumber === targetComponent.serialNumber ||
                       record.removedSerialNumber === targetComponent.serialNumber;
            }
            if (type === 'Bakım') {
                // Bakımlar genellikle motor bazlıdır, parça bazlı bakım takibi şu an sadece Life Limit ile yapılıyor
                // Eğer bakım açıklamasında parça adı geçiyorsa dahil edebiliriz (basit text search)
                return record.notes?.toLowerCase().includes(targetComponent.serialNumber.toLowerCase()) ||
                       record.notes?.toLowerCase().includes(targetComponent.partNumber.toLowerCase());
            }
            if (type === 'Test') {
                 // Testler motor bazlıdır. Parçanın o sırada motorda olup olmadığını bilmek zor (Tarihçeye bakmak gerekir).
                 // Şimdilik parça modunda testleri hariç tutabiliriz veya sadece description eşleşmesi yapabiliriz.
                 return false; 
            }
            return false;
        };

        // 1. Testler (Sadece Motor Modunda veya İlgili Parça ise)
        if (activityTypes.tests) {
            tests.forEach(test => {
                const engineMatch = reportScope === 'engine' ? (!selectedEngineId || test.engineId.toString() === selectedEngineId) : false; // Parça modunda testleri şimdilik pass geçiyoruz (kompleks tarihçe kontrolü gerek)
                
                if (isDateValid(test.testDate) && engineMatch) {
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
                const engineMatch = reportScope === 'engine' ? (!selectedEngineId || fault.engineId.toString() === selectedEngineId) : true;
                const compMatch = isComponentRelevant(fault, 'Arıza');

                if (isDateValid(fault.reportDate) && engineMatch && compMatch) {
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
                const engineMatch = reportScope === 'engine' ? (!selectedEngineId || swap.engineId.toString() === selectedEngineId) : true;
                const compMatch = isComponentRelevant(swap, 'Swap');

                if (isDateValid(swap.swapDate) && engineMatch && compMatch) {
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

        // 4. Bakım Geçmişi
        if (activityTypes.maintenance) {
            maintenanceHistory.forEach(m => {
                const engineMatch = reportScope === 'engine' ? (!selectedEngineId || m.engineId.toString() === selectedEngineId) : true;
                const compMatch = isComponentRelevant(m, 'Bakım');

                if (isDateValid(m.performedDate) && engineMatch && compMatch) {
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

    }, [engines, faults, tests, swaps, maintenanceHistory, inventory, dateRange, selectedEngineId, selectedComponentId, reportScope, activityTypes, subFilters]);

    // İstatistikler (Yönetici Özeti için)
    const stats = useMemo(() => {
        const totalEvents = reportData.length;
        const criticalFaults = reportData.filter(d => d.type === 'Arıza' && d.subType === 'Critical').length;
        const maintenanceCount = reportData.filter(d => d.type === 'Bakım').length;
        const testHours = reportData
            .filter(d => d.type === 'Test')
            .reduce((acc, curr) => acc + (curr.details.duration || 0), 0);
        
        return { totalEvents, criticalFaults, maintenanceCount, testHours };
    }, [reportData]);

    const handleExportPDF = () => {
        const doc = new jsPDF();
        
        // Font ayarı (Türkçe karakterler için varsayılan font bazen sorun çıkarabilir, 
        // ama jspdf son sürümlerinde UTF-8 desteği daha iyi. Garanti olsun diye basit karakterler kullanalım veya font ekleyelim.
        // Şimdilik standart font ile devam edelim, gerekirse özel font ekleriz.)

        // Başlık
        doc.setFontSize(20);
        doc.setTextColor(41, 128, 185); // Brand Primary Color benzeri
        doc.text("PM Logbook - Yönetici Raporu", 14, 20);
        
        // Tarih ve Bilgi
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 28);
        doc.text(`Rapor Kapsamı: ${reportScope === 'engine' ? (selectedEngineId ? `Motor SN: ${getEngineSerial(selectedEngineId)}` : 'Tüm Filo') : `Parça/Montaj Grubu`}`, 14, 33);
        if (dateRange !== 'all') {
            doc.text(`Tarih Aralığı: Son ${dateRange} Gün`, 14, 38);
        }

        // Yönetici Özeti Kutusu
        doc.setDrawColor(200);
        doc.setFillColor(245, 247, 250);
        doc.roundedRect(14, 45, 180, 35, 3, 3, 'FD');
        
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Yönetici Özeti", 20, 55);
        
        doc.setFontSize(11);
        // Sol Sütun
        doc.text(`• Toplam Aktivite Sayısı: ${stats.totalEvents}`, 20, 65);
        doc.text(`• Toplam Test Süresi: ${stats.testHours.toFixed(1)} saat`, 20, 72);
        
        // Sağ Sütun
        doc.setTextColor(231, 76, 60); // Kırmızı
        doc.text(`• Kritik Arıza Sayısı: ${stats.criticalFaults}`, 100, 65);
        doc.setTextColor(39, 174, 96); // Yeşil
        doc.text(`• Tamamlanan Bakım: ${stats.maintenanceCount}`, 100, 72);

        // Tablo
        const tableColumn = ["Tarih", "Motor", "Tip", "Detay", "Açıklama", "Personel"];
        const tableRows = reportData.map(item => [
            new Date(item.date).toLocaleDateString('tr-TR'),
            item.engineSerial,
            item.type,
            item.subType,
            item.description.length > 40 ? item.description.substring(0, 40) + '...' : item.description,
            item.user
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 90,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [41, 128, 185] },
            alternateRowStyles: { fillColor: [245, 245, 245] }
        });

        doc.save(`PM_Logbook_Rapor_${new Date().toISOString().split('T')[0]}.pdf`);
        showSuccess('PDF raporu oluşturuldu');
    };

    const handleExportExcel = () => {
        // ... existing excel logic
        try {
            const exportData = reportData.map(item => ({
                'Tarih': new Date(item.date).toLocaleDateString('tr-TR'),
                'Motor': item.engineSerial,
                'Faaliyet Tipi': item.type,
                'Alt Tip': item.subType,
                'Açıklama': item.description,
                'Personel': item.user
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Rapor");
            XLSX.writeFile(wb, `Rapor_${new Date().toISOString().split('T')[0]}.xlsx`);
            showSuccess('Excel raporu indirildi');
        } catch (error) {
            console.error(error);
            showError('Rapor hatası');
        }
    };

    if (!engines || !faults || !tests || !swaps || !maintenanceHistory) return <LoadingSpinner text="Rapor verileri yükleniyor..." />;

    // Benzersiz Alt Tipleri Bul
    const testTypes = Array.from(new Set(tests.map(t => t.testType)));
    const faultSeverities = ['Critical', 'Major', 'Minor'];

    // Helper function for engine serial
    const getEngineSerial = (id: number | string) => {
        const engine = engines.find(e => e.id.toString() === id.toString());
        return engine ? engine.serialNumber : 'Bilinmiyor';
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white">Rapor Merkezi</h1>
                <p className="text-brand-light">Kapsamlı sistem raporlarını oluşturun, filtreleyin ve dışa aktarın.</p>
            </div>

            {/* Filtreleme Paneli */}
            <div className="bg-brand-card p-6 rounded-lg border border-brand-border space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 1. Tarih ve Kapsam Seçimi */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white border-b border-brand-border pb-2">Genel Filtreler</h3>
                        
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

                        {/* Kapsam Seçimi */}
                        <div>
                            <label className="block text-sm text-brand-light mb-2">Rapor Kapsamı</label>
                            <div className="flex gap-4 mb-3">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        value="engine"
                                        checked={reportScope === 'engine'}
                                        onChange={() => { setReportScope('engine'); setSelectedComponentId(''); }}
                                        className="form-radio text-brand-primary"
                                    />
                                    <span className="text-white">Motor Bazlı</span>
                                </label>
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        value="component"
                                        checked={reportScope === 'component'}
                                        onChange={() => { setReportScope('component'); setSelectedEngineId(''); }}
                                        className="form-radio text-brand-primary"
                                    />
                                    <span className="text-white">Parça / Montaj Grubu Bazlı</span>
                                </label>
                            </div>

                            {reportScope === 'engine' ? (
                                <select
                                    value={selectedEngineId}
                                    onChange={(e) => setSelectedEngineId(e.target.value)}
                                    className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white text-sm focus:border-brand-primary focus:outline-none"
                                >
                                    <option value="">Tüm Motorlar</option>
                                    {engines.map(e => (
                                        <option key={e.id} value={e.id}>{e.serialNumber} ({e.model})</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Parça ara (Seri No, Parça No)..."
                                        value={selectedComponentSearch}
                                        onChange={(e) => setSelectedComponentSearch(e.target.value)}
                                        className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white text-sm focus:border-brand-primary focus:outline-none"
                                    />
                                    {selectedComponentSearch && filteredInventory.length > 0 && !selectedComponentId && (
                                        <div className="absolute z-10 w-full bg-brand-card border border-brand-border mt-1 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                            {filteredInventory.map(item => (
                                                <div
                                                    key={item.id}
                                                    onClick={() => {
                                                        setSelectedComponentId(item.id!.toString());
                                                        setSelectedComponentSearch(`${item.description} (${item.serialNumber})`);
                                                    }}
                                                    className="p-2 hover:bg-brand-dark cursor-pointer text-sm text-white border-b border-brand-border last:border-0"
                                                >
                                                    <div className="font-bold">{item.description}</div>
                                                    <div className="text-xs text-brand-light">SN: {item.serialNumber} | PN: {item.partNumber}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {selectedComponentId && (
                                        <button
                                            onClick={() => {
                                                setSelectedComponentId('');
                                                setSelectedComponentSearch('');
                                            }}
                                            className="absolute right-2 top-2 text-red-400 hover:text-red-300"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 2. Faaliyet Seçimi ve Alt Filtreler */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white border-b border-brand-border pb-2">Faaliyet Filtreleri</h3>
                        
                        {/* Testler (Sadece Motor Modunda Aktif) */}
                        <div className={`flex items-center justify-between ${reportScope === 'component' ? 'opacity-50' : ''}`}>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={activityTypes.tests}
                                    onChange={(e) => setActivityTypes({...activityTypes, tests: e.target.checked})}
                                    disabled={reportScope === 'component'}
                                    className="form-checkbox text-brand-primary rounded bg-brand-dark border-brand-border"
                                />
                                <span className="text-white">Testler {reportScope === 'component' && '(Parça bazlı desteklenmiyor)'}</span>
                            </label>
                            {activityTypes.tests && reportScope === 'engine' && (
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
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={activityTypes.maintenance}
                                    onChange={(e) => setActivityTypes({...activityTypes, maintenance: e.target.checked})}
                                    className="form-checkbox text-brand-primary rounded bg-brand-dark border-brand-border"
                                />
                                <span className="text-white">Bakım Geçmişi</span>
                            </label>
                            {activityTypes.maintenance && (
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
                        onClick={handleExportPDF}
                        disabled={reportData.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        PDF İndir (Yönetici)
                    </button>
                    <button
                        onClick={handleExportExcel}
                        disabled={reportData.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Excel İndir
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
                                            {new Date(item.date).toLocaleDateString('tr-TR')} <span className="text-brand-light text-xs">{new Date(item.date).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</span>
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
