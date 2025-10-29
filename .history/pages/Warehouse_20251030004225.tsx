import React, { useState } from 'react';
import { useQuery, useRefetch } from './hooks/useData';
import { inventoryApi } from './api/client';
import { useAuth } from './hooks/useAuth';
import type { InventoryItem } from './types';
import { TrashIcon } from './constants';

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

    const canModify = user?.role === 'Administrator' || user?.role === 'Planning Engineer';

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setNewItem(prev => ({ ...prev, [name]: name === 'quantity' ? parseInt(value) : value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        await inventoryApi.create({ ...newItem, userName: user.fullName });
        // Reset form
        setNewItem({ partNumber: '', serialNumber: '', description: '', quantity: 1, location: '' });
        refetch();
    };
    
    const handleDelete = async (id: number) => {
        if(window.confirm('Are you sure you want to delete this item?')) {
            await inventoryApi.delete(id);
            refetch();
        }
    }

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
                <h2 className="text-lg font-bold text-white p-4 border-b border-brand-border">Current Inventory</h2>
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
                            {inventory?.map(item => (
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
                </div>
            </div>
        </div>
    );
};

export default Warehouse;
