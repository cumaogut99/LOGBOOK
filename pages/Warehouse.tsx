import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useRefetch } from '../hooks/useData';
import { inventoryApi, enginesApi } from '../lib/client.ts';
import { useAuth } from '../context/AuthContext';
import type { InventoryItem } from '../types';
import { TrashIcon, CirclePlusIcon, CircleMinusIcon, PencilIcon } from '../constants';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SearchFilter } from '../components/SearchFilter';
import { showSuccess, showError } from '../utils/toast';
import { formatStoredDate } from '../utils/dateDisplay';
import { parseWarehouseExcel, downloadWarehouseTemplate, type WarehouseExcelRow } from '../utils/warehouseExcelParser';

const Warehouse: React.FC = () => {
    const { user } = useAuth();
    const { refreshKey, refetch } = useRefetch();
    const inventory = useQuery(() => inventoryApi.getAll(), [refreshKey]);
    
    const [newItem, setNewItem] = useState<Omit<InventoryItem, 'id' | 'userName' | 'createdAt'>>({
        partNumber: '',
        serialNumber: '',
        description: '',
        location: '',
        assemblyGroup: '',
        assemblyPartNumber: '',
        assemblySerialNumber: '',
        currentHours: 0,
        lifeLimit: 0
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

    // Excel toplu yükleme state
    const [excelRows, setExcelRows] = useState<WarehouseExcelRow[] | null>(null);
    const [excelSkipped, setExcelSkipped] = useState<{ rowIndex: number; reason: string }[]>([]);
    const [excelImporting, setExcelImporting] = useState(false);
    const [showExcelModal, setShowExcelModal] = useState(false);
    const excelInputRef = useRef<HTMLInputElement>(null);

    const canModify = user?.role === 'Administrator' || user?.role === 'Planning Engineer';

    // Group items by assemblyGroup
    const groupedInventory = useMemo(() => {
        if (!inventory) return { groups: [], ungrouped: [] };
        
        const groups: { [key: string]: InventoryItem[] } = {};
        const ungrouped: InventoryItem[] = [];
        
        inventory.forEach(item => {
            if (item.assemblyGroup) {
                if (!groups[item.assemblyGroup]) {
                    groups[item.assemblyGroup] = [];
                }
                groups[item.assemblyGroup].push(item);
            } else {
                ungrouped.push(item);
            }
        });
        
        return { groups, ungrouped };
    }, [inventory]);

    // Envanter arama filtresi
    const filteredInventory = useMemo(() => {
        if (!inventory) return [];
        if (!searchTerm) return inventory;

        const term = searchTerm.toLowerCase();
        return inventory.filter(item =>
            item.description.toLowerCase().includes(term) ||
            item.partNumber.toLowerCase().includes(term) ||
            item.serialNumber.toLowerCase().includes(term) ||
            item.location.toLowerCase().includes(term) ||
            (item.assemblyGroup && item.assemblyGroup.toLowerCase().includes(term))
        );
    }, [inventory, searchTerm]);

    const toggleGroup = (groupName: string) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(groupName)) {
                newSet.delete(groupName);
            } else {
                newSet.add(groupName);
            }
            return newSet;
        });
    };

    // Get unique assembly groups with their part/serial numbers
    const existingAssemblyGroups = useMemo(() => {
        if (!inventory) return [];
        const groupMap = new Map<string, { partNumber: string; serialNumber: string }>();
        
        inventory.forEach(item => {
            if (item.assemblyGroup && !groupMap.has(item.assemblyGroup)) {
                groupMap.set(item.assemblyGroup, {
                    partNumber: item.assemblyPartNumber || '',
                    serialNumber: item.assemblySerialNumber || ''
                });
            }
        });
        
        return Array.from(groupMap.entries()).map(([name, info]) => ({
            name,
            ...info
        }));
    }, [inventory]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        // If assembly group is selected, auto-fill part/serial numbers if they exist
        if (name === 'assemblyGroup' && value) {
            const existingGroup = existingAssemblyGroups.find(g => g.name === value);
            if (existingGroup) {
                setNewItem(prev => ({
                    ...prev,
                    assemblyGroup: value,
                    assemblyPartNumber: existingGroup.partNumber,
                    assemblySerialNumber: existingGroup.serialNumber
                }));
                return;
            }
        }
        
        setNewItem(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        // Validate serial number uniqueness
        if (newItem.serialNumber && newItem.serialNumber.trim() && newItem.serialNumber !== '-' && newItem.serialNumber !== 'N/A') {
            // Skip check if editing and SN hasn't changed
            if (!editingItem || editingItem.serialNumber !== newItem.serialNumber) {
                 try {
                    const result = await enginesApi.checkDuplicates([newItem.serialNumber]);
                    if (result.duplicates && result.duplicates.length > 0) {
                        const dup = result.duplicates[0];
                        showError(`HATA: Bu seri numarası (${dup.serialNumber}) zaten sistemde mevcut!\nKonum: ${dup.location}`);
                        return;
                    }
                 } catch (err) {
                     console.error(err);
                     showError('Seri numarası kontrolü yapılamadı.');
                     return;
                 }
            }
        }

        try {
            if (editingItem) {
                // Update existing item
                const itemData = { 
                    ...newItem, 
                    userName: user.fullName,
                    quantity: 1,
                    assemblyGroup: newItem.assemblyGroup || undefined,
                    assemblyPartNumber: newItem.assemblyPartNumber || undefined,
                    assemblySerialNumber: newItem.assemblySerialNumber || undefined
                };
                await inventoryApi.update(editingItem.id!, itemData);
                setEditingItem(null);
                showSuccess('Parça başarıyla güncellendi!');
            } else {
                // Create new item
                const itemData = { 
                    ...newItem, 
                    userName: user.fullName,
                    quantity: 1,
                    assemblyGroup: newItem.assemblyGroup || undefined,
                    assemblyPartNumber: newItem.assemblyPartNumber || undefined,
                    assemblySerialNumber: newItem.assemblySerialNumber || undefined
                };
                await inventoryApi.create(itemData);
                showSuccess('Parça başarıyla depoya eklendi!');
            }
            setNewItem({ partNumber: '', serialNumber: '', description: '', location: '', assemblyGroup: '', assemblyPartNumber: '', assemblySerialNumber: '', currentHours: 0, lifeLimit: 0 });
            refetch();
        } catch (error: any) {
            // Handle 409 Conflict errors (duplicate serial number)
            if (error.response?.status === 409) {
                const errorMsg = error.response.data.error || 'Bu seri numarası zaten kullanımda';
                showError(errorMsg);
            } else {
                showError(editingItem ? 'Parça güncellenirken hata oluştu' : 'Parça eklenirken hata oluştu');
            }
        }
    };

    const handleEdit = (item: InventoryItem) => {
        setEditingItem(item);
        setNewItem({
            partNumber: item.partNumber,
            serialNumber: item.serialNumber,
            description: item.description,
            location: item.location,
            assemblyGroup: item.assemblyGroup || '',
            assemblyPartNumber: item.assemblyPartNumber || '',
            assemblySerialNumber: item.assemblySerialNumber || '',
            currentHours: item.currentHours || 0,
            lifeLimit: item.lifeLimit || 0
        });
        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const result = await parseWarehouseExcel(file);
            setExcelRows(result.rows);
            setExcelSkipped(result.skipped);
            setShowExcelModal(true);
        } catch (err: any) {
            showError(`Excel okunamadı: ${err.message}`);
        }
        // input'u sıfırla (aynı dosya tekrar seçilebilsin)
        if (excelInputRef.current) excelInputRef.current.value = '';
    };

    const handleExcelImport = async () => {
        if (!excelRows || !user) return;
        setExcelImporting(true);
        try {
            const items = excelRows.map(row => ({
                partNumber: row.parcaNumarasi,
                serialNumber: row.parcaSeriNumarasi,
                description: row.parcaIsmi,
                location: row.location,
                assemblyGroup: row.altAssyIsmi,
                assemblyPartNumber: row.altAssyPartNumber,
                assemblySerialNumber: row.altAssySerialNumber,
                currentHours: row.currentHours,
                lifeLimit: row.lifeLimit,
                userName: user.fullName,
                quantity: 1,
            }));
            const result = await inventoryApi.bulkCreate(items as any, user.fullName);
            showSuccess(`${result.addedCount} parça eklendi${result.skippedCount > 0 ? `, ${result.skippedCount} parça atlandı` : ''}`);
            setShowExcelModal(false);
            setExcelRows(null);
            setExcelSkipped([]);
            refetch();
        } catch (err: any) {
            showError('İçe aktarma sırasında hata oluştu');
        } finally {
            setExcelImporting(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingItem(null);
        setNewItem({ partNumber: '', serialNumber: '', description: '', location: '', assemblyGroup: '', assemblyPartNumber: '', assemblySerialNumber: '', currentHours: 0, lifeLimit: 0 });
    };
    
    const handleDelete = async (id: number) => {
        setDeleteConfirm({ isOpen: true, id });
    };
    
    const confirmDelete = async () => {
        if (deleteConfirm.id) {
            try {
                await inventoryApi.delete(deleteConfirm.id);
                showSuccess('Parça başarıyla silindi!');
                refetch();
            } catch (error) {
                showError('Parça silinirken hata oluştu');
            }
        }
        setDeleteConfirm({ isOpen: false, id: null });
    };

    if (!inventory) return <LoadingSpinner text="Depo yükleniyor..." />;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Depo Yönetimi</h1>
                    <p className="text-brand-light mt-1">Motor üzerinde bulunmayan tüm parçaları yönetin ve takip edin. Her parçanın benzersiz seri numarası vardır.</p>
                </div>
                {canModify && (
                    <div className="flex gap-2">
                        <button
                            onClick={downloadWarehouseTemplate}
                            className="flex items-center gap-2 bg-brand-dark hover:bg-gray-700 text-brand-light hover:text-white text-sm font-medium py-2 px-4 rounded-md border border-brand-border transition-colors"
                        >
                            ⬇ Şablon İndir
                        </button>
                        <button
                            onClick={() => excelInputRef.current?.click()}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold py-2 px-4 rounded-md transition-colors"
                        >
                            📥 Excel ile Toplu Ekle
                        </button>
                        <input
                            ref={excelInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={handleExcelFile}
                        />
                    </div>
                )}
            </div>
            
            {canModify && (
                <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-white">
                            {editingItem ? 'Parça Düzenle' : 'Yeni Parça Ekle'}
                        </h2>
                        {editingItem && (
                            <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="text-brand-light hover:text-white transition-colors text-sm"
                            >
                                ✕ İptal
                            </button>
                        )}
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Parça Bilgileri */}
                        <div>
                            <h3 className="text-sm font-semibold text-brand-light mb-3">Parça Bilgileri</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <input 
                                    name="description" 
                                    value={newItem.description} 
                                    onChange={handleInputChange} 
                                    placeholder="Açıklama (örn: Ateşleme Bujisi)" 
                                    className="bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                                    required 
                                />
                                <input 
                                    name="partNumber" 
                                    value={newItem.partNumber} 
                                    onChange={handleInputChange} 
                                    placeholder="Parça Numarası" 
                                    className="bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                                    required 
                                />
                                <input 
                                    name="serialNumber" 
                                    value={newItem.serialNumber} 
                                    onChange={handleInputChange} 
                                    placeholder="Seri Numarası" 
                                    className="bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                                    required 
                                />
                                <input 
                                    name="location" 
                                    value={newItem.location} 
                                    onChange={handleInputChange} 
                                    placeholder="Konum (örn: Raf A-12)" 
                                    className="bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                                    required 
                                />
                            </div>
                        </div>

                        {/* Alt Montaj Grubu Bilgileri (Opsiyonel) */}
                        <div className="border-t border-brand-border pt-4">
                            <h3 className="text-sm font-semibold text-brand-light mb-3">
                                Alt Montaj Grubu Bilgileri (Opsiyonel)
                                {existingAssemblyGroups.length > 0 && (
                                    <span className="ml-2 text-xs text-blue-400">
                                        Mevcut grubu seçerseniz bilgiler otomatik dolar
                                    </span>
                                )}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <input 
                                        name="assemblyGroup" 
                                        value={newItem.assemblyGroup} 
                                        onChange={handleInputChange}
                                        list="assembly-groups-list" 
                                        placeholder="Alt Montaj Grubu Adı" 
                                        className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                                    />
                                    <datalist id="assembly-groups-list">
                                        {existingAssemblyGroups.map((group, idx) => (
                                            <option key={`assy-${idx}`} value={group.name} />
                                        ))}
                                    </datalist>
                                </div>
                                <input 
                                    name="assemblyPartNumber" 
                                    value={newItem.assemblyPartNumber} 
                                    onChange={handleInputChange} 
                                    placeholder="Alt Montaj Parça No" 
                                    className="bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                                />
                                <input 
                                    name="assemblySerialNumber" 
                                    value={newItem.assemblySerialNumber} 
                                    onChange={handleInputChange} 
                                    placeholder="Alt Montaj Seri No" 
                                    className="bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                                />
                            </div>
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-4">
                            <p className="text-sm font-semibold text-blue-400 mb-3">⏱️ Çalışma Saatleri (Opsiyonel)</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-brand-light mb-1">Mevcut Çalışma Saati</label>
                                    <input 
                                        type="number"
                                        step="0.1"
                                        name="currentHours" 
                                        value={newItem.currentHours} 
                                        onChange={handleInputChange} 
                                        placeholder="0" 
                                        className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                                    />
                                    <p className="text-xs text-brand-light mt-1">Motordan sökülen parça için otomatik dolar</p>
                                </div>
                                <div>
                                    <label className="block text-xs text-brand-light mb-1">Life Limit (Ömür Limiti)</label>
                                    <input 
                                        type="number"
                                        step="0.1"
                                        name="lifeLimit" 
                                        value={newItem.lifeLimit} 
                                        onChange={handleInputChange} 
                                        placeholder="0" 
                                        className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                                    />
                                    <p className="text-xs text-brand-light mt-1">Parçanın maksimum çalışma saati</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button 
                                type="submit" 
                                className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-md transition-colors"
                            >
                                {editingItem ? 'Değişiklikleri Kaydet' : 'Parça Ekle'}
                            </button>
                            {editingItem && (
                                <button 
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="bg-brand-dark hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-md transition-colors border border-brand-border"
                                >
                                    İptal
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-brand-card rounded-lg border border-brand-border">
                <div className="p-4 border-b border-brand-border">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-white">Mevcut Envanter</h2>
                        <span className="text-brand-light text-sm">
                            {filteredInventory.length} parça {searchTerm && `(toplam ${inventory?.length || 0} içinden)`}
                        </span>
                    </div>
                    <SearchFilter
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        placeholder="Açıklama, parça numarası, seri numarası veya konuma göre ara..."
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-brand-border bg-brand-dark">
                            <tr>
                                <th className="p-3 font-semibold">AÇIKLAMA</th>
                                <th className="p-3 font-semibold">PARÇA NO</th>
                                <th className="p-3 font-semibold">SERİ NO</th>
                                <th className="p-3 font-semibold">ÇALIŞMA SAATİ</th>
                                <th className="p-3 font-semibold">KONUM</th>
                                <th className="p-3 font-semibold">EKLENME TARİHİ</th>
                                <th className="p-3 font-semibold">EKLEYEN</th>
                                {canModify && <th className="p-3 font-semibold">İŞLEMLER</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {/* Assembly Groups */}
                            {!searchTerm && Object.entries(groupedInventory.groups).map(([groupName, items]) => {
                                const isExpanded = expandedGroups.has(groupName);
                                const firstItem = items[0]; // Get assembly info from first item
                                return (
                                    <React.Fragment key={`group-${groupName}`}>
                                        {/* Group Header Row */}
                                        <tr className="border-b border-brand-border bg-blue-500/10 hover:bg-blue-500/20 transition-colors cursor-pointer" onClick={() => toggleGroup(groupName)}>
                                            <td className="p-3 font-bold flex items-center">
                                                <button className="mr-2 text-brand-primary">
                                                    {isExpanded ? <CircleMinusIcon /> : <CirclePlusIcon />}
                                                </button>
                                                📦 {groupName}
                                                <span className="ml-2 text-xs text-brand-light">({(items as InventoryItem[]).length} parça)</span>
                                            </td>
                                            <td className="p-3 text-brand-light">
                                                {firstItem.assemblyPartNumber || '-'}
                                            </td>
                                            <td className="p-3 font-mono text-blue-400">
                                                {firstItem.assemblySerialNumber || '-'}
                                            </td>
                                            <td className="p-3 text-brand-light" colSpan={canModify ? 4 : 3}>Alt Montaj Grubu</td>
                                        </tr>
                                        {/* Group Items */}
                                        {isExpanded && (items as InventoryItem[]).map(item => (
                                            <tr key={item.id} className="border-b border-brand-border hover:bg-brand-dark transition-colors">
                                                <td className="p-3 pl-12 font-medium">{item.description}</td>
                                                <td className="p-3 text-brand-light">{item.partNumber}</td>
                                                <td className="p-3 font-mono text-blue-400">{item.serialNumber}</td>
                                                <td className="p-3">
                                                    <span className="text-white font-semibold">{item.currentHours ? `${item.currentHours.toFixed(1)}h` : '0h'}</span>
                                                    {item.lifeLimit > 0 && (
                                                        <span className="text-xs text-brand-light ml-1">/ {item.lifeLimit}h</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-brand-light">{item.location}</td>
                                                <td className="p-3 text-brand-light text-xs">
                                                    {item.createdAt ? formatStoredDate(item.createdAt, 'dd.MM.yyyy HH:mm') : '-'}
                                                </td>
                                                <td className="p-3 text-brand-light">{item.userName}</td>
                                                {canModify && (
                                                    <td className="p-3">
                                                        <div className="flex gap-2">
                                                            <button 
                                                                onClick={() => handleEdit(item)} 
                                                                className="text-brand-primary hover:text-blue-400 transition-colors"
                                                                title="Düzenle"
                                                            >
                                                                <PencilIcon />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDelete(item.id!)} 
                                                                className="text-brand-danger hover:text-red-400 transition-colors"
                                                                title="Sil"
                                                            >
                                                                <TrashIcon />
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                            
                            {/* Ungrouped Items */}
                            {!searchTerm && groupedInventory.ungrouped.map(item => (
                                <tr key={item.id} className="border-b border-brand-border hover:bg-brand-dark transition-colors">
                                    <td className="p-3 font-medium">{item.description}</td>
                                    <td className="p-3 text-brand-light">{item.partNumber}</td>
                                    <td className="p-3 font-mono text-blue-400">{item.serialNumber}</td>
                                    <td className="p-3">
                                        <span className="text-white font-semibold">{item.currentHours ? `${item.currentHours.toFixed(1)}h` : '0h'}</span>
                                        {item.lifeLimit > 0 && (
                                            <span className="text-xs text-brand-light ml-1">/ {item.lifeLimit}h</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-brand-light">{item.location}</td>
                                    <td className="p-3 text-brand-light text-xs">
                                        {item.createdAt ? formatStoredDate(item.createdAt, 'dd.MM.yyyy HH:mm') : '-'}
                                    </td>
                                    <td className="p-3 text-brand-light">{item.userName}</td>
                                    {canModify && (
                                        <td className="p-3">
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleEdit(item)} 
                                                    className="text-brand-primary hover:text-blue-400 transition-colors"
                                                    title="Düzenle"
                                                >
                                                    <PencilIcon />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(item.id!)} 
                                                    className="text-brand-danger hover:text-red-400 transition-colors"
                                                    title="Sil"
                                                >
                                                    <TrashIcon />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}

                            {/* Search Results - Flat View */}
                            {searchTerm && filteredInventory.map(item => (
                                <tr key={item.id} className="border-b border-brand-border hover:bg-brand-dark transition-colors">
                                    <td className="p-3 font-medium">
                                        {item.assemblyGroup && <span className="text-xs text-blue-400 mr-2">📦 {item.assemblyGroup}</span>}
                                        {item.description}
                                    </td>
                                    <td className="p-3 text-brand-light">{item.partNumber}</td>
                                    <td className="p-3 font-mono text-blue-400">{item.serialNumber}</td>
                                    <td className="p-3">
                                        <span className="text-white font-semibold">{item.currentHours ? `${item.currentHours.toFixed(1)}h` : '0h'}</span>
                                        {item.lifeLimit > 0 && (
                                            <span className="text-xs text-brand-light ml-1">/ {item.lifeLimit}h</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-brand-light">{item.location}</td>
                                    <td className="p-3 text-brand-light text-xs">
                                        {item.createdAt ? formatStoredDate(item.createdAt, 'dd.MM.yyyy HH:mm') : '-'}
                                    </td>
                                    <td className="p-3 text-brand-light">{item.userName}</td>
                                    {canModify && (
                                        <td className="p-3">
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleEdit(item)} 
                                                    className="text-brand-primary hover:text-blue-400 transition-colors"
                                                    title="Düzenle"
                                                >
                                                    <PencilIcon />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(item.id!)} 
                                                    className="text-brand-danger hover:text-red-400 transition-colors"
                                                    title="Sil"
                                                >
                                                    <TrashIcon />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredInventory.length === 0 && (
                        <div className="p-12 text-center text-brand-light">
                            {searchTerm ? 'Aramanızla eşleşen parça bulunamadı.' : 'Henüz depoda parça bulunmuyor.'}
                        </div>
                    )}
                </div>
            </div>
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                title="Parçayı Sil"
                message="Bu parçayı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
                confirmText="Sil"
                cancelText="İptal"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
                variant="danger"
            />

            {/* Excel Toplu Yükleme Önizleme Modal */}
            {showExcelModal && excelRows && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-brand-card border border-brand-border rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
                        {/* Modal Başlık */}
                        <div className="flex items-center justify-between p-5 border-b border-brand-border">
                            <div>
                                <h2 className="text-xl font-bold text-white">Excel İçe Aktarma Önizlemesi</h2>
                                <p className="text-sm text-brand-light mt-1">
                                    <span className="text-green-400 font-semibold">{excelRows.length} parça</span> eklenecek
                                    {excelSkipped.length > 0 && (
                                        <span className="ml-3 text-yellow-400 font-semibold">{excelSkipped.length} satır atlanacak</span>
                                    )}
                                </p>
                            </div>
                            <button
                                onClick={() => { setShowExcelModal(false); setExcelRows(null); setExcelSkipped([]); }}
                                className="text-brand-light hover:text-white text-2xl leading-none transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Atlanan satırlar uyarısı */}
                        {excelSkipped.length > 0 && (
                            <div className="mx-5 mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3">
                                <p className="text-yellow-400 text-sm font-semibold mb-1">⚠ Atlanan Satırlar ({excelSkipped.length})</p>
                                <div className="space-y-0.5 max-h-24 overflow-y-auto">
                                    {excelSkipped.map((s, i) => (
                                        <p key={i} className="text-xs text-yellow-300">Satır {s.rowIndex}: {s.reason}</p>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tablo */}
                        <div className="flex-1 overflow-auto p-5">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-brand-light border-b border-brand-border">
                                        <th className="pb-2 pr-3">Parça İsmi</th>
                                        <th className="pb-2 pr-3">P/N</th>
                                        <th className="pb-2 pr-3">S/N</th>
                                        <th className="pb-2 pr-3">Alt Montaj</th>
                                        <th className="pb-2 pr-3">Çalışma Saati</th>
                                        <th className="pb-2 pr-3">Ömür Limiti</th>
                                        <th className="pb-2">Konum</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {excelRows.map((row, i) => (
                                        <tr key={i} className="border-b border-brand-border/50 hover:bg-brand-dark transition-colors">
                                            <td className="py-1.5 pr-3 text-white">{row.parcaIsmi}</td>
                                            <td className="py-1.5 pr-3 font-mono text-xs text-brand-light">{row.parcaNumarasi}</td>
                                            <td className="py-1.5 pr-3 font-mono text-xs text-brand-light">{row.parcaSeriNumarasi}</td>
                                            <td className="py-1.5 pr-3 text-xs text-brand-light">
                                                {row.altAssyIsmi
                                                    ? <span>{row.altAssyIsmi}<br /><span className="font-mono">{row.altAssySerialNumber}</span></span>
                                                    : <span className="text-brand-border">—</span>
                                                }
                                            </td>
                                            <td className="py-1.5 pr-3 text-center">{row.currentHours}h</td>
                                            <td className="py-1.5 pr-3 text-center">{row.lifeLimit}h</td>
                                            <td className="py-1.5 text-xs text-brand-light">{row.location}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Aksiyon Butonları */}
                        <div className="flex justify-end gap-3 p-5 border-t border-brand-border">
                            <button
                                onClick={() => { setShowExcelModal(false); setExcelRows(null); setExcelSkipped([]); }}
                                className="bg-brand-dark hover:bg-gray-700 text-white font-medium py-2 px-5 rounded-md border border-brand-border transition-colors"
                                disabled={excelImporting}
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleExcelImport}
                                disabled={excelImporting}
                                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-md transition-colors flex items-center gap-2"
                            >
                                {excelImporting ? '⏳ Ekleniyor...' : `✓ ${excelRows.length} Parçayı Ekle`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Warehouse;
