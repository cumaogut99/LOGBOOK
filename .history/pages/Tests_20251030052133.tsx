import React, { useState } from 'react';
import { useQuery, useRefetch } from '../hooks/useData';
import { testsApi, enginesApi, documentsApi } from '../lib/client.ts';
import { testTypesApi, brakeTypesApi, documentsApi as newDocsApi } from '../lib/newApis.ts';
import { useAuth } from '../hooks/useAuth';
import type { Test, TestType, BrakeType } from '../types';
import { PencilIcon, TrashIcon, PaperclipIcon, PlusIcon } from '../constants';
import Modal from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { showSuccess, showError } from '../utils/toast';

const Tests: React.FC = () => {
    const { user } = useAuth();
    const { refreshKey, refetch } = useRefetch();
    const tests = useQuery(() => testsApi.getAll(), [refreshKey]);
    const engines = useQuery(() => enginesApi.getAll(), []);
    const testTypes = useQuery(() => testTypesApi.getAll(), [refreshKey]);
    const brakeTypes = useQuery(() => brakeTypesApi.getAll(), [refreshKey]);
    
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [editingTest, setEditingTest] = useState<Test | null>(null);
    const [isTestTypeModalOpen, setTestTypeModalOpen] = useState(false);
    const [isBrakeTypeModalOpen, setBrakeTypeModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'tests' | 'testTypes' | 'brakeTypes'>('tests');

    // Role permissions
    const isTestEngineer = user?.role === 'Test Engineer' || user?.role === 'Administrator';
    const canModify = user?.role === 'Administrator' || user?.role === 'Test Engineer';
    const canLog = canModify || user?.role === 'Test Operator';

    // Form states
    const [newTest, setNewTest] = useState({ 
        engineId: '', 
        testType: '', 
        brakeType: '',
        testCell: 'Cell-01 High Alt', 
        description: '', 
        duration: '' 
    });
    
    const [newTestType, setNewTestType] = useState({ name: '', description: '' });
    const [newBrakeType, setNewBrakeType] = useState({ name: '', description: '' });
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

    // Test logging with document upload
    const handleLogSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newTest.engineId || !newTest.duration || !newTest.testType) {
            showError('Please fill all required fields');
            return;
        }
        
        try {
            // Create test
            const createdTest = await testsApi.create({
                engineId: parseInt(newTest.engineId),
                testType: newTest.testType,
                brakeType: newTest.brakeType || undefined,
                testCell: newTest.testCell,
                description: newTest.description,
                duration: parseFloat(newTest.duration),
                testDate: new Date().toISOString(),
                userName: user.fullName,
            });
            
            // Upload documents if any
            if (uploadedFiles.length > 0 && createdTest.id) {
                for (const file of uploadedFiles) {
                    await newDocsApi.upload(file, {
                        relatedType: 'test',
                        relatedId: createdTest.id,
                        uploadedBy: user.fullName
                    });
                }
            }
            
            // Update engine total hours
            const engine = engines?.find(e => e.id === parseInt(newTest.engineId));
            if (engine) {
                const newTotalHours = (engine.totalHours || 0) + parseFloat(newTest.duration);
                await enginesApi.update(engine.id!, { totalHours: newTotalHours });
            }
            
            setNewTest({ engineId: '', testType: '', brakeType: '', testCell: 'Cell-01 High Alt', description: '', duration: '' });
            setUploadedFiles([]);
            showSuccess('Test logged successfully and engine hours updated!');
            refetch();
        } catch (error) {
            showError('Failed to log test');
            console.error(error);
        }
    };
    
    // Test Type Management
    const handleCreateTestType = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newTestType.name) return;
        
        try {
            await testTypesApi.create({
                name: newTestType.name,
                description: newTestType.description,
                createdBy: user.fullName,
                createdAt: new Date().toISOString()
            });
            setNewTestType({ name: '', description: '' });
            setTestTypeModalOpen(false);
            showSuccess('Test type created successfully!');
            refetch();
        } catch (error) {
            showError('Failed to create test type');
        }
    };
    
    const handleDeleteTestType = async (id: number) => {
        try {
            await testTypesApi.delete(id);
            showSuccess('Test type deleted successfully!');
            refetch();
        } catch (error) {
            showError('Failed to delete test type');
        }
    };
    
    // Brake Type Management
    const handleCreateBrakeType = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newBrakeType.name) return;
        
        try {
            await brakeTypesApi.create({
                name: newBrakeType.name,
                description: newBrakeType.description,
                createdBy: user.fullName,
                createdAt: new Date().toISOString()
            });
            setNewBrakeType({ name: '', description: '' });
            setBrakeTypeModalOpen(false);
            showSuccess('Brake type created successfully!');
            refetch();
        } catch (error) {
            showError('Failed to create brake type');
        }
    };
    
    const handleDeleteBrakeType = async (id: number) => {
        try {
            await brakeTypesApi.delete(id);
            showSuccess('Brake type deleted successfully!');
            refetch();
        } catch (error) {
            showError('Failed to delete brake type');
        }
    };
    
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null; type: 'test' | 'testType' | 'brakeType' }>({ 
        isOpen: false, 
        id: null, 
        type: 'test' 
    });
    
    const handleDelete = async (id: number, type: 'test' | 'testType' | 'brakeType') => {
        setDeleteConfirm({ isOpen: true, id, type });
    };
    
    const confirmDelete = async () => {
        if (deleteConfirm.id) {
            try {
                if (deleteConfirm.type === 'test') {
                    await testsApi.delete(deleteConfirm.id);
                    showSuccess('Test deleted successfully!');
                } else if (deleteConfirm.type === 'testType') {
                    await handleDeleteTestType(deleteConfirm.id);
                } else if (deleteConfirm.type === 'brakeType') {
                    await handleDeleteBrakeType(deleteConfirm.id);
                }
                refetch();
            } catch (error) {
                showError(`Failed to delete ${deleteConfirm.type}`);
            }
        }
        setDeleteConfirm({ isOpen: false, id: null, type: 'test' });
    };
    
    const handleEdit = (test: Test) => {
        setEditingTest(test);
        setEditModalOpen(true);
    };
    
    const handleUpdateTest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTest || !editingTest.id) return;
        try {
            await testsApi.update(editingTest.id, editingTest);
            showSuccess('Test updated successfully!');
            setEditModalOpen(false);
            setEditingTest(null);
            refetch();
        } catch (error) {
            showError('Failed to update test');
        }
    };
    
    const handleDownload = async (docId: number) => {
        try {
            const blob = await newDocsApi.download(docId);
            const doc = await newDocsApi.getById(docId);
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
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setUploadedFiles(Array.from(e.target.files));
        }
    };

    if (!tests || !engines || !testTypes || !brakeTypes) return <LoadingSpinner text="Loading tests..." />;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Test Management</h1>
                    <p className="text-brand-light">Define and log standardized test activities.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-2 border-b border-brand-border">
                <button
                    onClick={() => setActiveTab('tests')}
                    className={`px-4 py-2 font-semibold ${activeTab === 'tests' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-brand-light'}`}
                >
                    Test Activities
                </button>
                {isTestEngineer && (
                    <>
                        <button
                            onClick={() => setActiveTab('testTypes')}
                            className={`px-4 py-2 font-semibold ${activeTab === 'testTypes' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-brand-light'}`}
                        >
                            Test Types
                        </button>
                        <button
                            onClick={() => setActiveTab('brakeTypes')}
                            className={`px-4 py-2 font-semibold ${activeTab === 'brakeTypes' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-brand-light'}`}
                        >
                            Brake Types
                        </button>
                    </>
                )}
            </div>

            {/* Test Activities Tab */}
            {activeTab === 'tests' && (
                <>
                    {canLog && (
                        <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
                            <h2 className="text-lg font-bold text-white mb-4">Log New Test Activity</h2>
                            <form onSubmit={handleLogSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <select 
                                        value={newTest.engineId} 
                                        onChange={e => setNewTest({...newTest, engineId: e.target.value})} 
                                        className="bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                                        required
                                    >
                                        <option value="">-- Select Engine --</option>
                                        {engines?.map(e => <option key={e.id} value={e.id}>{e.serialNumber}</option>)}
                                    </select>
                                    
                                    <select 
                                        value={newTest.testType} 
                                        onChange={e => setNewTest({...newTest, testType: e.target.value})} 
                                        className="bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                                        required
                                    >
                                        <option value="">-- Select Test Type --</option>
                                        {testTypes?.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                    </select>
                                    
                                    <select 
                                        value={newTest.brakeType} 
                                        onChange={e => setNewTest({...newTest, brakeType: e.target.value})} 
                                        className="bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                                    >
                                        <option value="">-- Select Brake Type (Optional) --</option>
                                        {brakeTypes?.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                                    </select>
                                </div>
                                
                                <input 
                                    value={newTest.testCell} 
                                    onChange={e => setNewTest({...newTest, testCell: e.target.value})} 
                                    placeholder="Test Cell" 
                                    className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                                    required 
                                />
                                
                                <textarea 
                                    value={newTest.description} 
                                    onChange={e => setNewTest({...newTest, description: e.target.value})} 
                                    placeholder="Test Description" 
                                    className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                                    rows={3}
                                />
                                
                                <input 
                                    type="number" 
                                    step="0.1" 
                                    value={newTest.duration} 
                                    onChange={e => setNewTest({...newTest, duration: e.target.value})} 
                                    placeholder="Duration (Hours)" 
                                    className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                                    required 
                                />
                                
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
                                    Log Activity
                                </button>
                            </form>
                        </div>
                    )}
                    
                    <div className="bg-brand-card rounded-lg border border-brand-border">
                        <h2 className="text-lg font-bold text-white p-4 border-b border-brand-border">Recent Test Activities</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-brand-border bg-brand-dark">
                                    <tr>
                                        <th className="p-3 font-semibold">DATE</th>
                                        <th className="p-3 font-semibold">ENGINE</th>
                                        <th className="p-3 font-semibold">TEST TYPE</th>
                                        <th className="p-3 font-semibold">BRAKE TYPE</th>
                                        <th className="p-3 font-semibold">DESCRIPTION</th>
                                        <th className="p-3 font-semibold">DURATION</th>
                                        <th className="p-3 font-semibold">LOGGED BY</th>
                                        <th className="p-3 font-semibold">DOCUMENT</th>
                                        {canModify && <th className="p-3 font-semibold">ACTIONS</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tests?.map(test => (
                                        <tr key={test.id} className="border-b border-brand-border hover:bg-brand-dark">
                                            <td className="p-3">{new Date(test.testDate).toLocaleDateString()}</td>
                                            <td className="p-3">{engines?.find(e => e.id === test.engineId)?.serialNumber}</td>
                                            <td className="p-3">{test.testType}</td>
                                            <td className="p-3">{test.brakeType || '-'}</td>
                                            <td className="p-3">{test.description}</td>
                                            <td className="p-3">{test.duration.toFixed(1)} hrs</td>
                                            <td className="p-3 text-brand-light">{test.userName}</td>
                                            <td className="p-3">
                                                {test.documentId && (
                                                    <button 
                                                        onClick={() => handleDownload(test.documentId!)} 
                                                        className="text-brand-primary hover:text-blue-400"
                                                    >
                                                        <PaperclipIcon />
                                                    </button>
                                                )}
                                            </td>
                                            {canModify && (
                                                <td className="p-3 flex space-x-4">
                                                    <button 
                                                        onClick={() => handleEdit(test)} 
                                                        className="text-brand-light hover:text-white"
                                                    >
                                                        <PencilIcon />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(test.id!, 'test')} 
                                                        className="text-brand-danger hover:text-red-400"
                                                    >
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
                </>
            )}

            {/* Test Types Tab */}
            {activeTab === 'testTypes' && isTestEngineer && (
                <div className="space-y-6">
                    <div className="flex justify-end">
                        <button
                            onClick={() => setTestTypeModalOpen(true)}
                            className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md flex items-center space-x-2"
                        >
                            <PlusIcon />
                            <span>Add Test Type</span>
                        </button>
                    </div>
                    
                    <div className="bg-brand-card rounded-lg border border-brand-border">
                        <h2 className="text-lg font-bold text-white p-4 border-b border-brand-border">Test Types</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-brand-border bg-brand-dark">
                                    <tr>
                                        <th className="p-3 font-semibold">NAME</th>
                                        <th className="p-3 font-semibold">DESCRIPTION</th>
                                        <th className="p-3 font-semibold">CREATED BY</th>
                                        <th className="p-3 font-semibold">CREATED AT</th>
                                        <th className="p-3 font-semibold">ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {testTypes?.map(type => (
                                        <tr key={type.id} className="border-b border-brand-border hover:bg-brand-dark">
                                            <td className="p-3 font-semibold">{type.name}</td>
                                            <td className="p-3">{type.description || '-'}</td>
                                            <td className="p-3 text-brand-light">{type.createdBy}</td>
                                            <td className="p-3">{new Date(type.createdAt).toLocaleDateString()}</td>
                                            <td className="p-3">
                                                {type.name !== 'Other' && (
                                                    <button 
                                                        onClick={() => handleDelete(type.id!, 'testType')} 
                                                        className="text-brand-danger hover:text-red-400"
                                                    >
                                                        <TrashIcon />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Brake Types Tab */}
            {activeTab === 'brakeTypes' && isTestEngineer && (
                <div className="space-y-6">
                    <div className="flex justify-end">
                        <button
                            onClick={() => setBrakeTypeModalOpen(true)}
                            className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md flex items-center space-x-2"
                        >
                            <PlusIcon />
                            <span>Add Brake Type</span>
                        </button>
                    </div>
                    
                    <div className="bg-brand-card rounded-lg border border-brand-border">
                        <h2 className="text-lg font-bold text-white p-4 border-b border-brand-border">Brake Types</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-brand-border bg-brand-dark">
                                    <tr>
                                        <th className="p-3 font-semibold">NAME</th>
                                        <th className="p-3 font-semibold">DESCRIPTION</th>
                                        <th className="p-3 font-semibold">CREATED BY</th>
                                        <th className="p-3 font-semibold">CREATED AT</th>
                                        <th className="p-3 font-semibold">ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {brakeTypes?.map(type => (
                                        <tr key={type.id} className="border-b border-brand-border hover:bg-brand-dark">
                                            <td className="p-3 font-semibold">{type.name}</td>
                                            <td className="p-3">{type.description || '-'}</td>
                                            <td className="p-3 text-brand-light">{type.createdBy}</td>
                                            <td className="p-3">{new Date(type.createdAt).toLocaleDateString()}</td>
                                            <td className="p-3">
                                                {type.name !== 'Other' && (
                                                    <button 
                                                        onClick={() => handleDelete(type.id!, 'brakeType')} 
                                                        className="text-brand-danger hover:text-red-400"
                                                    >
                                                        <TrashIcon />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            {isEditModalOpen && editingTest && (
                <Modal isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Test Log">
                    <form onSubmit={handleUpdateTest} className="space-y-4">
                        <textarea 
                            value={editingTest.description} 
                            onChange={(e) => setEditingTest({...editingTest, description: e.target.value})}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            rows={3}
                        />
                        <input 
                            type="number"
                            step="0.1"
                            value={editingTest.duration} 
                            onChange={(e) => setEditingTest({...editingTest, duration: parseFloat(e.target.value)})}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                        />
                        <button type="submit" className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">
                            Save Changes
                        </button>
                    </form>
                </Modal>
            )}
            
            {isTestTypeModalOpen && (
                <Modal isOpen={isTestTypeModalOpen} onClose={() => setTestTypeModalOpen(false)} title="Add Test Type">
                    <form onSubmit={handleCreateTestType} className="space-y-4">
                        <input 
                            value={newTestType.name} 
                            onChange={(e) => setNewTestType({...newTestType, name: e.target.value})}
                            placeholder="Test Type Name"
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            required
                        />
                        <textarea 
                            value={newTestType.description} 
                            onChange={(e) => setNewTestType({...newTestType, description: e.target.value})}
                            placeholder="Description (Optional)"
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            rows={3}
                        />
                        <button type="submit" className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">
                            Create Test Type
                        </button>
                    </form>
                </Modal>
            )}
            
            {isBrakeTypeModalOpen && (
                <Modal isOpen={isBrakeTypeModalOpen} onClose={() => setBrakeTypeModalOpen(false)} title="Add Brake Type">
                    <form onSubmit={handleCreateBrakeType} className="space-y-4">
                        <input 
                            value={newBrakeType.name} 
                            onChange={(e) => setNewBrakeType({...newBrakeType, name: e.target.value})}
                            placeholder="Brake Type Name"
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            required
                        />
                        <textarea 
                            value={newBrakeType.description} 
                            onChange={(e) => setNewBrakeType({...newBrakeType, description: e.target.value})}
                            placeholder="Description (Optional)"
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            rows={3}
                        />
                        <button type="submit" className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">
                            Create Brake Type
                        </button>
                    </form>
                </Modal>
            )}
            
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                title={`Delete ${deleteConfirm.type === 'test' ? 'Test' : deleteConfirm.type === 'testType' ? 'Test Type' : 'Brake Type'}`}
                message={`Are you sure you want to delete this ${deleteConfirm.type}? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirm({ isOpen: false, id: null, type: 'test' })}
                variant="danger"
            />
        </div>
    );
};

export default Tests;
