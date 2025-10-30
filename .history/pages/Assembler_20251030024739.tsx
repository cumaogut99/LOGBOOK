import React, { useState } from 'react';
import { useQuery, useRefetch } from '../hooks/useData';
import { swapsApi, enginesApi, inventoryApi } from '../lib/client.ts';
import { documentsApi as newDocsApi } from '../lib/newApis.ts';
import { useAuth } from '../hooks/useAuth';
import type { SwapActivity } from '../types';
import { PencilIcon, TrashIcon, PaperclipIcon } from '../constants';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { showSuccess, showError } from '../utils/toast';

// Assembly groups definition
const ASSEMBLY_GROUPS = [
    'Fuel System',
    'Ignition System',
    'Cooling System',
    'Lubrication System',
    'Exhaust System',
    'Electrical System',
    'Mechanical Assembly',
    'Other'
];

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

    const handleSwap = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !swapState.engineId || !swapState.installId || !swapState.removeId) {
            showError('Please fill all required fields');
            return;
        }
        
        if (swapState.swapType === 'Assembly' && !swapState.assemblyGroup) {
            showError('Please select an assembly group');
            return;
        }
        
        try {
            // Create swap activity
            const createdSwap = await swapsApi.create({
                engineId: parseInt(swapState.engineId),
                componentInstalledId: parseInt(swapState.installId),
                componentRemovedId: parseInt(swapState.removeId),
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
            
            setSwapState({ engineId: '', removeId: '', installId: '', swapType: 'Component', assemblyGroup: '' });
            setUploadedFiles([]);
            showSuccess(`${swapState.swapType} swap completed successfully!`);
            refetch();
        } catch (error) {
            showError('Failed to perform swap');
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
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setUploadedFiles(Array.from(e.target.files));
        }
    };
    
    const handleDownload = async (docId: number) => {
        try {
            const blob = await newDocsApi.download(docId);
            const doc = await documentsApi.getById(docId);
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
            showError('Failed to download document');
        }
    };

    if (!swaps || !engines || !inventory) return <LoadingSpinner text="Loading assembler..." />;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Component Assembler</h1>
            <p className="text-brand-light">Install or remove components and assembly groups from engines.</p>

            {canSwap && (
                <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
                    <h2 className="text-lg font-bold text-white mb-4">Component/Assembly Swap Utility</h2>
                    <form onSubmit={handleSwap} className="space-y-4">
                        {/* Swap Type Selection */}
                        <div>
                            <label className="block text-sm font-medium text-brand-light mb-2">
                                Swap Type
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
                                    <span className="text-white">Single Component</span>
                                </label>
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        value="Assembly"
                                        checked={swapState.swapType === 'Assembly'}
                                        onChange={(e) => setSwapState({...swapState, swapType: e.target.value as 'Assembly'})}
                                        className="form-radio text-brand-primary"
                                    />
                                    <span className="text-white">Full Assembly Group</span>
                                </label>
                            </div>
                        </div>
                        
                        {/* Assembly Group Selection (only for Assembly type) */}
                        {swapState.swapType === 'Assembly' && (
                            <select
                                value={swapState.assemblyGroup}
                                onChange={(e) => setSwapState({...swapState, assemblyGroup: e.target.value})}
                                className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                                required
                            >
                                <option value="">-- Select Assembly Group --</option>
                                {ASSEMBLY_GROUPS.map(group => (
                                    <option key={group} value={group}>{group}</option>
                                ))}
                            </select>
                        )}
                        
                        <select
                            value={swapState.engineId}
                            onChange={(e) => setSwapState({...swapState, engineId: e.target.value})}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            required
                        >
                            <option value="">1. Select Engine</option>
                            {engines?.map(e => <option key={e.id} value={e.id}>{e.serialNumber}</option>)}
                        </select>
                        
                        <select
                            value={swapState.removeId}
                            onChange={(e) => setSwapState({...swapState, removeId: e.target.value})}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            required
                        >
                            <option value="">2. Select {swapState.swapType === 'Assembly' ? 'Assembly' : 'Component'} to REMOVE</option>
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
                            <option value="">3. Select {swapState.swapType === 'Assembly' ? 'Assembly' : 'Component'} to INSTALL (from Warehouse)</option>
                            {inventory?.map(i => (
                                <option key={i.id} value={i.id}>
                                    {`${i.description} (SN: ${i.serialNumber})`}
                                </option>
                            ))}
                        </select>
                        
                        {/* Document Upload */}
                        <div>
                            <label className="block text-sm font-medium text-brand-light mb-2">
                                Attach Documents (Optional)
                            </label>
                            <input 
                                type="file" 
                                multiple 
                                onChange={handleFileChange}
                                className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            />
                            {uploadedFiles.length > 0 && (
                                <p className="text-sm text-brand-light mt-1">
                                    {uploadedFiles.length} file(s) selected
                                </p>
                            )}
                        </div>
                        
                        <button type="submit" className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">
                            Perform {swapState.swapType} Swap
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
                                <th className="p-3 font-semibold">TYPE</th>
                                <th className="p-3 font-semibold">ASSEMBLY GROUP</th>
                                <th className="p-3 font-semibold">INSTALLED</th>
                                <th className="p-3 font-semibold">REMOVED</th>
                                <th className="p-3 font-semibold">PERFORMED BY</th>
                                <th className="p-3 font-semibold">DOCUMENT</th>
                                {canModify && <th className="p-3 font-semibold">ACTIONS</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {swaps?.map(swap => (
                                <tr key={swap.id} className="border-b border-brand-border hover:bg-brand-dark">
                                    <td className="p-3">{new Date(swap.swapDate).toLocaleDateString()}</td>
                                    <td className="p-3">{engines?.find(e => e.id === swap.engineId)?.serialNumber}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                            swap.swapType === 'Assembly' 
                                                ? 'bg-purple-500/20 text-purple-400' 
                                                : 'bg-blue-500/20 text-blue-400'
                                        }`}>
                                            {swap.swapType || 'Component'}
                                        </span>
                                    </td>
                                    <td className="p-3">{swap.assemblyGroup || '-'}</td>
                                    <td className="p-3 text-green-400">{getComponentDescription(swap.componentInstalledId)}</td>
                                    <td className="p-3 text-red-400">{getComponentDescription(swap.componentRemovedId)}</td>
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
