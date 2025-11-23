import React, { useState, useMemo } from 'react';
import { useQuery, useRefetch } from '../hooks/useData';
import { swapsApi, enginesApi, inventoryApi } from '../lib/client.ts';
import { documentsApi as newDocsApi } from '../lib/newApis.ts';
import { useAuth } from '../context/AuthContext';
import type { SwapActivity, Component, InventoryItem } from '../types';
import { PencilIcon, TrashIcon, PaperclipIcon } from '../constants';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import { showSuccess, showError, showWarning } from '../utils/toast';
import { 
    flattenComponents, 
    findComponentById, 
    replaceComponentInTree, 
    removeAssemblyGroup,
    syncComponentHours,
    findComponentsByAssemblyGroup
} from '../utils/componentUtils';
import { format } from 'date-fns';

// Helper: Extract unique assembly groups from engine components
function extractAssemblyGroups(components: Component[]): string[] {
    const groups = new Set<string>();
    
    function traverse(comps: Component[]) {
        for (const comp of comps) {
            // Top-level components are considered assembly groups
            if (comp.description && comp.children && comp.children.length > 0) {
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

// Helper: Convert inventory item to component
function inventoryToComponent(item: InventoryItem, engineTotalHours: number): Component {
    return {
        id: item.id!,
        description: item.description,
        partNumber: item.partNumber,
        serialNumber: item.serialNumber,
        // Use item's own hours if it has them (for parts returning from warehouse)
        // Otherwise start from 0 for new parts
        currentHours: item.currentHours || 0,
        // Use item's life limit if it has one
        lifeLimit: item.lifeLimit || 0,
        children: []
    };
}

const Assembler: React.FC = () => {
    const { user } = useAuth();
    const { refreshKey, refetch } = useRefetch();
    const swaps = useQuery(() => swapsApi.getAll(), [refreshKey]);
    const engines = useQuery(() => enginesApi.getAll(), [refreshKey]);
    const inventory = useQuery(() => inventoryApi.getAll(), [refreshKey]);

    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

    const canModify = user?.role === 'Administrator' || user?.role === 'Assembly Engineer';
    const canSwap = canModify || user?.role === 'Assembly Operator';
    const canEditHistory = user?.role === 'Administrator' || user?.role === 'Assembly Engineer' || user?.role === 'Assembly Operator';

    const [editingSwap, setEditingSwap] = useState<SwapActivity | null>(null);

    // Enhanced form state with swap type and assembly group
    const [swapState, setSwapState] = useState({
        engineId: '',
        removeId: '', // Component ID from ENGINE
        installId: '', // Inventory item ID from INVENTORY
        swapType: 'Component' as 'Component' | 'Assembly',
        assemblyGroup: '', // Group to remove from engine
        assemblyGroupToInstall: '', // Group to install from inventory
        installLater: false // If true, only remove, don't install (install later)
    });

    // Search filters
    const [removeSearchQuery, setRemoveSearchQuery] = useState('');
    const [installSearchQuery, setInstallSearchQuery] = useState('');

    // Get selected engine
    const selectedEngine = useMemo(() => {
        if (!swapState.engineId || !engines) return null;
        return engines.find(e => e.id === parseInt(swapState.engineId));
    }, [swapState.engineId, engines]);

    // Get flat list of components from selected engine (for removal)
    const engineComponents = useMemo(() => {
        if (!selectedEngine) return [];
        return flattenComponents(selectedEngine.components);
    }, [selectedEngine]);

    // Get available assembly groups for selected engine
    const availableAssemblyGroups = useMemo(() => {
        if (!selectedEngine) return [];
        return extractAssemblyGroups(selectedEngine.components);
    }, [selectedEngine]);

    // Get selected component to be removed (for filtering compatible inventory items)
    const selectedRemoveComponent = useMemo(() => {
        if (!swapState.removeId || !selectedEngine) return null;
        return findComponentById(selectedEngine.components, parseInt(swapState.removeId));
    }, [swapState.removeId, selectedEngine]);

    // Filter inventory items
    const compatibleInventoryItems = useMemo(() => {
        if (!inventory) return [];
        if (swapState.swapType === 'Assembly') {
            // For assembly mode, show items with assemblyGroup
            return inventory.filter(item => item.assemblyGroup);
        }
        // Component mode: Show all inventory items (no compatibility restriction)
        return inventory;
    }, [inventory, swapState.swapType]);

    // Filtered lists based on search queries
    const filteredEngineComponents = useMemo(() => {
        if (!removeSearchQuery) return engineComponents;
        const query = removeSearchQuery.toLowerCase();
        return engineComponents.filter(comp => 
            comp.description.toLowerCase().includes(query) || 
            comp.partNumber.toLowerCase().includes(query) || 
            comp.serialNumber.toLowerCase().includes(query)
        );
    }, [engineComponents, removeSearchQuery]);

    const filteredInventoryItems = useMemo(() => {
        if (!installSearchQuery) return compatibleInventoryItems;
        const query = installSearchQuery.toLowerCase();
        return compatibleInventoryItems.filter(item => 
            item.description.toLowerCase().includes(query) || 
            item.partNumber.toLowerCase().includes(query) || 
            item.serialNumber.toLowerCase().includes(query)
        );
    }, [compatibleInventoryItems, installSearchQuery]);

    // Get unique assembly groups from inventory
    const inventoryAssemblyGroups = useMemo(() => {
        if (!inventory) return [];
        const groups = new Set<string>();
        inventory.forEach(item => {
            if (item.assemblyGroup) {
                groups.add(item.assemblyGroup);
            }
        });
        return Array.from(groups).sort();
    }, [inventory]);

    const handleSwap = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !swapState.engineId) {
            showError('Lütfen bir motor seçin');
            return;
        }
        
        const engineId = parseInt(swapState.engineId);
        const engine = engines?.find(e => e.id === engineId);
        if (!engine) {
            showError('Motor bulunamadı');
            return;
        }
        
        try {
            if (swapState.swapType === 'Assembly') {
                // ========== ASSEMBLY MODE: Replace entire assembly group ==========
                if (!swapState.assemblyGroup || !swapState.assemblyGroupToInstall) {
                    showError('Lütfen çıkarılacak ve takılacak alt montaj gruplarını seçin');
                    return;
                }

                // 1. Get all components in the assembly group to be removed from engine
                const removedComponents = findComponentsByAssemblyGroup(
                    engine.components, 
                    swapState.assemblyGroup
                );

                // 2. Get all inventory items for the new assembly group
                const newAssemblyItems = inventory?.filter(
                    item => item.assemblyGroup === swapState.assemblyGroupToInstall
                ) || [];

                if (newAssemblyItems.length === 0) {
                    showError('Seçilen alt montaj grubu depoda bulunamadı');
                    return;
                }

                // 3. Convert inventory items to components and sync hours
                const newComponents = newAssemblyItems.map(item => 
                    inventoryToComponent(item, engine.totalHours)
                );

                // 4. Create the assembly group structure (find root component)
                const rootItem = newAssemblyItems.find(item => 
                    !item.assemblyGroup || 
                    item.description === item.assemblyGroup
                );

                let newAssemblyRoot: Component;
                if (rootItem) {
                    newAssemblyRoot = inventoryToComponent(rootItem, engine.totalHours);
                    // Add other items as children
                    newAssemblyRoot.children = newComponents.filter(c => c.id !== rootItem.id);
                } else {
                    // Create a wrapper component
                    newAssemblyRoot = {
                        id: Date.now(), // Temporary ID
                        description: swapState.assemblyGroupToInstall,
                        partNumber: newAssemblyItems[0].assemblyPartNumber || '',
                        serialNumber: newAssemblyItems[0].assemblySerialNumber || '',
                        currentHours: engine.totalHours,
                        lifeLimit: 0,
                        children: newComponents
                    };
                }

                // 5. Update engine components - remove old assembly, add new
                let updatedComponents = removeAssemblyGroup(
                    engine.components, 
                    swapState.assemblyGroup
                );
                updatedComponents.push(newAssemblyRoot);

                // 6. Create swap record
                const createdSwap = await swapsApi.create({
                    engineId: engineId,
                    componentInstalledId: null,
                    componentRemovedId: null,
                    swapDate: new Date().toISOString(),
                    swapType: 'Assembly',
                    assemblyGroup: swapState.assemblyGroup,
                    userName: user.fullName,
                    installedSerialNumber: swapState.assemblyGroupToInstall,
                    removedSerialNumber: swapState.assemblyGroup
                });

                // 7. Upload documents if any
                if (uploadedFiles.length > 0 && createdSwap.id) {
                    for (const file of uploadedFiles) {
                        await newDocsApi.upload(file, {
                            relatedType: 'swap',
                            relatedId: createdSwap.id,
                            uploadedBy: user.fullName
                        });
                    }
                }

                // 8. Update engine
                await enginesApi.update(engineId, {
                    components: updatedComponents
                });

                // 9. Remove installed items from inventory
                for (const item of newAssemblyItems) {
                    await inventoryApi.delete(item.id!);
                }

                // 10. Add removed components to inventory WITH their current hours
                for (const comp of removedComponents) {
                    await inventoryApi.create({
                        partNumber: comp.partNumber,
                        serialNumber: comp.serialNumber,
                        description: comp.description,
                        location: 'Depo',
                        userName: user.fullName,
                        quantity: 1,
                        assemblyGroup: swapState.assemblyGroup,
                        assemblyPartNumber: comp.partNumber,
                        assemblySerialNumber: comp.serialNumber,
                        currentHours: comp.currentHours, // Save working hours
                        lifeLimit: comp.lifeLimit // Save life limit
                    });
                }

                setSwapState({ 
                    engineId: '', 
                    removeId: '', 
                    installId: '', 
                    swapType: 'Component', 
                    assemblyGroup: '', 
                    assemblyGroupToInstall: '' 
                });
                setUploadedFiles([]);
                showSuccess(`Alt montaj grubu "${swapState.assemblyGroup}" başarıyla "${swapState.assemblyGroupToInstall}" ile değiştirildi!`);
                refetch();
                
            } else {
                // ========== COMPONENT MODE: Replace or Remove individual component ==========
                if (!swapState.removeId || (!swapState.installId && !swapState.installLater)) {
                    showError('Lütfen çıkarılacak parçayı seçin ve yeni parçayı seçin veya "sonra takılacak" işaretleyin');
                    return;
                }

                const removedId = parseInt(swapState.removeId);
                
                // Get component to remove from engine
                const removedComponent = findComponentById(engine.components, removedId);
                if (!removedComponent) {
                    showError('Çıkarılacak parça motor üzerinde bulunamadı');
                    return;
                }

                if (swapState.installLater) {
                    // ========== ONLY REMOVE (Install later) ==========
                    // Create swap activity (remove only)
                    const createdSwap = await swapsApi.create({
                        engineId: engineId,
                        componentInstalledId: null,
                        componentRemovedId: removedId,
                        swapDate: new Date().toISOString(),
                        swapType: 'Component',
                        assemblyGroup: undefined,
                        userName: user.fullName,
                        installedSerialNumber: undefined,
                        removedSerialNumber: removedComponent.serialNumber
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
                    
                    // Remove component from engine (without replacement)
                    const updatedComponents = engine.components.filter(c => c.id !== removedId);
                    
                    await enginesApi.update(engineId, {
                        components: updatedComponents
                    });
                    
                    // Add removed component to inventory WITH its current hours
                    await inventoryApi.create({
                        partNumber: removedComponent.partNumber,
                        serialNumber: removedComponent.serialNumber,
                        description: removedComponent.description,
                        location: 'Depo',
                        userName: user.fullName,
                        quantity: 1,
                        currentHours: removedComponent.currentHours,
                        lifeLimit: removedComponent.lifeLimit
                    });
                    
                    setSwapState({ 
                        engineId: '', 
                        removeId: '', 
                        installId: '', 
                        swapType: 'Component', 
                        assemblyGroup: '', 
                        assemblyGroupToInstall: '',
                        installLater: false
                    });
                    setUploadedFiles([]);
                    showSuccess('Parça başarıyla motordan sökülüp depoya eklendi!');
                    refetch();

                } else {
                    // ========== SWAP (Replace with new part) ==========
                    const installedId = parseInt(swapState.installId);
                    
                    // Get inventory item to install
                    const inventoryItem = inventory?.find(i => i.id === installedId);
                    if (!inventoryItem) {
                        showError('Takılacak parça depoda bulunamadı');
                        return;
                    }

                    // Create swap activity
                    const createdSwap = await swapsApi.create({
                        engineId: engineId,
                        componentInstalledId: installedId,
                        componentRemovedId: removedId,
                        swapDate: new Date().toISOString(),
                        swapType: 'Component',
                        assemblyGroup: undefined,
                        userName: user.fullName,
                        installedSerialNumber: inventoryItem.serialNumber,
                        removedSerialNumber: removedComponent.serialNumber
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
                    
                    // Convert inventory item to component
                    const newComponent = inventoryToComponent(inventoryItem, engine.totalHours);
                    
                    // Update engine components
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
                    
                    // Add removed component to inventory WITH its current hours
                    await inventoryApi.create({
                        partNumber: removedComponent.partNumber,
                        serialNumber: removedComponent.serialNumber,
                        description: removedComponent.description,
                        location: 'Depo',
                        userName: user.fullName,
                        quantity: 1,
                        assemblyGroup: inventoryItem.assemblyGroup,
                        assemblyPartNumber: inventoryItem.assemblyPartNumber,
                        assemblySerialNumber: inventoryItem.assemblySerialNumber,
                        currentHours: removedComponent.currentHours,
                        lifeLimit: removedComponent.lifeLimit
                    });
                    
                    setSwapState({ 
                        engineId: '', 
                        removeId: '', 
                        installId: '', 
                        swapType: 'Component', 
                        assemblyGroup: '', 
                        assemblyGroupToInstall: '',
                        installLater: false
                    });
                    setUploadedFiles([]);
                    showSuccess('Parça değişimi tamamlandı! Motor ve depo güncellendi.');
                    refetch();
                }
            }
        } catch (error) {
            showError('Değişim işlemi başarısız', error);
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
        // Debug log
        // console.log('getComponentDescription called:', { id, serialNumber });
        
        // If no ID but we have serial number, try to find by serial number
        if (!id && serialNumber) {
            // Search in inventory
            const invItem = inventory?.find(i => i.serialNumber === serialNumber);
            if (invItem) {
                return `${invItem.description} (SN: ${invItem.serialNumber})`;
            }
            
            // Search in all engines
            if (engines) {
                for (const engine of engines) {
                    const findBySN = (comps: Component[]): Component | undefined => {
                        for (const comp of comps) {
                            if (comp.serialNumber === serialNumber) return comp;
                            if (comp.children) {
                                const found = findBySN(comp.children);
                                if (found) return found;
                            }
                        }
                        return undefined;
                    };
                    const comp = findBySN(engine.components);
                    if (comp) {
                        return `${comp.description} (SN: ${comp.serialNumber})`;
                    }
                }
            }
            
            // If not found anywhere, just show serial number
            return `SN: ${serialNumber}`;
        }
        
        if (!id) return '-';
        
        // Try to find by ID in current inventory
        const item = inventory?.find(i => i.id === id);
        if (item) {
            return `${item.description} (SN: ${item.serialNumber})`;
        }
        
        // Try to find by ID in engine components
        if (engines) {
            for (const engine of engines) {
                const comp = findComponentById(engine.components, id);
                if (comp) {
                    return `${comp.description} (SN: ${comp.serialNumber})`;
                }
            }
        }
        
        return 'N/A';
    };
    
    const handleEditClick = (swap: SwapActivity) => {
        if (!canEditHistory) {
            showWarning('Bu işlemi yapmaya yetkiniz yok.');
            return;
        }
        setEditingSwap(swap);
    };

    const handleUpdateSwap = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSwap || !editingSwap.id) return;

        try {
            await swapsApi.update(editingSwap.id, {
                swapDate: editingSwap.swapDate
            });
            showSuccess('Değişim kaydı güncellendi');
            setEditingSwap(null);
            refetch();
        } catch (error) {
            showError('Güncelleme başarısız');
        }
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
                                <label 
                                    className="flex items-center space-x-2 cursor-pointer" 
                                    title="Tekil bir parça (örn: vida, rulman) değiştirmek için"
                                >
                                    <input
                                        type="radio"
                                        value="Component"
                                        checked={swapState.swapType === 'Component'}
                                        onChange={(e) => setSwapState({
                                            engineId: swapState.engineId, 
                                            removeId: '', 
                                            installId: '', 
                                            swapType: e.target.value as 'Component', 
                                            assemblyGroup: '', 
                                            assemblyGroupToInstall: ''
                                        })}
                                        className="form-radio text-brand-primary"
                                    />
                                    <span className="text-white">Tekil Parça</span>
                                    <span className="text-xs text-brand-light ml-1">ℹ️</span>
                                </label>
                                <label 
                                    className="flex items-center space-x-2 cursor-pointer" 
                                    title="Bir alt montaj grubunu (örn: tüm türbin, kompresör) değiştirmek için"
                                >
                                    <input
                                        type="radio"
                                        value="Assembly"
                                        checked={swapState.swapType === 'Assembly'}
                                        onChange={(e) => setSwapState({
                                            engineId: swapState.engineId, 
                                            removeId: '', 
                                            installId: '', 
                                            swapType: e.target.value as 'Assembly', 
                                            assemblyGroup: '', 
                                            assemblyGroupToInstall: ''
                                        })}
                                        className="form-radio text-brand-primary"
                                    />
                                    <span className="text-white">Alt Montaj Grubu</span>
                                    <span className="text-xs text-brand-light ml-1">ℹ️</span>
                                </label>
                            </div>
                        </div>
                        
                        {/* Engine Selection */}
                        <div>
                            <label className="block text-sm font-medium text-brand-light mb-2">
                                1. Motor Seçin
                            </label>
                            <select
                                value={swapState.engineId}
                                onChange={(e) => setSwapState({
                                    ...swapState, 
                                    engineId: e.target.value, 
                                    removeId: '', 
                                    installId: '', 
                                    assemblyGroup: '', 
                                    assemblyGroupToInstall: ''
                                })}
                                className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                                required
                            >
                                <option value="">-- Motor Seçin --</option>
                                {engines?.map(e => (
                                    <option key={e.id} value={e.id}>
                                        {e.serialNumber} ({e.model}) - {e.totalHours}h
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        {/* Different flow for Assembly vs Component */}
                        {swapState.swapType === 'Assembly' ? (
                            // Assembly mode: Select which assembly group to swap
                            swapState.engineId && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-brand-light mb-2">
                                            2. Motor Üzerinden ÇIKARILACAK Alt Montaj Grubunu Seçin
                                        </label>
                                        <select
                                            value={swapState.assemblyGroup}
                                            onChange={(e) => setSwapState({...swapState, assemblyGroup: e.target.value})}
                                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                                            required
                                        >
                                            <option value="">-- Motordan çıkarılacak alt montaj grubunu seçin --</option>
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

                                    <div>
                                        <label className="block text-sm font-medium text-brand-light mb-2">
                                            3. Depodan TAKILACAK Alt Montaj Grubunu Seçin
                                        </label>
                                        <select
                                            value={swapState.assemblyGroupToInstall}
                                            onChange={(e) => setSwapState({...swapState, assemblyGroupToInstall: e.target.value})}
                                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                                            required
                                        >
                                            <option value="">-- Depodan takılacak alt montaj grubunu seçin --</option>
                                            {inventoryAssemblyGroups.length > 0 ? (
                                                inventoryAssemblyGroups.map(group => {
                                                    const count = inventory?.filter(i => i.assemblyGroup === group).length || 0;
                                                    return (
                                                        <option key={group} value={group}>
                                                            {group} ({count} parça)
                                                        </option>
                                                    );
                                                })
                                            ) : (
                                                <option value="" disabled>Depoda alt montaj grubu bulunamadı</option>
                                            )}
                                        </select>
                                        {inventoryAssemblyGroups.length === 0 && (
                                            <p className="text-sm text-yellow-400 mt-1">
                                                ⚠️ Depoda alt montaj grubu tanımlı değil. Depo → Yeni Parça Ekle → Alt Montaj Grubu belirtin.
                                            </p>
                                        )}
                                    </div>

                                    {/* Info box for assembly swap */}
                                    {swapState.assemblyGroup && swapState.assemblyGroupToInstall && (
                                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-3 text-sm">
                                            <p className="font-semibold text-blue-400 mb-2">📦 Alt Montaj Grubu Değişimi:</p>
                                            <ul className="list-disc list-inside text-brand-light ml-2 space-y-1">
                                                <li>Motordan <strong className="text-red-400">"{swapState.assemblyGroup}"</strong> grubu ve tüm parçaları çıkarılacak</li>
                                                <li>Depodan <strong className="text-green-400">"{swapState.assemblyGroupToInstall}"</strong> grubu ve tüm parçaları takılacak</li>
                                                <li>Çıkarılan parçalar depoya eklenecek</li>
                                                <li>Takılan parçalar depodan çıkarılacak</li>
                                                <li>Tüm parçaların saati motor saati ile senkronize edilecek</li>
                                            </ul>
                                        </div>
                                    )}
                                </>
                            )
                        ) : (
                            // Component mode: Select individual parts
                            swapState.engineId && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-brand-light mb-2">
                                            2. Motor Üzerinden ÇIKARILACAK Parçayı Seçin
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Parça ara (Tanım, PN veya SN)..."
                                            value={removeSearchQuery}
                                            onChange={(e) => {
                                                setRemoveSearchQuery(e.target.value);
                                                setSwapState(prev => ({ ...prev, removeId: '' }));
                                            }}
                                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white mb-2 text-sm focus:border-brand-primary focus:outline-none"
                                        />
                                        <select
                                            value={swapState.removeId}
                                            onChange={(e) => setSwapState({...swapState, removeId: e.target.value, installId: ''})}
                                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                                            required
                                            size={5} // Show multiple lines for easier selection
                                        >
                                            <option value="">-- Motor üzerindeki parçayı seçin --</option>
                                            {filteredEngineComponents.length > 0 ? (
                                                filteredEngineComponents.map(comp => (
                                                    <option key={comp.id} value={comp.id}>
                                                        {comp.description} (PN: {comp.partNumber}, SN: {comp.serialNumber}) - {comp.currentHours}h
                                                    </option>
                                                ))
                                            ) : (
                                                <option value="" disabled>Eşleşen parça bulunamadı</option>
                                            )}
                                        </select>
                                        {engineComponents.length === 0 && (
                                            <p className="text-sm text-yellow-400 mt-1">
                                                ⚠️ Motor üzerinde parça yok. Önce Build Report yükleyin.
                                            </p>
                                        )}
                                    </div>
                                    
                                    {swapState.removeId && (
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <label className="block text-sm font-medium text-brand-light">
                                                    3. Depodan TAKILACAK Parçayı Seçin
                                                </label>
                                                <label className="flex items-center space-x-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={swapState.installLater}
                                                        onChange={(e) => setSwapState({...swapState, installLater: e.target.checked, installId: ''})}
                                                        className="form-checkbox text-brand-primary"
                                                    />
                                                    <span className="text-xs text-brand-light">Yeni parça şimdi takılmayacak (sonra)</span>
                                                </label>
                                            </div>
                                            {!swapState.installLater && (
                                                <>
                                                    <input
                                                        type="text"
                                                        placeholder="Parça ara (Tanım, PN veya SN)..."
                                                        value={installSearchQuery}
                                                        onChange={(e) => {
                                                            setInstallSearchQuery(e.target.value);
                                                            setSwapState(prev => ({ ...prev, installId: '' }));
                                                        }}
                                                        className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white mb-2 text-sm focus:border-brand-primary focus:outline-none"
                                                    />
                                                    <select
                                                        value={swapState.installId}
                                                        onChange={(e) => setSwapState({...swapState, installId: e.target.value})}
                                                        className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                                                        required
                                                        size={5}
                                                    >
                                                        <option value="">-- Depodan takılacak parçayı seçin --</option>
                                                        {filteredInventoryItems.length > 0 ? (
                                                            filteredInventoryItems.map(i => (
                                                                <option key={i.id} value={i.id}>
                                                                    {i.description} (PN: {i.partNumber}, SN: {i.serialNumber}) - {i.currentHours ? `${i.currentHours.toFixed(1)}h` : '0h'} - {i.location}
                                                                </option>
                                                            ))
                                                        ) : (
                                                            <option value="" disabled>Eşleşen parça bulunamadı</option>
                                                        )}
                                                    </select>
                                                    {compatibleInventoryItems.length === 0 && (
                                                        <p className="text-sm text-yellow-400 mt-1">
                                                            ⚠️ Depoda hiç parça yok. Önce depo'ya parça ekleyin.
                                                        </p>
                                                    )}
                                                </>
                                            )}
                                            {swapState.installLater && (
                                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 text-sm text-yellow-200">
                                                    ℹ️ Parça sadece motordan sökülecek, depoya eklenecek. Yeni parça sonra takılacak.
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Info box for component swap or removal */}
                                    {swapState.removeId && selectedRemoveComponent && (swapState.installId || swapState.installLater) && (
                                        <div className={`${swapState.installLater ? 'bg-orange-500/10 border-orange-500/30' : 'bg-green-500/10 border-green-500/30'} border rounded-md p-3 text-sm`}>
                                            <p className={`font-semibold ${swapState.installLater ? 'text-orange-400' : 'text-green-400'} mb-2`}>
                                                {swapState.installLater ? '⚠️ Parça Sökme İşlemi:' : '✅ Parça Değişimi Hazır:'}
                                            </p>
                                            <ul className="list-disc list-inside text-brand-light ml-2 space-y-1">
                                                <li>Çıkarılacak: <strong className="text-red-400">{selectedRemoveComponent.description}</strong> (SN: {selectedRemoveComponent.serialNumber})</li>
                                                {!swapState.installLater && swapState.installId && (
                                                    <li>Takılacak: <strong className="text-green-400">{compatibleInventoryItems.find(i => i.id === parseInt(swapState.installId))?.description}</strong> (SN: {compatibleInventoryItems.find(i => i.id === parseInt(swapState.installId))?.serialNumber})</li>
                                                )}
                                                {swapState.installLater && (
                                                    <li className="text-orange-300">Yeni parça: <strong>Henüz takılmayacak (sonra takılacak)</strong></li>
                                                )}
                                                <li>Çıkarılan parça depoya eklenecek</li>
                                                {!swapState.installLater && <li>Takılan parça depodan çıkarılacak</li>}
                                                {!swapState.installLater && <li>Yeni parçanın saati: <strong>{selectedEngine?.totalHours}h</strong> (motor saati ile senkron)</li>}
                                            </ul>
                                        </div>
                                    )}
                                </>
                            )
                        )}
                        
                        {/* Document Upload */}
                        <div>
                            <label className="block text-sm font-medium text-brand-light mb-2">
                                Doküman Ekle (Opsiyonel)
                            </label>
                            <input 
                                type="file" 
                                multiple 
                                onChange={handleFileChange}
                                className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-blue-600"
                            />
                            {uploadedFiles.length > 0 && (
                                <p className="text-sm text-brand-light mt-1">
                                    ✓ {uploadedFiles.length} dosya seçildi
                                </p>
                            )}
                        </div>
                        
                        <button 
                            type="submit" 
                            className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                            disabled={
                                !swapState.engineId ||
                                (swapState.swapType === 'Component' && (!swapState.removeId || (!swapState.installId && !swapState.installLater))) ||
                                (swapState.swapType === 'Assembly' && (!swapState.assemblyGroup || !swapState.assemblyGroupToInstall))
                            }
                        >
                            {swapState.swapType === 'Assembly' ? 'Alt Montaj Grubu Değişimini' : swapState.installLater ? 'Parça Sökme İşlemini' : 'Parça Değişimini'} Gerçekleştir
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
                                {canEditHistory && <th className="p-3 font-semibold">İŞLEMLER</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {swaps?.map(swap => (
                                <tr key={swap.id} className="border-b border-brand-border hover:bg-brand-dark transition-colors">
                                    <td className="p-3">{format(new Date(swap.swapDate), 'dd.MM.yyyy HH:mm')}</td>
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
                                                className="text-brand-primary hover:text-blue-400 transition-colors"
                                            >
                                                <PaperclipIcon />
                                            </button>
                                        )}
                                    </td>
                                    {canEditHistory && (
                                        <td className="p-3 flex space-x-4">
                                            <button 
                                                onClick={() => handleEditClick(swap)}
                                                className="text-brand-primary hover:text-blue-400 transition-colors" 
                                                title="Düzenle"
                                            >
                                                <PencilIcon />
                                            </button>
                                            {canModify && (
                                                <button 
                                                    onClick={() => handleDelete(swap.id!)} 
                                                    className="text-brand-danger hover:text-red-400 transition-colors"
                                                    title="Sil"
                                                >
                                                    <TrashIcon />
                                                </button>
                                            )}
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
            
            {editingSwap && (
                <Modal
                    isOpen={!!editingSwap}
                    onClose={() => setEditingSwap(null)}
                    title="Değişim Kaydını Düzenle"
                >
                    <form onSubmit={handleUpdateSwap} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-brand-light mb-1">
                                İşlem Tarihi
                            </label>
                            <input
                                type="datetime-local"
                                value={editingSwap.swapDate.slice(0, 16)}
                                onChange={(e) => setEditingSwap({ ...editingSwap, swapDate: new Date(e.target.value).toISOString() })}
                                className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                                required
                            />
                        </div>
                        
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-sm text-yellow-200">
                            ⚠️ Veri tutarlılığı için parça bilgileri düzenlenemez. Hatalı parça değişimi yaptıysanız, kaydı silip yeniden oluşturun.
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                type="button"
                                onClick={() => setEditingSwap(null)}
                                className="px-4 py-2 text-brand-light hover:text-white transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-brand-primary hover:bg-blue-600 text-white rounded transition-colors"
                            >
                                Kaydet
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

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
