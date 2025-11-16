import React, { useState, useMemo } from 'react';
import { useQuery, useRefetch } from '../hooks/useData';
import { inventoryApi } from '../lib/client.ts';
import { useAuth } from '../hooks/useAuth';
import type { InventoryItem } from '../types';
import { TrashIcon, CirclePlusIcon, CircleMinusIcon, PencilIcon } from '../constants';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SearchFilter } from '../components/SearchFilter';
import { showSuccess, showError } from '../utils/toast';
import { format } from 'date-fns';

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
        assemblySerialNumber: ''
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

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
                console.log('Updating inventory item:', editingItem.id, itemData);
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
                console.log('Sending inventory data:', itemData);
                await inventoryApi.create(itemData);
                showSuccess('Parça başarıyla depoya eklendi!');
            }
            setNewItem({ partNumber: '', serialNumber: '', description: '', location: '', assemblyGroup: '', assemblyPartNumber: '', assemblySerialNumber: '' });
            refetch();
        } catch (error) {
            console.error('Inventory create/update error:', error);
            showError(editingItem ? 'Parça güncellenirken hata oluştu' : 'Parça eklenirken hata oluştu');
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
            assemblySerialNumber: item.assemblySerialNumber || ''
        });
        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingItem(null);
        setNewItem({ partNumber: '', serialNumber: '', description: '', location: '', assemblyGroup: '', assemblyPartNumber: '', assemblySerialNumber: '' });
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
            <h1 className="text-3xl font-bold">Depo Yönetimi</h1>
            <p className="text-brand-light">Motor üzerinde bulunmayan tüm parçaları yönetin ve takip edin. Her parçanın benzersiz seri numarası vardır.</p>
            
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
                                                <span className="ml-2 text-xs text-brand-light">({items.length} parça)</span>
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
                                        {isExpanded && items.map(item => (
                                            <tr key={item.id} className="border-b border-brand-border hover:bg-brand-dark transition-colors">
                                                <td className="p-3 pl-12 font-medium">{item.description}</td>
                                                <td className="p-3 text-brand-light">{item.partNumber}</td>
                                                <td className="p-3 font-mono text-blue-400">{item.serialNumber}</td>
                                                <td className="p-3 text-brand-light">{item.location}</td>
                                                <td className="p-3 text-brand-light text-xs">
                                                    {item.createdAt ? format(new Date(item.createdAt), 'dd.MM.yyyy HH:mm') : '-'}
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
                                    <td className="p-3 text-brand-light">{item.location}</td>
                                    <td className="p-3 text-brand-light text-xs">
                                        {item.createdAt ? format(new Date(item.createdAt), 'dd.MM.yyyy HH:mm') : '-'}
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
                                    <td className="p-3 text-brand-light">{item.location}</td>
                                    <td className="p-3 text-brand-light text-xs">
                                        {item.createdAt ? format(new Date(item.createdAt), 'dd.MM.yyyy HH:mm') : '-'}
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
        </div>
    );
};

export default Warehouse;
