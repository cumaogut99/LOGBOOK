import React, { useState, useMemo } from 'react';
import { useQuery, useRefetch } from '../hooks/useData';
import { enginesApi } from '../lib/client.ts';
import { maintenancePlansApi } from '../lib/newApis.ts';
import { useAuth } from '../hooks/useAuth';
import type { MaintenancePlan } from '../types';
import { CheckIcon, XIcon, PlusIcon, SearchIcon } from '../constants';
import Modal from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { showSuccess, showError } from '../utils/toast';

const QualityControl: React.FC = () => {
    const { user } = useAuth();
    const { refreshKey, refetch } = useRefetch();
    const maintenancePlans = useQuery(() => maintenancePlansApi.getAll(), [refreshKey]);
    const engines = useQuery(() => enginesApi.getAll(), []);

    const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'all'>('pending');
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);

    // Role permissions
    const canApprove = user?.role === 'Quality Control Engineer' || user?.role === 'Administrator';
    const canCreate = canApprove;

    // New maintenance plan form
    const [newPlan, setNewPlan] = useState({
        engineId: '',
        planType: 'Routine Inspection',
        description: '',
        scheduledDate: '',
        dueHours: '',
        dueCycles: ''
    });

    // Filter maintenance plans
    const filteredPlans = useMemo(() => {
        if (!maintenancePlans) return [];
        
        let filtered = maintenancePlans;
        
        // Filter by status
        if (activeTab === 'pending') {
            filtered = filtered.filter(p => p.status === 'Pending');
        } else if (activeTab === 'approved') {
            filtered = filtered.filter(p => p.status === 'Approved');
        }
        
        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(p => {
                const engine = engines?.find(e => e.id === p.engineId);
                return (
                    p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    p.planType.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    engine?.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())
                );
            });
        }
        
        return filtered;
    }, [maintenancePlans, activeTab, searchTerm, engines]);

    // KPI calculations
    const kpis = useMemo(() => {
        if (!maintenancePlans) return { total: 0, pending: 0, approved: 0, rejected: 0 };
        
        return {
            total: maintenancePlans.length,
            pending: maintenancePlans.filter(p => p.status === 'Pending').length,
            approved: maintenancePlans.filter(p => p.status === 'Approved').length,
            rejected: maintenancePlans.filter(p => p.status === 'Rejected').length
        };
    }, [maintenancePlans]);

    // Create new maintenance plan
    const handleCreatePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newPlan.engineId || !newPlan.description || !newPlan.scheduledDate) {
            showError('Please fill all required fields');
            return;
        }
        
        try {
            await maintenancePlansApi.create({
                engineId: parseInt(newPlan.engineId),
                planType: newPlan.planType,
                description: newPlan.description,
                scheduledDate: newPlan.scheduledDate,
                dueHours: newPlan.dueHours ? parseFloat(newPlan.dueHours) : undefined,
                dueCycles: newPlan.dueCycles ? parseInt(newPlan.dueCycles) : undefined,
                status: 'Pending',
                createdBy: user.fullName,
                createdAt: new Date().toISOString()
            });
            
            setNewPlan({
                engineId: '',
                planType: 'Routine Inspection',
                description: '',
                scheduledDate: '',
                dueHours: '',
                dueCycles: ''
            });
            setCreateModalOpen(false);
            showSuccess('Maintenance plan created successfully!');
            refetch();
        } catch (error) {
            showError('Failed to create maintenance plan');
            console.error(error);
        }
    };

    // Approve selected maintenance plans
    const handleApprovePlans = async () => {
        if (selectedItems.size === 0) {
            showError('Please select at least one plan to approve');
            return;
        }

        try {
            const promises = Array.from(selectedItems).map(async (id) => {
                await maintenancePlansApi.approve(id, user?.fullName || 'Unknown');
            });

            await Promise.all(promises);
            showSuccess(`${selectedItems.size} maintenance plan(s) approved successfully!`);
            setSelectedItems(new Set());
            refetch();
        } catch (error) {
            showError('Failed to approve maintenance plans');
            console.error(error);
        }
    };

    // Reject selected maintenance plans
    const handleRejectPlans = async () => {
        if (selectedItems.size === 0) {
            showError('Please select at least one plan to reject');
            return;
        }

        try {
            const promises = Array.from(selectedItems).map(async (id) => {
                await maintenancePlansApi.update(id, {
                    status: 'Rejected',
                    approvedBy: user?.fullName,
                    approvedAt: new Date().toISOString()
                });
            });

            await Promise.all(promises);
            showSuccess(`${selectedItems.size} maintenance plan(s) rejected!`);
            setSelectedItems(new Set());
            refetch();
        } catch (error) {
            showError('Failed to reject maintenance plans');
            console.error(error);
        }
    };

    // Toggle selection
    const toggleSelection = (id: number) => {
        const newSelection = new Set(selectedItems);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedItems(newSelection);
    };

    // Select all
    const toggleSelectAll = () => {
        if (selectedItems.size === filteredPlans.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(filteredPlans.map(p => p.id!)));
        }
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            Pending: 'bg-yellow-500/20 text-yellow-400',
            Approved: 'bg-green-500/20 text-green-400',
            Rejected: 'bg-red-500/20 text-red-400',
            Completed: 'bg-blue-500/20 text-blue-400'
        };
        return (
            <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status as keyof typeof styles] || 'bg-gray-500/20 text-gray-400'}`}>
                {status}
            </span>
        );
    };

    if (!maintenancePlans || !engines) return <LoadingSpinner text="Loading quality control..." />;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Quality Control - Maintenance Plans</h1>
                    <p className="text-brand-light">Review and approve maintenance plans for engines.</p>
                </div>
                {canCreate && (
                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md flex items-center space-x-2"
                    >
                        <PlusIcon />
                        <span>Create Maintenance Plan</span>
                    </button>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-brand-card p-4 rounded-lg border border-brand-border">
                    <p className="text-brand-light text-sm">Total Plans</p>
                    <p className="text-3xl font-bold text-white">{kpis.total}</p>
                </div>
                <div className="bg-brand-card p-4 rounded-lg border border-brand-border">
                    <p className="text-brand-light text-sm">Pending Approval</p>
                    <p className="text-3xl font-bold text-yellow-400">{kpis.pending}</p>
                </div>
                <div className="bg-brand-card p-4 rounded-lg border border-brand-border">
                    <p className="text-brand-light text-sm">Approved</p>
                    <p className="text-3xl font-bold text-green-400">{kpis.approved}</p>
                </div>
                <div className="bg-brand-card p-4 rounded-lg border border-brand-border">
                    <p className="text-brand-light text-sm">Rejected</p>
                    <p className="text-3xl font-bold text-red-400">{kpis.rejected}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-2 border-b border-brand-border">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-4 py-2 font-semibold ${activeTab === 'pending' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-brand-light'}`}
                >
                    Pending ({kpis.pending})
                </button>
                <button
                    onClick={() => setActiveTab('approved')}
                    className={`px-4 py-2 font-semibold ${activeTab === 'approved' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-brand-light'}`}
                >
                    Approved ({kpis.approved})
                </button>
                <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-2 font-semibold ${activeTab === 'all' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-brand-light'}`}
                >
                    All ({kpis.total})
                </button>
            </div>

            {/* Search and Actions */}
            <div className="flex justify-between items-center">
                <div className="relative flex-1 max-w-md">
                    <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-light" />
                    <input
                        type="text"
                        placeholder="Search by engine, type, or description..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-brand-dark border border-brand-border rounded-md text-white"
                    />
                </div>
                {canApprove && activeTab === 'pending' && (
                    <div className="flex space-x-2">
                        <button
                            onClick={handleApprovePlans}
                            disabled={selectedItems.size === 0}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md flex items-center space-x-2"
                        >
                            <CheckIcon />
                            <span>Approve ({selectedItems.size})</span>
                        </button>
                        <button
                            onClick={handleRejectPlans}
                            disabled={selectedItems.size === 0}
                            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md flex items-center space-x-2"
                        >
                            <XIcon />
                            <span>Reject ({selectedItems.size})</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Maintenance Plans Table */}
            <div className="bg-brand-card rounded-lg border border-brand-border">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-brand-border bg-brand-dark">
                            <tr>
                                {activeTab === 'pending' && canApprove && (
                                    <th className="p-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedItems.size === filteredPlans.length && filteredPlans.length > 0}
                                            onChange={toggleSelectAll}
                                            className="form-checkbox text-brand-primary"
                                        />
                                    </th>
                                )}
                                <th className="p-3 font-semibold">ENGINE</th>
                                <th className="p-3 font-semibold">PLAN TYPE</th>
                                <th className="p-3 font-semibold">DESCRIPTION</th>
                                <th className="p-3 font-semibold">SCHEDULED DATE</th>
                                <th className="p-3 font-semibold">DUE HOURS</th>
                                <th className="p-3 font-semibold">DUE CYCLES</th>
                                <th className="p-3 font-semibold">STATUS</th>
                                <th className="p-3 font-semibold">CREATED BY</th>
                                <th className="p-3 font-semibold">APPROVED BY</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPlans.map(plan => (
                                <tr key={plan.id} className="border-b border-brand-border hover:bg-brand-dark">
                                    {activeTab === 'pending' && canApprove && (
                                        <td className="p-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedItems.has(plan.id!)}
                                                onChange={() => toggleSelection(plan.id!)}
                                                className="form-checkbox text-brand-primary"
                                            />
                                        </td>
                                    )}
                                    <td className="p-3 font-semibold">
                                        {engines?.find(e => e.id === plan.engineId)?.serialNumber || 'N/A'}
                                    </td>
                                    <td className="p-3">{plan.planType}</td>
                                    <td className="p-3 max-w-xs truncate">{plan.description}</td>
                                    <td className="p-3">{new Date(plan.scheduledDate).toLocaleDateString()}</td>
                                    <td className="p-3">{plan.dueHours ? `${plan.dueHours} hrs` : '-'}</td>
                                    <td className="p-3">{plan.dueCycles ? `${plan.dueCycles} cycles` : '-'}</td>
                                    <td className="p-3">{getStatusBadge(plan.status)}</td>
                                    <td className="p-3 text-brand-light">{plan.createdBy}</td>
                                    <td className="p-3 text-brand-light">{plan.approvedBy || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredPlans.length === 0 && (
                        <div className="p-12 text-center text-brand-light">
                            {searchTerm ? 'No maintenance plans match your search.' : 'No maintenance plans found.'}
                        </div>
                    )}
                </div>
            </div>

            {/* Create Maintenance Plan Modal */}
            {isCreateModalOpen && (
                <Modal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)} title="Create Maintenance Plan">
                    <form onSubmit={handleCreatePlan} className="space-y-4">
                        <select
                            value={newPlan.engineId}
                            onChange={(e) => setNewPlan({...newPlan, engineId: e.target.value})}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            required
                        >
                            <option value="">-- Select Engine --</option>
                            {engines?.map(e => (
                                <option key={e.id} value={e.id}>
                                    {e.serialNumber} - {e.model}
                                </option>
                            ))}
                        </select>

                        <select
                            value={newPlan.planType}
                            onChange={(e) => setNewPlan({...newPlan, planType: e.target.value})}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            required
                        >
                            <option value="Routine Inspection">Routine Inspection</option>
                            <option value="Scheduled Maintenance">Scheduled Maintenance</option>
                            <option value="Overhaul">Overhaul</option>
                            <option value="Component Replacement">Component Replacement</option>
                            <option value="Performance Check">Performance Check</option>
                            <option value="Safety Inspection">Safety Inspection</option>
                            <option value="Other">Other</option>
                        </select>

                        <textarea
                            value={newPlan.description}
                            onChange={(e) => setNewPlan({...newPlan, description: e.target.value})}
                            placeholder="Maintenance Plan Description"
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            rows={4}
                            required
                        />

                        <input
                            type="date"
                            value={newPlan.scheduledDate}
                            onChange={(e) => setNewPlan({...newPlan, scheduledDate: e.target.value})}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            required
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <input
                                type="number"
                                step="0.1"
                                value={newPlan.dueHours}
                                onChange={(e) => setNewPlan({...newPlan, dueHours: e.target.value})}
                                placeholder="Due Hours (Optional)"
                                className="bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            />
                            <input
                                type="number"
                                value={newPlan.dueCycles}
                                onChange={(e) => setNewPlan({...newPlan, dueCycles: e.target.value})}
                                placeholder="Due Cycles (Optional)"
                                className="bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            />
                        </div>

                        <button type="submit" className="w-full bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">
                            Create Maintenance Plan
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default QualityControl;
