import React, { useState, useRef, useMemo } from 'react';
import { useQuery, useRefetch } from '../hooks/useData';
import { enginesApi, swapsApi } from '../lib/client.ts';
import { brakeTypesApi } from '../lib/newApis.ts';
import type { Engine, Component as BomComponent, ActivityLogItem, BuildReportHistory } from '../types';
import { PencilIcon, CirclePlusIcon, CircleMinusIcon } from '../constants';
import { EngineModal } from '../components/EngineModal';
import { ComponentModal } from '../components/ComponentModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SearchFilter } from '../components/SearchFilter';
import Modal from '../components/Modal';
import { showSuccess, showError } from '../utils/toast';
import { parseBuildReport, buildComponentTree, compareComponents } from '../utils/excelParser';
import { exportBuildReportToExcel } from '../utils/exportUtils';
import { useAuth } from '../context/AuthContext';

const Engines: React.FC = () => {
    const { user } = useAuth();
    const [selectedEngineId, setSelectedEngineId] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEngine, setEditingEngine] = useState<Engine | null>(null);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    
    const { refreshKey, refetch } = useRefetch();
    const engines = useQuery(() => enginesApi.getAll(), [refreshKey]);
    const brakeTypes = useQuery(() => brakeTypesApi.getAll(), [refreshKey]);
    const selectedEngine = engines?.find(e => e.id === selectedEngineId);

    if (!engines || !brakeTypes) return <LoadingSpinner text="Motorlar yükleniyor..." />;

    const handleSelectEngine = (engine: Engine) => {
        setSelectedEngineId(engine.id ?? null);
    };

    const handleBack = () => {
        setSelectedEngineId(null);
    };

    const handleAddEngine = () => {
        setModalMode('add');
        setEditingEngine(null);
        setIsModalOpen(true);
    };

    const handleEditEngine = (engine: Engine) => {
        setModalMode('edit');
        setEditingEngine(engine);
        setIsModalOpen(true);
    };

    const handleSaveEngine = async (engineData: Partial<Engine>) => {
        try {
            if (modalMode === 'add') {
                await enginesApi.create(engineData as Omit<Engine, 'id'>);
                showSuccess('Motor başarıyla eklendi!');
            } else {
                await enginesApi.update(editingEngine!.id!, engineData);
                showSuccess('Motor başarıyla güncellendi!');
            }
            refetch();
            setIsModalOpen(false);
        } catch (error) {
            showError(`Motor ${modalMode === 'add' ? 'eklenemedi' : 'güncellenemedi'}`);
            throw error;
        }
    };

    if (selectedEngine) {
        return (
            <>
                <EngineDetails 
                    engine={selectedEngine} 
                    onBack={handleBack} 
                    onEdit={handleEditEngine} 
                    user={user} 
                    brakeTypes={brakeTypes} 
                />
                <EngineModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveEngine}
                    engine={editingEngine}
                    mode={modalMode}
                    brakeTypes={brakeTypes}
                />
            </>
        );
    }

    return (
        <>
            <EngineFleetOverview 
                engines={engines} 
                onSelectEngine={handleSelectEngine}
                onAddEngine={handleAddEngine}
            />
            <EngineModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveEngine}
                engine={editingEngine}
                mode={modalMode}
                brakeTypes={brakeTypes}
            />
        </>
    );
};

const EngineFleetOverview: React.FC<{ engines: Engine[], onSelectEngine: (engine: Engine) => void, onAddEngine: () => void }> = ({ engines, onSelectEngine, onAddEngine }) => {
    const { refreshKey } = useRefetch();
    
    // Fetch next maintenance info for all engines
    const [maintenanceInfoMap, setMaintenanceInfoMap] = useState<Record<number, any>>({});
    
    React.useEffect(() => {
        const fetchMaintenanceInfo = async () => {
            const infoMap: Record<number, any> = {};
            for (const engine of engines) {
                if (engine.id) {
                    try {
                        const info = await enginesApi.getNextMaintenance(engine.id);
                        infoMap[engine.id] = info;
                    } catch (error) {
                        console.error(`Failed to fetch maintenance info for engine ${engine.id}:`, error);
                    }
                }
            }
            setMaintenanceInfoMap(infoMap);
        };
        
        fetchMaintenanceInfo();
    }, [engines, refreshKey]);
    
    return (
        <div>
            <div className="flex justify-end mb-6">
                <button onClick={onAddEngine} className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md flex items-center transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Motor Ekle
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {engines.map(engine => {
                    const maintenanceInfo = engine.id ? maintenanceInfoMap[engine.id] : null;
                    const nextMaintenance = maintenanceInfo?.nextPeriodicMaintenance;
                    const lifeLimitAlerts = maintenanceInfo?.lifeLimitAlerts || 0;
                    
                    return (
                        <div key={engine.id} className="bg-brand-card p-6 rounded-lg border border-brand-border flex flex-col">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-lg font-bold text-white">{engine.model}</p>
                                    <p className="text-sm text-brand-light">{engine.serialNumber}</p>
                                </div>
                                <span className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1.5 ${engine.status === 'Active' ? 'bg-green-500/20 text-green-400' : engine.status === 'AOG' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                    <span className={`h-2 w-2 rounded-full ${engine.status === 'Active' ? 'bg-green-400' : engine.status === 'AOG' ? 'bg-red-400' : 'bg-yellow-400'}`}></span>
                                    {engine.status === 'Active' ? 'Aktif' : engine.status === 'AOG' ? 'AOG' : 'Bakım Gerekli'}
                                </span>
                            </div>
                            <div className="my-6 text-center">
                                <p className="text-sm text-brand-light">TOPLAM SÜRE (TTH)</p>
                                <p className="text-5xl font-bold text-white">{engine.totalHours.toFixed(1)}</p>
                                <p className="text-sm text-brand-light">saat</p>
                            </div>
                            
                            {/* Maintenance & Alert Info */}
                            <div className="space-y-2 mb-4">
                                {nextMaintenance && (
                                    <div className={`p-2 rounded text-xs ${
                                        nextMaintenance.remainingHours <= 10 
                                            ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    }`}>
                                        <p className="font-semibold">🔧 Sonraki Periyodik Bakım</p>
                                        <p>{nextMaintenance.planType}</p>
                                        <p className="font-bold">{nextMaintenance.remainingHours.toFixed(1)}h kaldı ({nextMaintenance.nextDueHours}h)</p>
                                    </div>
                                )}
                                
                                {lifeLimitAlerts > 0 && (
                                    <div className="p-2 rounded text-xs bg-red-500/20 text-red-400 border border-red-500/30">
                                        <p className="font-semibold">⚠️ Ömür Limiti Uyarısı</p>
                                        <p className="font-bold">{lifeLimitAlerts} parçada uyarı var</p>
                                    </div>
                                )}
                                
                                {!nextMaintenance && lifeLimitAlerts === 0 && (
                                    <div className="p-2 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/30 text-center">
                                        <p className="font-semibold">✓ Motor sağlıklı</p>
                                    </div>
                                )}
                            </div>
                            
                            <button onClick={() => onSelectEngine(engine)} className="mt-auto w-full bg-brand-border hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-md">
                                Detayları Görüntüle
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const EngineDetails: React.FC<{ 
    engine: Engine, 
    onBack: () => void,
    onEdit: (engine: Engine) => void,
    user: any,
    brakeTypes: any[]
}> = ({ engine, onBack, onEdit, user, brakeTypes }) => {
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set([1, 100]));
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
    const [selectedBRFile, setSelectedBRFile] = useState<File | null>(null);
    const [isUploadingBR, setIsUploadingBR] = useState(false);
    const [isBRHistoryOpen, setIsBRHistoryOpen] = useState(false);
    const [editingComponent, setEditingComponent] = useState<BomComponent | null>(null);
    const [isComponentModalOpen, setIsComponentModalOpen] = useState(false);
    const [componentSearchQuery, setComponentSearchQuery] = useState('');
    const [activitySearchQuery, setActivitySearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'br' | 'tree' | 'activity'>('tree');
    const brFileInputRef = useRef<HTMLInputElement>(null);
    const { refreshKey, refetch } = useRefetch();

    // Load activities dynamically from backend
    const activities = useQuery(
        () => engine.id ? enginesApi.getActivities(engine.id) : Promise.resolve([]),
        [engine.id, refreshKey]
    );

    // Load BR history from backend
    const brHistory = useQuery(
        () => engine.id ? enginesApi.getBuildReportHistory(engine.id) : Promise.resolve([]),
        [engine.id, refreshKey]
    );

    // Filter components based on search
    const filteredComponents = useMemo(() => {
        if (!componentSearchQuery.trim()) return engine.components;
        
        const query = componentSearchQuery.toLowerCase();
        
        const filterComponentTree = (components: BomComponent[]): BomComponent[] => {
            return components.filter(comp => {
                const matchesCurrent = 
                    comp.description.toLowerCase().includes(query) ||
                    comp.partNumber.toLowerCase().includes(query) ||
                    comp.serialNumber.toLowerCase().includes(query);
                
                if (matchesCurrent) return true;
                
                // Check children
                if (comp.children && comp.children.length > 0) {
                    return filterComponentTree(comp.children).length > 0;
                }
                
                return false;
            }).map(comp => {
                if (comp.children && comp.children.length > 0) {
                    return {
                        ...comp,
                        children: filterComponentTree(comp.children)
                    };
                }
                return comp;
            });
        };
        
        return filterComponentTree(engine.components);
    }, [engine.components, componentSearchQuery]);

    // Filter activities based on search
    const filteredActivities = useMemo(() => {
        if (!activities) return [];
        if (!activitySearchQuery.trim()) return activities;
        
        const query = activitySearchQuery.toLowerCase();
        return activities.filter(activity => 
            activity.details.toLowerCase().includes(query) ||
            activity.type.toLowerCase().includes(query) ||
            activity.date.toLowerCase().includes(query)
        );
    }, [activities, activitySearchQuery]);

    const toggleRow = (id: number) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!engine.id) return;
        
        setIsUpdatingStatus(true);
        try {
            await enginesApi.update(engine.id, { status: newStatus as Engine['status'] });
            showSuccess(`Motor durumu ${newStatus === 'Aktif' ? 'Aktif' : 'Deaktif'} olarak güncellendi`);
            refetch();
        } catch (error) {
            showError('Motor durumu güncellenemedi');
            console.error(error);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleLocationChange = async (newLocation: string) => {
        if (!engine.id) return;
        
        setIsUpdatingLocation(true);
        try {
            await enginesApi.update(engine.id, { location: newLocation });
            showSuccess(`Motor lokasyonu "${newLocation}" olarak güncellendi`);
            refetch();
        } catch (error) {
            showError('Motor lokasyonu güncellenemedi');
            console.error(error);
        } finally {
            setIsUpdatingLocation(false);
        }
    };

    const handleBRFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const validExtensions = ['.xlsx', '.xls'];
            const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
            
            if (!validExtensions.includes(fileExtension)) {
                showError('Lütfen geçerli bir Excel dosyası seçin (.xlsx veya .xls)');
                return;
            }
            
            setSelectedBRFile(file);
        }
    };

    const handleBRUpload = async () => {
        if (!selectedBRFile || !engine.id || !user) return;
        
        setIsUploadingBR(true);
        try {
            const rows = await parseBuildReport(selectedBRFile);
            const newComponents = buildComponentTree(rows);
            const diff = compareComponents(engine.components, newComponents);
            
            await enginesApi.update(engine.id, {
                components: newComponents
            });
            
            // Create swap records for added and removed components
            const swapDate = new Date().toISOString();
            
            // For each removed component, create a swap record
            for (const removed of diff.removed) {
                // Try to find a corresponding added component (could be a replacement)
                const potentialReplacement = diff.added.find(
                    added => added.partNumber === removed.partNumber || added.description === removed.description
                );
                
                if (potentialReplacement) {
                    // It's a swap/replacement
                    await swapsApi.create({
                        engineId: engine.id,
                        componentInstalledId: null,
                        componentRemovedId: null,
                        swapDate,
                        swapType: 'BR Update',
                        assemblyGroup: undefined,
                        userName: user.fullName,
                        installedSerialNumber: potentialReplacement.serialNumber,
                        removedSerialNumber: removed.serialNumber
                    });
                    // Remove from added list to avoid duplicate records
                    diff.added = diff.added.filter(a => a.serialNumber !== potentialReplacement.serialNumber);
                } else {
                    // Just removed, no replacement
                    await swapsApi.create({
                        engineId: engine.id,
                        componentInstalledId: null,
                        componentRemovedId: null,
                        swapDate,
                        swapType: 'BR Update',
                        assemblyGroup: undefined,
                        userName: user.fullName,
                        installedSerialNumber: undefined,
                        removedSerialNumber: removed.serialNumber
                    });
                }
            }
            
            // For remaining added components (not matched with removed ones)
            for (const added of diff.added) {
                await swapsApi.create({
                    engineId: engine.id,
                    componentInstalledId: null,
                    componentRemovedId: null,
                    swapDate,
                    swapType: 'BR Update',
                    assemblyGroup: undefined,
                    userName: user.fullName,
                    installedSerialNumber: added.serialNumber,
                    removedSerialNumber: undefined
                });
            }
            
            // Save to history
            await enginesApi.saveBuildReportHistory(engine.id, {
                uploadedBy: user.fullName,
                fileName: selectedBRFile.name,
                components: newComponents,
                addedCount: diff.added.length,
                updatedCount: diff.updated.length,
                removedCount: diff.removed.length
            });
            
            const messages = [];
            if (diff.added.length > 0) messages.push(`${diff.added.length} parça eklendi`);
            if (diff.updated.length > 0) messages.push(`${diff.updated.length} parça güncellendi`);
            if (diff.removed.length > 0) messages.push(`${diff.removed.length} parça kaldırıldı`);
            
            showSuccess(
                `Build Report başarıyla yüklendi! ${messages.length > 0 ? messages.join(', ') : 'Tüm parçalar aynı'}`
            );
            
            setSelectedBRFile(null);
            if (brFileInputRef.current) brFileInputRef.current.value = '';
            refetch();
            
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Build Report yüklenirken hata oluştu');
            console.error('BR Upload Error:', error);
        } finally {
            setIsUploadingBR(false);
        }
    };

    const handleComponentEdit = (component: BomComponent) => {
        setEditingComponent(component);
        setIsComponentModalOpen(true);
    };

    const handleComponentSave = async (updatedComponent: Partial<BomComponent>) => {
        if (!engine.id || !editingComponent) return;
        
        try {
            // Update component in the tree
            const updateComponentInTree = (components: BomComponent[]): BomComponent[] => {
                return components.map(comp => {
                    if (comp.id === editingComponent.id) {
                        return { ...comp, ...updatedComponent };
                    }
                    if (comp.children && comp.children.length > 0) {
                        return { ...comp, children: updateComponentInTree(comp.children) };
                    }
                    return comp;
                });
            };

            const updatedComponents = updateComponentInTree(engine.components);
            
            await enginesApi.update(engine.id, { components: updatedComponents });
            showSuccess('Komponent başarıyla güncellendi!');
            refetch();
            setIsComponentModalOpen(false);
        } catch (error) {
            showError('Komponent güncellenemedi');
            console.error(error);
        }
    };

    const handleExportCurrentBR = () => {
        exportBuildReportToExcel(engine.components, engine.serialNumber);
        showSuccess('Build Report Excel olarak indirildi!');
    };

    const handleExportHistoricalBR = (brHistory: BuildReportHistory) => {
        const fileName = brHistory.fileName || `BR_${engine.serialNumber}_${brHistory.uploadDate.split('T')[0]}.xlsx`;
        exportBuildReportToExcel(brHistory.components, engine.serialNumber, fileName);
        showSuccess('Geçmiş Build Report Excel olarak indirildi!');
    };
    
    const renderBomRows = (components: BomComponent[], level = 0): React.ReactNode[] => {
        return components.flatMap(comp => {
            const isExpanded = expandedRows.has(comp.id);
            const hasChildren = comp.children && comp.children.length > 0;

            const row = (
                <tr key={`${comp.id}-${comp.serialNumber}-${level}`} className="border-b border-brand-border hover:bg-brand-dark">
                    <td className="p-3" style={{ paddingLeft: `${1 + level * 2}rem` }}>
                        <div className="flex items-center">
                            {hasChildren ? (
                                <button onClick={() => toggleRow(comp.id)} className="mr-2 text-brand-light hover:text-white">
                                    {isExpanded ? <CircleMinusIcon /> : <CirclePlusIcon />}
                                </button>
                            ) : (
                                <span className="w-6 mr-2"></span> 
                            )}
                            {comp.description}
                        </div>
                    </td>
                    <td className="p-3">{comp.partNumber}</td>
                    <td className="p-3">{comp.serialNumber}</td>
                    <td className="p-3">{comp.currentHours}</td>
                    <td className="p-3">{comp.lifeLimit}</td>
                    <td className="p-3">
                        <button 
                            onClick={() => handleComponentEdit(comp)}
                            className="text-brand-light hover:text-white transition-colors"
                        >
                            <PencilIcon />
                        </button>
                    </td>
                </tr>
            );

            const children = (hasChildren && isExpanded) ? renderBomRows(comp.children!, level + 1) : [];
            return [row, ...children];
        });
    };

    const renderActivityLogItem = (item: ActivityLogItem, index: number) => {
        let borderColor = 'border-brand-secondary';
        let title = '';
        let content = <p>{item.details}</p>;

        switch(item.type) {
            case 'Swap':
                borderColor = 'border-brand-primary';
                title = 'Değişim';
                content = <p>{item.details}</p>;
                break;
            case 'Fault':
                borderColor = 'border-brand-accent';
                title = 'Arıza';
                content = <div className="flex justify-between"><span>{item.details}</span><span className="font-bold text-yellow-400">{item.severity}</span></div>;
                break;
            case 'Test':
                borderColor = 'border-brand-secondary';
                title = 'Test';
                content = <div className="flex justify-between"><span>{item.details}</span><span className="font-semibold text-white">{item.duration} saat</span></div>;
                break;
        }

        return (
            <div key={index} className={`border-l-4 ${borderColor} pl-4 py-2`}>
                <p className="font-bold text-white">{title}: {item.details.split('(')[0]}</p>
                <p className="text-sm text-brand-light">{new Date(item.date).toLocaleString('tr-TR')}</p>
                <div className="text-sm mt-1">{content}</div>
            </div>
        )
    };
    
    return (
        <div className="space-y-6">
             <button onClick={onBack} className="text-brand-primary mb-0 flex items-center font-semibold hover:underline">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-1"><polyline points="15 18 9 12 15 6"></polyline></svg>
                Motor Filosu Genel Bakış
            </button>
            <div className="flex items-baseline space-x-2">
                 <h2 className="text-2xl font-bold text-white">Motor Detayları / {engine.serialNumber}</h2>
                 <p className="text-brand-light">Model: {engine.model}</p>
            </div>
           
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 grid grid-cols-3 gap-6">
                    <div className="bg-brand-card p-4 rounded-lg border border-brand-border text-center">
                        <p className="text-sm text-brand-light">TOPLAM SÜRE</p>
                        <p className="text-4xl font-bold text-white">{engine.totalHours}</p>
                        <p className="text-sm text-brand-light">saat</p>
                    </div>
                     <div className="bg-brand-card p-4 rounded-lg border border-brand-border text-center">
                        <p className="text-sm text-brand-light">TOPLAM ÇEVRIM</p>
                        <p className="text-4xl font-bold text-white">{engine.totalCycles}</p>
                        <p className="text-sm text-brand-light">çevrim</p>
                    </div>
                     <div className="bg-brand-card p-4 rounded-lg border border-brand-border text-center">
                        <p className="text-sm text-brand-light">SONRAKİ BAKIM</p>
                        <p className="text-4xl font-bold text-white">{engine.nextServiceDue}</p>
                        <p className="text-sm text-brand-light">kalan saat</p>
                    </div>
                </div>
                <div className="bg-brand-card p-4 rounded-lg border border-brand-border space-y-3">
                    <div className="flex justify-between items-center">
                       <h3 className="text-lg font-bold text-white">Motor Bilgileri</h3>
                       <button 
                           onClick={() => onEdit(engine)}
                           className="text-brand-primary hover:text-blue-400 transition-colors cursor-pointer p-2 hover:bg-brand-dark rounded"
                           title="Motor bilgilerini düzenle"
                       >
                           <PencilIcon/>
                       </button>
                    </div>
                    <div><span className="font-semibold">Seri Numarası:</span> {engine.serialNumber}</div>
                    <div className="flex items-center justify-between">
                        <span className="font-semibold">Lokasyon:</span>
                        <select 
                            value={engine.location || ''} 
                            onChange={(e) => handleLocationChange(e.target.value)}
                            disabled={isUpdatingLocation}
                            className="bg-brand-dark border border-brand-border rounded-md p-1 text-white text-sm hover:bg-opacity-80 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            <option value="">Belirtilmemiş</option>
                            <option value="Montaj">Montaj</option>
                            <option value="Depo">Depo</option>
                            <option value="Test Alanı">Test Alanı</option>
                            {brakeTypes && brakeTypes.length > 0 && (
                                <optgroup label="Bremze Tipleri">
                                    {brakeTypes.map(bt => (
                                        <option key={`eng-detail-brake-${bt.id}`} value={bt.name}>{bt.name}</option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="font-semibold">Durum:</span>
                        <select 
                            value={engine.status} 
                            onChange={(e) => handleStatusChange(e.target.value)}
                            disabled={isUpdatingStatus}
                            className="bg-brand-dark border border-brand-border rounded-md p-1 text-white text-sm hover:bg-opacity-80 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            <option value="Aktif">Aktif</option>
                            <option value="Deaktif">Deaktif</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-brand-card rounded-lg border border-brand-border overflow-hidden">
                <div className="flex border-b border-brand-border">
                    <button
                        onClick={() => setActiveTab('tree')}
                        className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                            activeTab === 'tree'
                                ? 'bg-brand-primary text-white border-b-2 border-brand-primary'
                                : 'text-brand-light hover:text-white hover:bg-brand-dark'
                        }`}
                    >
                        🌳 Motor Ürün Ağacı
                    </button>
                    <button
                        onClick={() => setActiveTab('br')}
                        className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                            activeTab === 'br'
                                ? 'bg-brand-primary text-white border-b-2 border-brand-primary'
                                : 'text-brand-light hover:text-white hover:bg-brand-dark'
                        }`}
                    >
                        📊 Build Report Yönetimi
                    </button>
                    <button
                        onClick={() => setActiveTab('activity')}
                        className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                            activeTab === 'activity'
                                ? 'bg-brand-primary text-white border-b-2 border-brand-primary'
                                : 'text-brand-light hover:text-white hover:bg-brand-dark'
                        }`}
                    >
                        📜 Son Aktivite Geçmişi
                    </button>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                    {/* Build Report Tab */}
                    {activeTab === 'br' && (
                        <div className="space-y-4">
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setIsBRHistoryOpen(true)}
                                    className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-md font-semibold transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    BR Geçmişi
                                </button>
                                <button
                                    onClick={handleExportCurrentBR}
                                    className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-md font-semibold transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Mevcut BR'yi İndir
                                </button>
                            </div>
                            
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-4">
                                <p className="text-sm text-blue-400 font-semibold mb-2">ℹ️ Build Report Excel Formatı:</p>
                                <div className="text-xs text-brand-light space-y-1 ml-4">
                                    <p>• <strong>Kolonlar:</strong> Alt Assy İsmi | Alt Assy Parça Numarası | Alt Assy Seri Numarası | Parça İsmi | Parça Numarası | Parça Seri Numarası | Parça Çalışma Saati | Parça Ömrü</p>
                                    <p>• Tekli parçalar için Alt Assy kolonları boş bırakılabilir veya "-" yazılabilir</p>
                                    <p>• İlk satır header olmalı, veriler 2. satırdan başlamalı</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                <input 
                                    type="file" 
                                    accept=".xlsx,.xls"
                                    onChange={handleBRFileSelect}
                                    ref={brFileInputRef}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => brFileInputRef.current?.click()}
                                    disabled={isUploadingBR}
                                    className="bg-brand-primary hover:bg-blue-600 px-4 py-2 rounded-md font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Excel Seç
                                </button>
                                
                                {selectedBRFile && (
                                    <>
                                        <div className="flex items-center gap-2 text-brand-light">
                                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span className="text-sm font-medium">{selectedBRFile.name}</span>
                                            <span className="text-xs">({(selectedBRFile.size / 1024).toFixed(1)} KB)</span>
                                        </div>
                                        
                                        <button
                                            onClick={handleBRUpload}
                                            disabled={isUploadingBR}
                                            className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-md font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            {isUploadingBR ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    Yükleniyor...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                    </svg>
                                                    Yükle & Güncelle
                                                </>
                                            )}
                                        </button>
                                        
                                        <button
                                            onClick={() => {
                                                setSelectedBRFile(null);
                                                if (brFileInputRef.current) brFileInputRef.current.value = '';
                                            }}
                                            disabled={isUploadingBR}
                                            className="text-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </>
                                )}
                            </div>
                            
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 text-sm">
                                <p className="font-semibold text-yellow-400 mb-1">⚠️ Uyarı:</p>
                                <p className="text-brand-light">Build Report yüklendiğinde, motor üzerindeki tüm parçalar yeni BR'ye göre güncellenecektir. Kaldırılan parçalar sistemden silinecektir.</p>
                            </div>
                        </div>
                    )}

                    {/* Motor Ürün Ağacı Tab */}
                    {activeTab === 'tree' && (
                        <div>
                            <div className="mb-4 flex justify-end">
                                <SearchFilter 
                                    searchTerm={componentSearchQuery}
                                    onSearchChange={setComponentSearchQuery}
                                    placeholder="Komponent ara (isim, parça no, seri no)..."
                                />
                            </div>
                            <div className="overflow-x-auto border border-brand-border rounded-lg">
                                <table className="w-full text-left text-sm">
                                    <thead className="border-b border-brand-border bg-brand-dark">
                                        <tr>
                                            <th className="p-3 font-semibold">İSİM / AÇIKLAMA</th>
                                            <th className="p-3 font-semibold">PARÇA NUMARASI</th>
                                            <th className="p-3 font-semibold">SERİ NUMARASI</th>
                                            <th className="p-3 font-semibold">MEVCUT SAAT</th>
                                            <th className="p-3 font-semibold">ÖMÜR LİMİTİ</th>
                                            <th className="p-3 font-semibold">İŞLEMLER</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredComponents.length > 0 ? (
                                            renderBomRows(filteredComponents)
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-brand-light">
                                                    Arama kriterine uygun komponent bulunamadı
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Son Aktivite Geçmişi Tab */}
                    {activeTab === 'activity' && (
                        <div>
                            <div className="mb-4 flex justify-end">
                                <SearchFilter 
                                    searchTerm={activitySearchQuery}
                                    onSearchChange={setActivitySearchQuery}
                                    placeholder="Aktivite ara..."
                                />
                            </div>
                            <div className="space-y-4">
                                {!activities ? (
                                    <div className="text-center py-4">
                                        <LoadingSpinner text="Aktiviteler yükleniyor..." />
                                    </div>
                                ) : filteredActivities.length > 0 ? (
                                    filteredActivities.map(renderActivityLogItem)
                                ) : (
                                    <div className="text-center py-8 text-brand-light">
                                        {activitySearchQuery ? 'Arama kriterine uygun aktivite bulunamadı' : 'Henüz aktivite bulunmamaktadır'}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* BR History Modal */}
            <Modal
                isOpen={isBRHistoryOpen}
                onClose={() => setIsBRHistoryOpen(false)}
                title="Build Report Geçmişi"
            >
                <div className="space-y-4">
                    {!brHistory ? (
                        <div className="text-center py-8">
                            <LoadingSpinner text="Geçmiş yükleniyor..." />
                        </div>
                    ) : brHistory.length === 0 ? (
                        <div className="text-center py-8 text-brand-light">
                            <p>Henüz Build Report geçmişi bulunmamaktadır.</p>
                        </div>
                    ) : (
                        brHistory.map((br) => (
                            <div key={br.id} className="bg-brand-dark p-4 rounded-lg border border-brand-border">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="font-semibold text-white">{br.fileName}</p>
                                        <p className="text-sm text-brand-light">
                                            {new Date(br.uploadDate).toLocaleString('tr-TR')} • {br.uploadedBy}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleExportHistoricalBR(br)}
                                        className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded-md text-sm font-semibold transition-colors flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        İndir
                                    </button>
                                </div>
                                {br.changesSummary && (
                                    <div className="flex gap-4 text-sm">
                                        <span className="text-green-400">✓ {br.changesSummary.added} eklendi</span>
                                        <span className="text-blue-400">↻ {br.changesSummary.updated} güncellendi</span>
                                        <span className="text-red-400">✗ {br.changesSummary.removed} kaldırıldı</span>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </Modal>

            {/* Component Edit Modal */}
            <ComponentModal
                isOpen={isComponentModalOpen}
                onClose={() => setIsComponentModalOpen(false)}
                onSave={handleComponentSave}
                component={editingComponent}
            />
        </div>
    );
};

export default Engines;
