import React, { useState } from 'react';
import { useQuery, useRefetch } from '../hooks/useData';
import { swapsApi, enginesApi, inventoryApi } from '../lib/client.ts';
import { documentsApi as newDocsApi } from '../lib/newApis.ts';
import { useAuth } from '../hooks/useAuth';
import type { SwapActivity, Component, InventoryItem } from '../types';
import { PencilIcon, TrashIcon, PaperclipIcon } from '../constants';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { showSuccess, showError, showWarning } from '../utils/toast';

// Helper: Extract unique assembly groups from engine components
function extractAssemblyGroups(components: Component[]): string[] {
    const groups = new Set<string>();
    
    function traverse(comps: Component[]) {
        for (const comp of comps) {
            // Top-level components are considered assembly groups
            if (comp.description) {
                groups.add(comp.description);
            }
            if (comp.children && comp.children.length > 0) {
                traverse(comp.children);
            }
        }
    }
    
    traverse(components);
    return Array.from(groups).sort();
}

// Helper: Replace a component in the tree by ID
function replaceComponentInTree(
    components: Component[],
    removeId: number,
    newComponent: Component
): Component[] {
    return components.map(comp => {
        if (comp.id === removeId) {
            return newComponent;
        }
        if (comp.children) {
            return {
                ...comp,
                children: replaceComponentInTree(comp.children, removeId, newComponent)
            };
        }
        return comp;
    });
}

// Helper: Find component by serial number (for finding in inventory)
function findComponentBySerial(components: Component[], serialNumber: string): Component | undefined {
    for (const comp of components) {
        if (comp.serialNumber === serialNumber) return comp;
        if (comp.children) {
            const found = findComponentBySerial(comp.children, serialNumber);
            if (found) return found;
        }
    }
    return undefined;
}

// Helper: Convert inventory item to component
function inventoryToComponent(item: InventoryItem, engineTotalHours: number): Component {
    return {
        id: item.id!,
        description: item.description,
        partNumber: item.partNumber,
        serialNumber: item.serialNumber,
        currentHours: engineTotalHours, // Sync with engine hours
        lifeLimit: 0 // Will be set from inventory if available
    };
}

const Assembler: React.FC = () => {
    const { user } = useAuth();
    const { refreshKey, refetch } = useRefetch();
    const swaps = useQuery(() => swapsApi.getAll(), [refreshKey]);
    const engines = useQuery(() => enginesApi.getAll(), []);
    const inventory = useQuery(() => inventoryApi.getAll(), []);

    const [selectedEngine, setSelectedEngine] = useState<number | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

    const canModify = user?.role === 'Administrator' || user?.role === 'Assembly Engineer';
    const canSwap = canModify || user?.role === 'Assembly Operator';

    // Enhanced form state with swap type and assembly group
    const [swapState, setSwapState] = useState({
        engineId: '',
        removeId: '',
        installId: '',
        swapType: 'Component' as 'Component' | 'Assembly',
        assemblyGroup: ''
    });

    // Get available assembly groups for selected engine
    const availableAssemblyGroups = React.useMemo(() => {
        if (!swapState.engineId) return [];
        const selectedEngine = engines?.find(e => e.id === parseInt(swapState.engineId));
        if (!selectedEngine) return [];
        return extractAssemblyGroups(selectedEngine.components);
    }, [swapState.engineId, engines]);

    const handleSwap = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !swapState.engineId || !swapState.installId || !swapState.removeId) {
            showError('Lütfen tüm gerekli alanları doldurun');
            return;
        }
        
        if (swapState.swapType === 'Assembly' && !swapState.assemblyGroup) {
            showError('Lütfen bir montaj grubu seçin');
            return;
        }
        
        try {
            const engineId = parseInt(swapState.engineId);
            const installedId = parseInt(swapState.installId);
            const removedId = parseInt(swapState.removeId);
            
            // Get engine
            const engine = engines?.find(e => e.id === engineId);
            if (!engine) {
                throw new Error('Motor bulunamadı');
            }
            
            // Get component from inventory
            const inventoryItem = inventory?.find(i => i.id === installedId);
            if (!inventoryItem) {
                throw new Error('Parça depoda bulunamadı');
            }
            
            // Create swap activity
            const createdSwap = await swapsApi.create({
                engineId: engineId,
                componentInstalledId: installedId,
                componentRemovedId: removedId,
                swapDate: new Date().toISOString(),
                swapType: swapState.swapType,
                assemblyGroup: swapState.swapType === 'Assembly' ? swapState.assemblyGroup : undefined,
                userName: user.fullName
            });
            
            // Upload documents if any
            if (uploadedFiles.length > 0 && createdSwap.id) {
                for (const file of uploadedFiles) {
                    await newDocsApi.upload(file, {
                        relatedType: 'swap',
                        relatedId: createdSwap.id,
                        uploadedBy: user.fullName
                    });
                }
            }
            
            // Update engine components
            const newComponent = inventoryToComponent(inventoryItem, engine.totalHours);
            const updatedComponents = replaceComponentInTree(
                engine.components,
                removedId,
                newComponent
            );
            
            await enginesApi.update(engineId, {
                components: updatedComponents
            });
            
            // Remove installed component from inventory
            await inventoryApi.delete(installedId);
            
            // Add removed component back to inventory (if it exists)
            const removedInventoryItem = inventory?.find(i => i.id === removedId);
            if (removedInventoryItem) {
                // Component was from inventory, add it back with updated hours
                await inventoryApi.update(removedId, {
                    ...removedInventoryItem,
                    // Keep the same data, it's back in inventory
                });
            } else {
                // Component was from engine, find it in the old component tree
                const findComponentById = (components: Component[], id: number): Component | undefined => {
                    for (const comp of components) {
                        if (comp.id === id) return comp;
                        if (comp.children) {
                            const found = findComponentById(comp.children, id);
                            if (found) return found;
                        }
                    }
                    return undefined;
                };
                
                const removedComponent = findComponentById(engine.components, removedId);
                if (removedComponent) {
                    // Add removed component to inventory
                    await inventoryApi.create({
                        partNumber: removedComponent.partNumber,
                        serialNumber: removedComponent.serialNumber,
                        description: removedComponent.description,
                        quantity: 1,
                        location: 'Depo',
                        userName: user.fullName
                    });
                }
            }
            
            setSwapState({ engineId: '', removeId: '', installId: '', swapType: 'Component', assemblyGroup: '' });
            setUploadedFiles([]);
            showSuccess(`${swapState.swapType === 'Assembly' ? 'Montaj grubu' : 'Parça'} değişimi tamamlandı! Motor bileşenleri ve depo güncellendi.`);
            refetch();
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Değişim işlemi başarısız');
            console.error(error);
        }
    };

    const handleDelete = async (id: number) => {
        setDeleteConfirm({ isOpen: true, id });
    };
    
    const confirmDelete = async () => {
        if (deleteConfirm.id) {
            try {
                await swapsApi.delete(deleteConfirm.id);
                showSuccess('Değişim kaydı başarıyla silindi!');
                refetch();
            } catch (error) {
                showError('Değişim kaydı silinemedi');
            }
        }
        setDeleteConfirm({ isOpen: false, id: null });
    };

    const getComponentDescription = (id: number | null, serialNumber?: string) => {
        if (!id && serialNumber) {
            // BR-based swap, show serial number only
            return `SN: ${serialNumber}`;
        }
        if (!id) return '-';
        const item = inventory?.find(i => i.id === id);
        return item ? `${item.description} (SN: ${item.serialNumber})` : 'N/A';
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setUploadedFiles(Array.from(e.target.files));
        }
    };
    
    const handleDownload = async (docId: number) => {
        try {
            const blob = await newDocsApi.download(docId);
            const doc = await newDocsApi.getById(docId);
            if (doc) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = doc.fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            showError('Doküman indirilemedi');
        }
    };

    if (!swaps || !engines || !inventory) return <LoadingSpinner text="Montaj sayfası yükleniyor..." />;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Parça Montajı</h1>
            <p className="text-brand-light">Motorlardan parça ve montaj gruplarını takın veya çıkarın.</p>

            {canSwap && (
                <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
                    <h2 className="text-lg font-bold text-white mb-4">Parça/Montaj Değişim Aracı</h2>
                    <form onSubmit={handleSwap} className="space-y-4">
                        {/* Swap Type Selection */}
                        <div>
                            <label className="block text-sm font-medium text-brand-light mb-2">
                                Değişim Tipi
                            </label>
                            <div className="flex space-x-4">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        value="Component"
                                        checked={swapState.swapType === 'Component'}
                                        onChange={(e) => setSwapState({...swapState, swapType: e.target.value as 'Component', assemblyGroup: ''})}
                                        className="form-radio text-brand-primary"
                                    />
                                    <span className="text-white">Tekil Parça</span>
                                </label>
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        value="Assembly"
                                        checked={swapState.swapType === 'Assembly'}
                                        onChange={(e) => setSwapState({...swapState, swapType: e.target.value as 'Assembly'})}
                                        className="form-radio text-brand-primary"
                                    />
                                    <span className="text-white">Alt Montaj Grubu</span>
                                </label>
                            </div>
                        </div>
                        
                        {/* Engine Selection */}
                        <select
                            value={swapState.engineId}
                            onChange={(e) => setSwapState({...swapState, engineId: e.target.value, assemblyGroup: ''})}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            required
                        >
                            <option value="">1. Motor Seçin</option>
                            {engines?.map(e => <option key={e.id} value={e.id}>{e.serialNumber}</option>)}
                        </select>
                        
                        {/* Assembly Group Selection (only for Assembly type and after engine selected) */}
                        {swapState.swapType === 'Assembly' && swapState.engineId && (
                            <div>
                                <select
                                    value={swapState.assemblyGroup}
                                    onChange={(e) => setSwapState({...swapState, assemblyGroup: e.target.value})}
                                    className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                                    required
                                >
                                    <option value="">-- Alt Montaj Grubu Seçin --</option>
                                    {availableAssemblyGroups.length > 0 ? (
                                        availableAssemblyGroups.map(group => (
                                            <option key={group} value={group}>{group}</option>
                                        ))
                                    ) : (
                                        <option value="" disabled>Motor üzerinde alt montaj grubu bulunamadı</option>
                                    )}
                                </select>
                                {availableAssemblyGroups.length === 0 && (
                                    <p className="text-sm text-yellow-400 mt-1">
                                        ⚠️ Seçilen motorda alt montaj grubu tanımlı değil
                                    </p>
                                )}
                            </div>
                        )}
                        
                        <select
                            value={swapState.removeId}
                            onChange={(e) => setSwapState({...swapState, removeId: e.target.value})}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            required
                        >
                            <option value="">2. ÇIKARILACAK {swapState.swapType === 'Assembly' ? 'Alt Montaj Grubu' : 'Parça'} Seçin</option>
                            {inventory?.map(i => (
                                <option key={i.id} value={i.id}>
                                    {`${i.description} (SN: ${i.serialNumber})`}
                                </option>
                            ))}
                        </select>
                        
                        <select
                            value={swapState.installId}
                            onChange={(e) => setSwapState({...swapState, installId: e.target.value})}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            required
                        >
                            <option value="">3. TAKILACAK {swapState.swapType === 'Assembly' ? 'Alt Montaj Grubu' : 'Parça'} Seçin (Depodan)</option>
                            {inventory?.map(i => (
                                <option key={i.id} value={i.id}>
                                    {`${i.description} (SN: ${i.serialNumber})`}
                                </option>
                            ))}
                        </select>
                        
                        {/* Swap Information */}
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 text-sm">
                            <p className="font-semibold text-yellow-400 mb-2">⚠️ Değişim İşlemi:</p>
                            <ul className="list-disc list-inside text-brand-light ml-2 space-y-1">
                                <li>Çıkarılan parça motordan kaldırılacak</li>
                                <li>Takılan parça motora eklenecek</li>
                                <li>Takılan parçanın saati <strong>motor saati ile senkronize edilecek</strong></li>
                                <li>Değişim kaydı aktivite log'una eklenecek</li>
                            </ul>
                        </div>
                        
                        {/* Document Upload */}
                        <div>
                            <label className="block text-sm font-medium text-brand-light mb-2">
                                Doküman Ekle (Opsiyonel)
                            </label>
                            <input 
                                type="file" 
                                multiple 
                                onChange={handleFileChange}
                                className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            />
                            {uploadedFiles.length > 0 && (
                                <p className="text-sm text-brand-light mt-1">
                                    {uploadedFiles.length} dosya seçildi
                                </p>
                            )}
                        </div>
                        
                        <button type="submit" className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">
                            {swapState.swapType === 'Assembly' ? 'Alt Montaj Grubu' : 'Parça'} Değişimini Gerçekleştir
                        </button>
                    </form>
                </div>
            )}

            <div className="bg-brand-card rounded-lg border border-brand-border">
                <h2 className="text-lg font-bold text-white p-4 border-b border-brand-border">Son Değişim Aktiviteleri</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-brand-border bg-brand-dark">
                            <tr>
                                <th className="p-3 font-semibold">TARİH</th>
                                <th className="p-3 font-semibold">MOTOR</th>
                                <th className="p-3 font-semibold">TİP</th>
                                <th className="p-3 font-semibold">MONTAJ GRUBU</th>
                                <th className="p-3 font-semibold">TAKILAN</th>
                                <th className="p-3 font-semibold">ÇIKARILAN</th>
                                <th className="p-3 font-semibold">İŞLEMİ YAPAN</th>
                                <th className="p-3 font-semibold">DOKÜMAN</th>
                                {canModify && <th className="p-3 font-semibold">İŞLEMLER</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {swaps?.map(swap => (
                                <tr key={swap.id} className="border-b border-brand-border hover:bg-brand-dark">
                                    <td className="p-3">{new Date(swap.swapDate).toLocaleDateString()}</td>
                                    <td className="p-3">{engines?.find(e => e.id === swap.engineId)?.serialNumber}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                            swap.swapType === 'BR Update'
                                                ? 'bg-green-500/20 text-green-400'
                                                : swap.swapType === 'Assembly' 
                                                ? 'bg-purple-500/20 text-purple-400' 
                                                : 'bg-blue-500/20 text-blue-400'
                                        }`}>
                                            {swap.swapType === 'BR Update' ? 'BR Güncelleme' : swap.swapType === 'Assembly' ? 'Montaj' : 'Parça'}
                                        </span>
                                    </td>
                                    <td className="p-3">{swap.assemblyGroup || '-'}</td>
                                    <td className="p-3 text-green-400">{getComponentDescription(swap.componentInstalledId, swap.installedSerialNumber)}</td>
                                    <td className="p-3 text-red-400">{getComponentDescription(swap.componentRemovedId, swap.removedSerialNumber)}</td>
                                    <td className="p-3 text-brand-light">{swap.userName}</td>
                                    <td className="p-3">
                                        {swap.documentId && (
                                            <button 
                                                onClick={() => handleDownload(swap.documentId!)} 
                                                className="text-brand-primary hover:text-blue-400"
                                            >
                                                <PaperclipIcon />
                                            </button>
                                        )}
                                    </td>
                                    {canModify && (
                                        <td className="p-3 flex space-x-4">
                                            <button disabled className="text-gray-600 cursor-not-allowed"><PencilIcon /></button>
                                            <button onClick={() => handleDelete(swap.id!)} className="text-brand-danger hover:text-red-400"><TrashIcon /></button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {swaps.length === 0 && (
                        <div className="p-12 text-center text-brand-light">
                            Henüz kayıtlı değişim aktivitesi bulunmuyor.
                        </div>
                    )}
                </div>
            </div>
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                title="Değişim Kaydını Sil"
                message="Bu değişim kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
                confirmText="Sil"
                cancelText="İptal"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
                variant="danger"
            />
        </div>
    );
};

export default Assembler;
