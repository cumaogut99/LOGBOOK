import React, { useState, useMemo } from 'react';
import { useQuery, useRefetch } from '../hooks/useData';
import { inventoryApi } from '../lib/client.ts';
import { useAuth } from '../hooks/useAuth';
import type { InventoryItem } from '../types';
import { TrashIcon } from '../constants';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SearchFilter } from '../components/SearchFilter';
import { showSuccess, showError } from '../utils/toast';

const Warehouse: React.FC = () => {
    const { user } = useAuth();
    const { refreshKey, refetch } = useRefetch();
    const inventory = useQuery(() => inventoryApi.getAll(), [refreshKey]);
    
    const [newItem, setNewItem] = useState<Omit<InventoryItem, 'id' | 'userName'>>({
        partNumber: '',
        serialNumber: '',
        description: '',
        location: ''
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });

    const canModify = user?.role === 'Administrator' || user?.role === 'Planning Engineer';

    // Envanter arama filtresi
    const filteredInventory = useMemo(() => {
        if (!inventory) return [];
        if (!searchTerm) return inventory;

        const term = searchTerm.toLowerCase();
        return inventory.filter(item =>
            item.description.toLowerCase().includes(term) ||
            item.partNumber.toLowerCase().includes(term) ||
            item.serialNumber.toLowerCase().includes(term) ||
            item.location.toLowerCase().includes(term)
        );
    }, [inventory, searchTerm]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setNewItem(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        try {
            await inventoryApi.create({ ...newItem, userName: user.fullName });
            setNewItem({ partNumber: '', serialNumber: '', description: '', location: '' });
            showSuccess('Parça başarıyla depoya eklendi!');
            refetch();
        } catch (error) {
            showError('Parça eklenirken hata oluştu');
        }
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
                    <h2 className="text-lg font-bold text-white mb-4">Yeni Parça Ekle</h2>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                        <button 
                            type="submit" 
                            className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md transition-colors"
                        >
                            Parça Ekle
                        </button>
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
                                <th className="p-3 font-semibold">EKLEYEN</th>
                                {canModify && <th className="p-3 font-semibold">İŞLEMLER</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInventory.map(item => (
                                <tr key={item.id} className="border-b border-brand-border hover:bg-brand-dark transition-colors">
                                    <td className="p-3 font-medium">{item.description}</td>
                                    <td className="p-3 text-brand-light">{item.partNumber}</td>
                                    <td className="p-3 font-mono text-blue-400">{item.serialNumber}</td>
                                    <td className="p-3 text-brand-light">{item.location}</td>
                                    <td className="p-3 text-brand-light">{item.userName}</td>
                                    {canModify && (
                                        <td className="p-3">
                                            <button 
                                                onClick={() => handleDelete(item.id!)} 
                                                className="text-brand-danger hover:text-red-400 transition-colors"
                                                title="Sil"
                                            >
                                                <TrashIcon />
                                            </button>
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
