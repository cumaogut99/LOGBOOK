import React, { useState } from 'react';
import { useQuery, useRefetch } from '../hooks/useData';
import { faultsApi, enginesApi } from '../lib/client.ts';
import { useAuth } from '../hooks/useAuth';
import { Fault, Severity } from '../types';
import { PencilIcon, TrashIcon, PaperclipIcon } from '../constants';
import Modal from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { showSuccess, showError } from '../utils/toast';

const Faults: React.FC = () => {
    const { user } = useAuth();
    const { refreshKey, refetch } = useRefetch();
    const faults = useQuery(() => faultsApi.getAll(), [refreshKey]);
    const engines = useQuery(() => enginesApi.getAll(), []);
    
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [editingFault, setEditingFault] = useState<Fault | null>(null);

    const canModify = user?.role === 'Administrator' || user?.role === 'Fault Coordinator';
    const canLog = canModify || user?.role === 'Test Engineer';

    const [newFault, setNewFault] = useState<Omit<Fault, 'id' | 'userName' | 'reportDate' | 'status'>>({
        engineId: 0,
        description: '',
        severity: Severity.Minor,
    });

    const handleLogSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newFault.engineId) return;
        try {
            await faultsApi.create({
                ...newFault,
                engineId: newFault.engineId,
                reportDate: new Date().toLocaleDateString(),
                status: 'Open',
                userName: user.fullName,
            });
            setNewFault({ engineId: 0, description: '', severity: Severity.Minor });
            showSuccess('Fault reported successfully!');
            refetch();
        } catch (error) {
            showError('Failed to report fault');
        }
    };

    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });
    
    const handleDelete = async (id: number) => {
        setDeleteConfirm({ isOpen: true, id });
    };
    
    const confirmDelete = async () => {
        if (deleteConfirm.id) {
            try {
                await faultsApi.delete(deleteConfirm.id);
                showSuccess('Fault deleted successfully!');
                refetch();
            } catch (error) {
                showError('Failed to delete fault');
            }
        }
        setDeleteConfirm({ isOpen: false, id: null });
    };
    
    const handleEdit = (fault: Fault) => {
        setEditingFault(fault);
        setEditModalOpen(true);
    };

    const handleUpdateFault = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingFault) return;
        try {
            await faultsApi.update(editingFault.id!, editingFault);
            showSuccess('Fault updated successfully!');
            setEditModalOpen(false);
            setEditingFault(null);
            refetch();
        } catch (error) {
            showError('Failed to update fault');
        }
    };

    const getSeverityClass = (severity: Severity) => {
        switch (severity) {
            case Severity.Critical: return 'text-red-500 bg-red-500/10';
            case Severity.Major: return 'text-yellow-500 bg-yellow-500/10';
            case Severity.Minor: return 'text-blue-400 bg-blue-400/10';
            default: return 'text-gray-400';
        }
    };

    if (!faults || !engines) return <LoadingSpinner text="Loading faults..." />;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Report a Fault</h1>
            <p className="text-brand-light">Document faults for any engine or component.</p>
            
            {canLog && (
                 <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
                    <h2 className="text-lg font-bold text-white mb-4">Report a New Fault</h2>
                    <form onSubmit={handleLogSubmit} className="space-y-4">
                        <select
                            value={newFault.engineId}
                            onChange={(e) => setNewFault(prev => ({ ...prev, engineId: parseInt(e.target.value) }))}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2" required
                        >
                            <option value={0}>-- Select an Engine --</option>
                            {engines?.map(e => <option key={e.id} value={e.id}>{e.serialNumber}</option>)}
                        </select>
                        <textarea
                            value={newFault.description}
                            onChange={(e) => setNewFault(prev => ({...prev, description: e.target.value}))}
                            placeholder="Fault Description (e.g., Observed oil leak from turbine bearing #2)"
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2" rows={4} required
                        ></textarea>
                         <select
                            value={newFault.severity}
                            onChange={(e) => setNewFault(prev => ({...prev, severity: e.target.value as Severity}))}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2"
                        >
                            <option value={Severity.Minor}>Minor</option>
                            <option value={Severity.Major}>Major</option>
                            <option value={Severity.Critical}>Critical</option>
                        </select>
                        <button type="submit" className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">Log Fault</button>
                    </form>
                </div>
            )}
            
            <div className="bg-brand-card rounded-lg border border-brand-border">
                <h2 className="text-lg font-bold text-white p-4 border-b border-brand-border">Recent Fault Reports</h2>
                <div className="overflow-x-auto">
                     <table className="w-full text-left text-sm">
                        <thead className="border-b border-brand-border bg-brand-dark">
                            <tr>
                                <th className="p-3 font-semibold">DATE</th>
                                <th className="p-3 font-semibold">ENGINE</th>
                                <th className="p-3 font-semibold">DESCRIPTION</th>
                                <th className="p-3 font-semibold">SEVERITY</th>
                                <th className="p-3 font-semibold">STATUS</th>
                                <th className="p-3 font-semibold">LOGGED BY</th>
                                {canModify && <th className="p-3 font-semibold">ACTIONS</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {faults?.map(fault => (
                                <tr key={fault.id} className="border-b border-brand-border hover:bg-brand-dark">
                                    <td className="p-3">{fault.reportDate}</td>
                                    <td className="p-3">{engines?.find(e => e.id === fault.engineId)?.serialNumber}</td>
                                    <td className="p-3">{fault.description}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded-full font-semibold text-xs ${getSeverityClass(fault.severity)}`}>{fault.severity}</span>
                                    </td>
                                    <td className="p-3">{fault.status}</td>
                                    <td className="p-3 text-brand-light">{fault.userName}</td>
                                    {canModify && (
                                        <td className="p-3 flex space-x-4">
                                            <button onClick={() => handleEdit(fault)} className="text-brand-light hover:text-white"><PencilIcon /></button>
                                            <button onClick={() => handleDelete(fault.id!)} className="text-brand-danger hover:text-red-400"><TrashIcon /></button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isEditModalOpen && editingFault && (
                <Modal isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Fault Report">
                    <form onSubmit={handleUpdateFault} className="space-y-4">
                        <textarea 
                            value={editingFault.description} 
                            onChange={(e) => setEditingFault({...editingFault, description: e.target.value})}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2"
                        />
                         <select
                            value={editingFault.severity}
                            onChange={(e) => setEditingFault(prev => ({...prev!, severity: e.target.value as Severity}))}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2"
                        >
                            <option value={Severity.Minor}>Minor</option>
                            <option value={Severity.Major}>Major</option>
                            <option value={Severity.Critical}>Critical</option>
                        </select>
                         <select
                            value={editingFault.status}
                            onChange={(e) => setEditingFault(prev => ({...prev!, status: e.target.value as 'Open' | 'Closed'}))}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2"
                        >
                            <option>Open</option>
                            <option>Closed</option>
                        </select>
                        <button type="submit" className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">Save Changes</button>
                    </form>
                </Modal>
            )}
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                title="Delete Fault"
                message="Are you sure you want to delete this fault report? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
                variant="danger"
            />
        </div>
    );
};

export default Faults;
