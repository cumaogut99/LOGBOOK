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
        quantity: 1,
        location: ''
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });

    const canModify = user?.role === 'Administrator' || user?.role === 'Planning Engineer';

    // Filtered inventory based on search
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
        setNewItem(prev => ({ ...prev, [name]: name === 'quantity' ? parseInt(value) : value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        try {
            await inventoryApi.create({ ...newItem, userName: user.fullName });
            setNewItem({ partNumber: '', serialNumber: '', description: '', quantity: 1, location: '' });
            showSuccess('Inventory item added successfully!');
            refetch();
        } catch (error) {
            showError('Failed to add inventory item');
        }
    };
    
    const handleDelete = async (id: number) => {
        setDeleteConfirm({ isOpen: true, id });
    };
    
    const confirmDelete = async () => {
        if (deleteConfirm.id) {
            try {
                await inventoryApi.delete(deleteConfirm.id);
                showSuccess('Item deleted successfully!');
                refetch();
            } catch (error) {
                showError('Failed to delete item');
            }
        }
        setDeleteConfirm({ isOpen: false, id: null });
    };

    if (!inventory) return <LoadingSpinner text="Loading inventory..." />;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Warehouse</h1>
            <p className="text-brand-light">Manage and monitor all components not currently installed on an engine.</p>
            
            {canModify && (
                <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
                    <h2 className="text-lg font-bold text-white mb-4">Add New Inventory Item</h2>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input name="description" value={newItem.description} onChange={handleInputChange} placeholder="Description (e.g., Igniter Plug)" className="bg-brand-dark border border-brand-border rounded-md p-2" required />
                        <input name="partNumber" value={newItem.partNumber} onChange={handleInputChange} placeholder="Part Number" className="bg-brand-dark border border-brand-border rounded-md p-2" required />
                        <input name="serialNumber" value={newItem.serialNumber} onChange={handleInputChange} placeholder="Serial Number" className="bg-brand-dark border border-brand-border rounded-md p-2" required />
                        <input name="quantity" type="number" value={newItem.quantity} onChange={handleInputChange} placeholder="Quantity" className="bg-brand-dark border border-brand-border rounded-md p-2" required />
                        <input name="location" value={newItem.location} onChange={handleInputChange} placeholder="Location (e.g., Bin A-12)" className="bg-brand-dark border border-brand-border rounded-md p-2" required />
                        <button type="submit" className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">Add Item</button>
                    </form>
                </div>
            )}

            <div className="bg-brand-card rounded-lg border border-brand-border">
                <div className="p-4 border-b border-brand-border">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-white">Current Inventory</h2>
                        <span className="text-brand-light text-sm">{filteredInventory.length} items</span>
                    </div>
                    <SearchFilter
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        placeholder="Search by description, part number, serial, or location..."
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-brand-border bg-brand-dark">
                            <tr>
                                <th className="p-3 font-semibold">DESCRIPTION</th>
                                <th className="p-3 font-semibold">PART NUMBER</th>
                                <th className="p-3 font-semibold">SERIAL NUMBER</th>
                                <th className="p-3 font-semibold">QUANTITY</th>
                                <th className="p-3 font-semibold">LOCATION</th>
                                <th className="p-3 font-semibold">ADDED BY</th>
                                {canModify && <th className="p-3 font-semibold">ACTIONS</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInventory.map(item => (
                                <tr key={item.id} className="border-b border-brand-border hover:bg-brand-dark">
                                    <td className="p-3">{item.description}</td>
                                    <td className="p-3">{item.partNumber}</td>
                                    <td className="p-3">{item.serialNumber}</td>
                                    <td className="p-3">{item.quantity}</td>
                                    <td className="p-3">{item.location}</td>
                                    <td className="p-3 text-brand-light">{item.userName}</td>
                                    {canModify && (
                                        <td className="p-3">
                                            <button onClick={() => handleDelete(item.id!)} className="text-brand-danger hover:text-red-400">
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
                            {searchTerm ? 'No items match your search.' : 'No inventory items yet.'}
                        </div>
                    )}
                </div>
            </div>
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                title="Delete Inventory Item"
                message="Are you sure you want to delete this item? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
                variant="danger"
            />
        </div>
    );
};

export default Warehouse;
