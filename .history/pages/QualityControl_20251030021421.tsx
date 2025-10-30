import React, { useState, useMemo } from 'react';
import { useQuery, useRefetch } from '../hooks/useData';
import { testsApi, faultsApi, enginesApi } from '../lib/client.ts';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SearchFilter } from '../components/SearchFilter';
import { showSuccess, showError } from '../utils/toast';
import type { Test, Fault } from '../types';

const QualityControl: React.FC = () => {
    const { user } = useAuth();
    const { refreshKey, refetch } = useRefetch();
    const tests = useQuery(() => testsApi.getAll(), [refreshKey]);
    const faults = useQuery(() => faultsApi.getAll(), [refreshKey]);
    const engines = useQuery(() => enginesApi.getAll(), []);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTab, setSelectedTab] = useState<'tests' | 'faults'>('tests');
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

    const canApprove = user?.role === 'Administrator' || user?.role === 'Quality Control Engineer';

    // Pending items (not yet approved/closed)
    const pendingTests = useMemo(() => {
        if (!tests) return [];
        // Assuming tests without a specific "approved" field are pending
        return tests.filter(t => !t.description?.includes('[APPROVED]'));
    }, [tests]);

    const pendingFaults = useMemo(() => {
        if (!faults) return [];
        return faults.filter(f => f.status === 'Open');
    }, [faults]);

    // Filtered items based on search
    const filteredTests = useMemo(() => {
        if (!searchTerm) return pendingTests;
        const term = searchTerm.toLowerCase();
        return pendingTests.filter(t =>
            t.testType.toLowerCase().includes(term) ||
            t.testCell.toLowerCase().includes(term) ||
            t.description?.toLowerCase().includes(term) ||
            engines?.find(e => e.id === t.engineId)?.serialNumber.toLowerCase().includes(term)
        );
    }, [pendingTests, searchTerm, engines]);

    const filteredFaults = useMemo(() => {
        if (!searchTerm) return pendingFaults;
        const term = searchTerm.toLowerCase();
        return pendingFaults.filter(f =>
            f.description.toLowerCase().includes(term) ||
            f.severity.toLowerCase().includes(term) ||
            engines?.find(e => e.id === f.engineId)?.serialNumber.toLowerCase().includes(term)
        );
    }, [pendingFaults, searchTerm, engines]);

    const handleSelectItem = (id: number) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedItems(newSelected);
    };

    const handleSelectAll = () => {
        const items = selectedTab === 'tests' ? filteredTests : filteredFaults;
        if (selectedItems.size === items.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(items.map(item => item.id!)));
        }
    };

    const handleApproveTests = async () => {
        if (selectedItems.size === 0) {
            showError('Please select at least one test to approve');
            return;
        }

        try {
            const promises = Array.from(selectedItems).map(async (id) => {
                const test = tests?.find(t => t.id === id);
                if (test && test.id) {
                    const updateData: Partial<Test> = {
                        description: `${test.description || ''} [APPROVED by ${user?.fullName}]`
                    };
                    await testsApi.update(test.id, updateData);
                }
            });

            await Promise.all(promises);
            showSuccess(`${selectedItems.size} test(s) approved successfully!`);
            setSelectedItems(new Set());
            refetch();
        } catch (error) {
            showError('Failed to approve tests');
        }
    };

    const handleCloseFaults = async () => {
        if (selectedItems.size === 0) {
            showError('Please select at least one fault to close');
            return;
        }

        try {
            const promises = Array.from(selectedItems).map(async (id) => {
                const fault = faults?.find(f => f.id === id);
                if (fault && fault.id) {
                    const updateData: Partial<Fault> = {
                        status: 'Closed',
                        description: `${fault.description} [CLOSED by ${user?.fullName}]`
                    };
                    await faultsApi.update(fault.id, updateData);
                }
            });

            await Promise.all(promises);
            showSuccess(`${selectedItems.size} fault(s) closed successfully!`);
            setSelectedItems(new Set());
            refetch();
        } catch (error) {
            showError('Failed to close faults');
        }
    };

    const getEngineSerial = (engineId: number) => {
        return engines?.find(e => e.id === engineId)?.serialNumber || 'N/A';
    };

    if (!tests || !faults || !engines) return <LoadingSpinner text="Loading quality control..." />;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Quality Control</h1>
                <p className="text-brand-light">Review and approve maintenance activities</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
                    <p className="text-sm text-brand-light">Pending Tests</p>
                    <p className="text-4xl font-bold text-blue-400">{pendingTests.length}</p>
                </div>
                <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
                    <p className="text-sm text-brand-light">Open Faults</p>
                    <p className="text-4xl font-bold text-red-400">{pendingFaults.length}</p>
                </div>
                <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
                    <p className="text-sm text-brand-light">Selected Items</p>
                    <p className="text-4xl font-bold text-brand-primary">{selectedItems.size}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-brand-card rounded-lg border border-brand-border">
                <div className="border-b border-brand-border">
                    <div className="flex">
                        <button
                            onClick={() => {
                                setSelectedTab('tests');
                                setSelectedItems(new Set());
                            }}
                            className={`px-6 py-4 font-semibold transition-colors ${
                                selectedTab === 'tests'
                                    ? 'text-brand-primary border-b-2 border-brand-primary'
                                    : 'text-brand-light hover:text-white'
                            }`}
                        >
                            Pending Tests ({pendingTests.length})
                        </button>
                        <button
                            onClick={() => {
                                setSelectedTab('faults');
                                setSelectedItems(new Set());
                            }}
                            className={`px-6 py-4 font-semibold transition-colors ${
                                selectedTab === 'faults'
                                    ? 'text-brand-primary border-b-2 border-brand-primary'
                                    : 'text-brand-light hover:text-white'
                            }`}
                        >
                            Open Faults ({pendingFaults.length})
                        </button>
                    </div>
                </div>

                {/* Search and Actions */}
                <div className="p-4 border-b border-brand-border space-y-4">
                    <SearchFilter
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        placeholder={`Search ${selectedTab}...`}
                    />
                    
                    {canApprove && (
                        <div className="flex justify-between items-center">
                            <button
                                onClick={handleSelectAll}
                                className="text-brand-primary hover:text-brand-primary-dark text-sm font-medium"
                            >
                                {selectedItems.size === (selectedTab === 'tests' ? filteredTests : filteredFaults).length
                                    ? 'Deselect All'
                                    : 'Select All'}
                            </button>
                            
                            {selectedItems.size > 0 && (
                                <button
                                    onClick={selectedTab === 'tests' ? handleApproveTests : handleCloseFaults}
                                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    {selectedTab === 'tests' 
                                        ? `Approve ${selectedItems.size} Test(s)` 
                                        : `Close ${selectedItems.size} Fault(s)`}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="overflow-x-auto">
                    {selectedTab === 'tests' ? (
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-brand-border bg-brand-dark">
                                <tr>
                                    {canApprove && <th className="p-3 w-12"></th>}
                                    <th className="p-3 font-semibold">DATE</th>
                                    <th className="p-3 font-semibold">ENGINE</th>
                                    <th className="p-3 font-semibold">TEST TYPE</th>
                                    <th className="p-3 font-semibold">TEST CELL</th>
                                    <th className="p-3 font-semibold">DURATION</th>
                                    <th className="p-3 font-semibold">OPERATOR</th>
                                    <th className="p-3 font-semibold">DESCRIPTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTests.map(test => (
                                    <tr key={test.id} className="border-b border-brand-border hover:bg-brand-dark">
                                        {canApprove && (
                                            <td className="p-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.has(test.id!)}
                                                    onChange={() => handleSelectItem(test.id!)}
                                                    className="w-4 h-4 text-brand-primary bg-brand-dark border-brand-border rounded focus:ring-brand-primary"
                                                />
                                            </td>
                                        )}
                                        <td className="p-3">{test.testDate}</td>
                                        <td className="p-3 font-semibold">{getEngineSerial(test.engineId)}</td>
                                        <td className="p-3">{test.testType}</td>
                                        <td className="p-3">{test.testCell}</td>
                                        <td className="p-3">{test.duration.toFixed(1)} hrs</td>
                                        <td className="p-3 text-brand-light">{test.userName}</td>
                                        <td className="p-3 text-sm">{test.description || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-brand-border bg-brand-dark">
                                <tr>
                                    {canApprove && <th className="p-3 w-12"></th>}
                                    <th className="p-3 font-semibold">DATE</th>
                                    <th className="p-3 font-semibold">ENGINE</th>
                                    <th className="p-3 font-semibold">SEVERITY</th>
                                    <th className="p-3 font-semibold">DESCRIPTION</th>
                                    <th className="p-3 font-semibold">REPORTED BY</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredFaults.map(fault => (
                                    <tr key={fault.id} className="border-b border-brand-border hover:bg-brand-dark">
                                        {canApprove && (
                                            <td className="p-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.has(fault.id!)}
                                                    onChange={() => handleSelectItem(fault.id!)}
                                                    className="w-4 h-4 text-brand-primary bg-brand-dark border-brand-border rounded focus:ring-brand-primary"
                                                />
                                            </td>
                                        )}
                                        <td className="p-3">{fault.reportDate}</td>
                                        <td className="p-3 font-semibold">{getEngineSerial(fault.engineId)}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded-full text-xs ${
                                                fault.severity === 'Critical' ? 'bg-red-500/20 text-red-400' :
                                                fault.severity === 'Major' ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-blue-400/20 text-blue-400'
                                            }`}>
                                                {fault.severity}
                                            </span>
                                        </td>
                                        <td className="p-3">{fault.description}</td>
                                        <td className="p-3 text-brand-light">{fault.userName}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    
                    {(selectedTab === 'tests' ? filteredTests : filteredFaults).length === 0 && (
                        <div className="p-12 text-center text-brand-light">
                            {searchTerm 
                                ? `No ${selectedTab} match your search.` 
                                : `No pending ${selectedTab} to review.`}
                        </div>
                    )}
                </div>
            </div>

            {!canApprove && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                    <p className="text-yellow-400 text-sm">
                        ⚠️ You don't have permission to approve or close items. Contact an administrator for access.
                    </p>
                </div>
            )}
        </div>
    );
};

export default QualityControl;

