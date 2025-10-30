import React, { useState } from 'react';
import { useQuery, useRefetch } from '../hooks/useData';
import { swapsApi, enginesApi, inventoryApi } from '../lib/client.ts';
import { useAuth } from '../hooks/useAuth';
import type { SwapActivity } from '../types';
import { PencilIcon, TrashIcon } from '../constants';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { showSuccess, showError } from '../utils/toast';

const Assembler: React.FC = () => {
    const { user } = useAuth();
    const { refreshKey, refetch } = useRefetch();
    const swaps = useQuery(() => swapsApi.getAll(), [refreshKey]);
    const engines = useQuery(() => enginesApi.getAll(), []);
    const inventory = useQuery(() => inventoryApi.getAll(), []);

    const [selectedEngine, setSelectedEngine] = useState<number | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });

    const canModify = user?.role === 'Administrator' || user?.role === 'Assembly Engineer';
    const canSwap = canModify || user?.role === 'Assembly Operator';

    // Simplified form state for swapping
    const [swapState, setSwapState] = useState({
        engineId: '',
        removeId: '',
        installId: ''
    });

    const handleSwap = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !swapState.engineId || !swapState.installId || !swapState.removeId) return;
        
        try {
            await swapsApi.create({
                engineId: parseInt(swapState.engineId),
                componentInstalledId: parseInt(swapState.installId),
                componentRemovedId: parseInt(swapState.removeId),
                swapDate: new Date().toLocaleDateString(),
                userName: user.fullName
            });
            
            setSwapState({ engineId: '', removeId: '', installId: '' });
            showSuccess('Component swap completed successfully!');
            refetch();
        } catch (error) {
            showError('Failed to perform component swap');
        }
    };

    const handleDelete = async (id: number) => {
        setDeleteConfirm({ isOpen: true, id });
    };
    
    const confirmDelete = async () => {
        if (deleteConfirm.id) {
            try {
                await swapsApi.delete(deleteConfirm.id);
                showSuccess('Swap record deleted successfully!');
                refetch();
            } catch (error) {
                showError('Failed to delete swap record');
            }
        }
        setDeleteConfirm({ isOpen: false, id: null });
    };

    const getComponentDescription = (id: number) => {
        const item = inventory?.find(i => i.id === id);
        return item ? `${item.description} (SN: ${item.serialNumber})` : 'N/A';
    };

    if (!swaps || !engines || !inventory) return <LoadingSpinner text="Loading assembler..." />;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Component Assembler</h1>
            <p className="text-brand-light">Install or remove components from engines.</p>

            {canSwap && (
                <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
                    <h2 className="text-lg font-bold text-white mb-4">Component Swap Utility</h2>
                    <form onSubmit={handleSwap} className="space-y-4">
                        <select
                            value={swapState.engineId}
                            onChange={(e) => setSwapState({...swapState, engineId: e.target.value})}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2" required
                        >
                            <option value="">1. Select Engine</option>
                            {engines?.map(e => <option key={e.id} value={e.id}>{e.serialNumber}</option>)}
                        </select>
                         <select
                            value={swapState.removeId}
                            onChange={(e) => setSwapState({...swapState, removeId: e.target.value})}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2" required
                        >
                             <option value="">2. Select Component to REMOVE</option>
                             {/* In a real app, this would be populated from the selected engine's BOM */}
                             {inventory?.slice(0, 5).map(i => <option key={i.id} value={i.id}>{`${i.description} (SN: ${i.serialNumber})`}</option>)}
                        </select>
                         <select
                             value={swapState.installId}
                            onChange={(e) => setSwapState({...swapState, installId: e.target.value})}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2" required
                        >
                            <option value="">3. Select Component to INSTALL (from Warehouse)</option>
                             {inventory?.map(i => <option key={i.id} value={i.id}>{`${i.description} (SN: ${i.serialNumber})`}</option>)}
                        </select>
                        <button type="submit" className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">
                            Perform Swap
                        </button>
                    </form>
                </div>
            )}

            <div className="bg-brand-card rounded-lg border border-brand-border">
                <h2 className="text-lg font-bold text-white p-4 border-b border-brand-border">Recent Swap Activities</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-brand-border bg-brand-dark">
                            <tr>
                                <th className="p-3 font-semibold">DATE</th>
                                <th className="p-3 font-semibold">ENGINE</th>
                                <th className="p-3 font-semibold">COMPONENT INSTALLED</th>
                                <th className="p-3 font-semibold">COMPONENT REMOVED</th>
                                <th className="p-3 font-semibold">PERFORMED BY</th>
                                {canModify && <th className="p-3 font-semibold">ACTIONS</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {swaps?.map(swap => (
                                <tr key={swap.id} className="border-b border-brand-border hover:bg-brand-dark">
                                    <td className="p-3">{swap.swapDate}</td>
                                    <td className="p-3">{engines?.find(e => e.id === swap.engineId)?.serialNumber}</td>
                                    <td className="p-3 text-green-400">{getComponentDescription(swap.componentInstalledId)}</td>
                                    <td className="p-3 text-red-400">{getComponentDescription(swap.componentRemovedId)}</td>
                                    <td className="p-3 text-brand-light">{swap.userName}</td>
                                    {canModify && (
                                        <td className="p-3 flex space-x-4">
                                            {/* Edit modal would go here */}
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
                            No swap activities recorded yet.
                        </div>
                    )}
                </div>
            </div>
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                title="Delete Swap Record"
                message="Are you sure you want to delete this swap record? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
                variant="danger"
            />
        </div>
    );
};

export default Assembler;
