import React, { useState } from 'react';
import { useQuery, useRefetch } from '../hooks/useData';
import { enginesApi } from '../lib/client.ts';
import type { Engine, Component as BomComponent, ActivityLogItem } from '../types';
import { PencilIcon, CirclePlusIcon, CircleMinusIcon } from '../constants';
import { EngineModal } from '../components/EngineModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { showSuccess, showError } from '../utils/toast';

const Engines: React.FC = () => {
    const [selectedEngineId, setSelectedEngineId] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEngine, setEditingEngine] = useState<Engine | null>(null);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    
    const engines = useQuery(() => enginesApi.getAll(), []);
    const refetch = useRefetch();
    const selectedEngine = engines?.find(e => e.id === selectedEngineId);

    if (!engines) return <LoadingSpinner text="Loading engines..." />;

    const handleSelectEngine = (engine: Engine) => {
        setSelectedEngineId(engine.id ?? null);
    };

    const handleBack = () => {
        setSelectedEngineId(null);
    };

    const handleAddEngine = () => {
        setModalMode('add');
        setEditingEngine(null);
        setIsModalOpen(true);
    };

    const handleEditEngine = (engine: Engine) => {
        setModalMode('edit');
        setEditingEngine(engine);
        setIsModalOpen(true);
    };

    const handleSaveEngine = async (engineData: Partial<Engine>) => {
        try {
            if (modalMode === 'add') {
                await enginesApi.create(engineData as Omit<Engine, 'id'>);
                showSuccess('Engine added successfully!');
            } else {
                await enginesApi.update(editingEngine!.id!, engineData);
                showSuccess('Engine updated successfully!');
            }
            refetch();
            setIsModalOpen(false);
        } catch (error) {
            showError(`Failed to ${modalMode === 'add' ? 'add' : 'update'} engine`);
            throw error;
        }
    };

    if (selectedEngine) {
        return <EngineDetails engine={selectedEngine} onBack={handleBack} onEdit={handleEditEngine} />;
    }

    return (
        <>
            <EngineFleetOverview 
                engines={engines} 
                onSelectEngine={handleSelectEngine}
                onAddEngine={handleAddEngine}
            />
            <EngineModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveEngine}
                engine={editingEngine}
                mode={modalMode}
            />
        </>
    );
};

const EngineFleetOverview: React.FC<{ engines: Engine[], onSelectEngine: (engine: Engine) => void, onAddEngine: () => void }> = ({ engines, onSelectEngine, onAddEngine }) => {
    return (
        <div>
            <div className="flex justify-end mb-6">
                <button onClick={onAddEngine} className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md flex items-center transition-colors">
                    <svg xmlns="http://www.w.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add Engine
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {engines.map(engine => (
                    <div key={engine.id} className="bg-brand-card p-6 rounded-lg border border-brand-border flex flex-col">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-lg font-bold text-white">{engine.model}</p>
                                <p className="text-sm text-brand-light">{engine.serialNumber}</p>
                            </div>
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1.5 ${engine.status === 'Active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                <span className={`h-2 w-2 rounded-full ${engine.status === 'Active' ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
                                {engine.status}
                            </span>
                        </div>
                        <div className="my-6 text-center">
                            <p className="text-sm text-brand-light">TOTAL TIME (TTH)</p>
                            <p className="text-5xl font-bold text-white">{engine.totalHours.toFixed(1)}</p>
                            <p className="text-sm text-brand-light">hours</p>
                        </div>
                        <div className="text-center mb-6">
                            <p className="text-sm text-brand-light">NEXT SERVICE DUE</p>
                            <p className="text-xl font-bold text-white">{typeof engine.nextServiceDue === 'number' ? `${engine.nextServiceDue}h` : engine.nextServiceDue}</p>
                        </div>
                        <button onClick={() => onSelectEngine(engine)} className="mt-auto w-full bg-brand-border hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-md">
                            View Details
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const EngineDetails: React.FC<{ 
    engine: Engine, 
    onBack: () => void,
    onEdit: (engine: Engine) => void 
}> = ({ engine, onBack, onEdit }) => {
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set([1, 100])); // Pre-expand some rows for demo
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const { refetch } = useRefetch();

    const toggleRow = (id: number) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!engine.id) return;
        
        setIsUpdatingStatus(true);
        try {
            await enginesApi.update(engine.id, { status: newStatus as Engine['status'] });
            showSuccess(`Engine status updated to ${newStatus}`);
            refetch();
        } catch (error) {
            showError('Failed to update engine status');
            console.error(error);
        } finally {
            setIsUpdatingStatus(false);
        }
    };
    
    const renderBomRows = (components: BomComponent[], level = 0): React.ReactNode[] => {
        return components.flatMap(comp => {
            const isExpanded = expandedRows.has(comp.id);
            const hasChildren = comp.children && comp.children.length > 0;

            const row = (
                <tr key={comp.id} className="border-b border-brand-border hover:bg-brand-dark">
                    <td className="p-3" style={{ paddingLeft: `${1 + level * 2}rem` }}>
                        <div className="flex items-center">
                            {hasChildren ? (
                                <button onClick={() => toggleRow(comp.id)} className="mr-2 text-brand-light hover:text-white">
                                    {isExpanded ? <CircleMinusIcon /> : <CirclePlusIcon />}
                                </button>
                            ) : (
                                <span className="w-6 mr-2"></span> 
                            )}
                            {comp.description}
                        </div>
                    </td>
                    <td className="p-3">{comp.partNumber}</td>
                    <td className="p-3">{comp.serialNumber}</td>
                    <td className="p-3">{comp.currentHours}</td>
                    <td className="p-3">{comp.lifeLimit}</td>
                    <td className="p-3">
                        <button className="text-brand-light hover:text-white"><PencilIcon /></button>
                    </td>
                </tr>
            );

            const children = (hasChildren && isExpanded) ? renderBomRows(comp.children!, level + 1) : [];
            return [row, ...children];
        });
    };

    const renderActivityLogItem = (item: ActivityLogItem, index: number) => {
        let borderColor = 'border-brand-secondary';
        let title = '';
        let content = <p>{item.details}</p>;

        switch(item.type) {
            case 'Swap':
                borderColor = 'border-brand-primary';
                title = 'Swap';
                content = <p>{item.details}</p>;
                break;
            case 'Fault':
                borderColor = 'border-brand-accent';
                title = 'Fault';
                content = <div className="flex justify-between"><span>{item.details}</span><span className="font-bold text-yellow-400">{item.severity}</span></div>;
                break;
            case 'Test':
                borderColor = 'border-brand-secondary';
                title = 'Test';
                content = <div className="flex justify-between"><span>{item.details}</span><span className="font-semibold text-white">{item.duration} hrs</span></div>;
                break;
        }

        return (
            <div key={index} className={`border-l-4 ${borderColor} pl-4 py-2`}>
                <p className="font-bold text-white">{title}: {item.details.split('/')[0]}</p>
                <p className="text-sm text-brand-light">{item.date}</p>
                <div className="text-sm mt-1">{content}</div>
            </div>
        )
    };
    
    return (
        <div className="space-y-6">
             <button onClick={onBack} className="text-brand-primary mb-0 flex items-center font-semibold hover:underline">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-1"><polyline points="15 18 9 12 15 6"></polyline></svg>
                Engine Fleet Overview
            </button>
            <div className="flex items-baseline space-x-2">
                 <h2 className="text-2xl font-bold text-white">Engine Details / {engine.serialNumber}</h2>
                 <p className="text-brand-light">Model: {engine.model}</p>
            </div>
           
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 grid grid-cols-3 gap-6">
                    <div className="bg-brand-card p-4 rounded-lg border border-brand-border text-center">
                        <p className="text-sm text-brand-light">TOTAL TIME</p>
                        <p className="text-4xl font-bold text-white">{engine.totalHours}</p>
                        <p className="text-sm text-brand-light">hours</p>
                    </div>
                     <div className="bg-brand-card p-4 rounded-lg border border-brand-border text-center">
                        <p className="text-sm text-brand-light">TOTAL CYCLES</p>
                        <p className="text-4xl font-bold text-white">{engine.totalCycles}</p>
                        <p className="text-sm text-brand-light">cycles</p>
                    </div>
                     <div className="bg-brand-card p-4 rounded-lg border border-brand-border text-center">
                        <p className="text-sm text-brand-light">NEXT SERVICE</p>
                        <p className="text-4xl font-bold text-white">{engine.nextServiceDue}</p>
                        <p className="text-sm text-brand-light">hours remaining</p>
                    </div>
                </div>
                <div className="bg-brand-card p-4 rounded-lg border border-brand-border space-y-3">
                    <div className="flex justify-between items-center">
                       <h3 className="text-lg font-bold text-white">Engine Information</h3>
                       <button 
                           onClick={() => onEdit(engine)}
                           className="text-brand-light hover:text-white transition-colors"
                       >
                           <PencilIcon/>
                       </button>
                    </div>
                    <div><span className="font-semibold">Serial Number:</span> {engine.serialNumber}</div>
                    <div><span className="font-semibold">Manufacturer:</span> {engine.manufacturer}</div>
                    <div className="flex items-center justify-between">
                        <span className="font-semibold">Status:</span>
                        <select 
                            value={engine.status} 
                            onChange={(e) => handleStatusChange(e.target.value)}
                            disabled={isUpdatingStatus}
                            className="bg-brand-dark border border-brand-border rounded-md p-1 text-white text-sm hover:bg-opacity-80 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            <option value="Active">Active</option>
                            <option value="Maintenance Due">Maintenance Due</option>
                            <option value="AOG">AOG</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-brand-card rounded-lg border border-brand-border">
                <h3 className="text-lg font-bold text-white p-4 border-b border-brand-border">Engine Product Tree</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-brand-border bg-brand-dark">
                            <tr>
                                <th className="p-3 font-semibold">NAME / DESCRIPTION</th>
                                <th className="p-3 font-semibold">PART NUMBER</th>
                                <th className="p-3 font-semibold">SERIAL NUMBER</th>
                                <th className="p-3 font-semibold">CURRENT HOURS</th>
                                <th className="p-3 font-semibold">LIFE LIMIT</th>
                                <th className="p-3 font-semibold">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {renderBomRows(engine.components)}
                        </tbody>
                    </table>
                </div>
            </div>

             <div className="bg-brand-card rounded-lg border border-brand-border">
                <h3 className="text-lg font-bold text-white p-4 border-b border-brand-border">Recent Activity Log</h3>
                <div className="p-4 space-y-4">
                    {engine.activityLog.map(renderActivityLogItem)}
                </div>
            </div>
        </div>
    );
};

export default Engines;