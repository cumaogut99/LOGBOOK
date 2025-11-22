import React, { useState, useMemo } from 'react';
import { useQuery } from '../hooks/useData';
import { enginesApi, faultsApi, testsApi, swapsApi } from '../lib/client';
import { maintenancePlansApi } from '../lib/newApis';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { showSuccess, showError } from '../utils/toast';
import * as XLSX from 'xlsx';

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
    const maintenanceHistory = useQuery(() => maintenancePlansApi.getAllHistory(), []);

    // Filtre State'leri
    const [dateRange, setDateRange] = useState<'all' | '7' | '30' | '90'>('30');
    const [selectedEngineId, setSelectedEngineId] = useState<string>('');
    
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

        const isEngineValid = (engineId: number | string) => {
            if (!selectedEngineId) return true;
            return engineId.toString() === selectedEngineId;
        };

        const getEngineSerial = (id: number | string) => {
            const engine = engines.find(e => e.id.toString() === id.toString());
            return engine ? engine.serialNumber : 'Bilinmiyor';
        };

        // 1. Testler
        if (activityTypes.tests) {
            tests.forEach(test => {
                if (isDateValid(test.testDate) && isEngineValid(test.engineId)) {
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
                if (isDateValid(fault.reportDate) && isEngineValid(fault.engineId)) {
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
                if (isDateValid(swap.swapDate) && isEngineValid(swap.engineId)) {
                    // Basit bir swapType mantığı kuralım (Parça vs Montaj Grubu)
                    // Backend'de swapType 'Component' veya 'Assembly' olarak geliyor olabilir
                    // Ancak kullanıcı "Sökme/Takma" gibi bir ayrım istemiş olabilir ama veri yapısı "Swap" (Değişim) üzerine.
                    // Şimdilik veritabanındaki swapType'a göre filtreleyelim.
                    
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
                if (isDateValid(m.performedDate) && isEngineValid(m.engineId)) {
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

    }, [engines, faults, tests, swaps, maintenanceHistory, dateRange, selectedEngineId, activityTypes, subFilters]);

    const handleExport = (format: 'excel' | 'csv') => {
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

            if (format === 'excel') {
                XLSX.writeFile(wb, `Rapor_${new Date().toISOString().split('T')[0]}.xlsx`);
            } else {
                XLSX.writeFile(wb, `Rapor_${new Date().toISOString().split('T')[0]}.csv`);
            }
            
            showSuccess('Rapor başarıyla indirildi');
        } catch (error) {
            console.error(error);
            showError('Rapor oluşturulurken hata oluştu');
        }
    };

    if (!engines || !faults || !tests || !swaps || !maintenanceHistory) return <LoadingSpinner text="Rapor verileri yükleniyor..." />;

    // Benzersiz Alt Tipleri Bul (Filtreleme için)
    const testTypes = Array.from(new Set(tests.map(t => t.testType)));
    const faultSeverities = ['Critical', 'Major', 'Minor']; // Sabit de olabilir

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white">Rapor Merkezi</h1>
                <p className="text-brand-light">Kapsamlı sistem raporlarını oluşturun, filtreleyin ve dışa aktarın.</p>
            </div>

            {/* Filtreleme Paneli */}
            <div className="bg-brand-card p-6 rounded-lg border border-brand-border space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 1. Tarih ve Motor Seçimi */}
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

                        <div>
                            <label className="block text-sm text-brand-light mb-2">Motor Seçimi</label>
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
                        </div>
                    </div>

                    {/* 2. Faaliyet Seçimi ve Alt Filtreler */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white border-b border-brand-border pb-2">Faaliyet Filtreleri</h3>
                        
                        {/* Testler */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={activityTypes.tests}
                                    onChange={(e) => setActivityTypes({...activityTypes, tests: e.target.checked})}
                                    className="form-checkbox text-brand-primary rounded bg-brand-dark border-brand-border"
                                />
                                <span className="text-white">Testler</span>
                            </label>
                            {activityTypes.tests && (
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
                        onClick={() => handleExport('excel')}
                        disabled={reportData.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Excel İndir
                    </button>
                    <button
                        onClick={() => handleExport('csv')}
                        disabled={reportData.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        CSV İndir
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
