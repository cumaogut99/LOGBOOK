import React, { useState, useMemo } from 'react';
import { useQuery, useRefetch } from '../hooks/useData';
import { enginesApi } from '../lib/client.ts';
import { maintenancePlansApi, controlRequestsApi, documentsApi } from '../lib/newApis.ts';
import { useAuth } from '../hooks/useAuth';
import type { MaintenancePlan, ControlRequest } from '../types';
import { CheckIcon, XIcon, PlusIcon, SearchIcon, PaperclipIcon } from '../constants';
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
    const [isControlRequestModalOpen, setControlRequestModalOpen] = useState(false);
    const [uploadedDocument, setUploadedDocument] = useState<File | null>(null);

    // Role permissions
    const canApprove = user?.role === 'Quality Control Engineer' || user?.role === 'Administrator';
    const canCreate = canApprove;

    // New maintenance plan form
    const [newPlan, setNewPlan] = useState({
        engineId: '',
        planType: 'Rutin İnceleme',
        description: '',
        scheduledDate: '',
        dueHours: '',
        dueCycles: ''
    });

    // New control request form
    const [newControlRequest, setNewControlRequest] = useState({
        engineId: '',
        controlType: 'Rutin Kontrol',
        description: '',
        requestDate: '',
        priority: 'Orta' as 'Düşük' | 'Orta' | 'Yüksek' | 'Kritik'
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
            showError('Lütfen tüm gerekli alanları doldurun');
            return;
        }
        
        try {
            // Upload document if exists
            let documentId = undefined;
            let documentName = undefined;
            if (uploadedDocument) {
                const doc = await documentsApi.upload(uploadedDocument, {
                    relatedType: 'maintenance',
                    uploadedBy: user.fullName
                });
                documentId = doc.id;
                documentName = doc.fileName;
            }

            await maintenancePlansApi.create({
                engineId: parseInt(newPlan.engineId),
                planType: newPlan.planType,
                maintenanceType: 'one-time',
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
                planType: 'Rutin İnceleme',
                description: '',
                scheduledDate: '',
                dueHours: '',
                dueCycles: ''
            });
            setUploadedDocument(null);
            setCreateModalOpen(false);
            showSuccess('Bakım planı başarıyla oluşturuldu!');
            refetch();
        } catch (error) {
            showError('Bakım planı oluşturulamadı');
            console.error(error);
        }
    };

    // Create new control request
    const handleCreateControlRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newControlRequest.engineId || !newControlRequest.description || !newControlRequest.requestDate) {
            showError('Lütfen tüm gerekli alanları doldurun');
            return;
        }
        
        try {
            // Upload document if exists
            let documentId = undefined;
            let documentName = undefined;
            if (uploadedDocument) {
                const doc = await documentsApi.upload(uploadedDocument, {
                    relatedType: 'maintenance',
                    uploadedBy: user.fullName
                });
                documentId = doc.id;
                documentName = doc.fileName;
            }

            await controlRequestsApi.create({
                engineId: parseInt(newControlRequest.engineId),
                controlType: newControlRequest.controlType,
                description: newControlRequest.description,
                requestDate: newControlRequest.requestDate,
                priority: newControlRequest.priority,
                status: 'Beklemede',
                createdBy: user.fullName,
                createdAt: new Date().toISOString(),
                documentId,
                documentName
            });
            
            setNewControlRequest({
                engineId: '',
                controlType: 'Rutin Kontrol',
                description: '',
                requestDate: '',
                priority: 'Orta'
            });
            setUploadedDocument(null);
            setControlRequestModalOpen(false);
            showSuccess('Kontrol talebi başarıyla oluşturuldu!');
            refetch();
        } catch (error: any) {
            console.error('Kontrol talebi oluşturma hatası:', error);
            console.error('Hata detayı:', error.response?.data);
            showError(`Kontrol talebi oluşturulamadı: ${error.response?.data?.error || error.message}`);
        }
    };

    // Approve selected maintenance plans
    const handleApprovePlans = async () => {
        if (selectedItems.size === 0) {
            showError('Lütfen onaylanacak en az bir plan seçin');
            return;
        }

        try {
            const promises = Array.from(selectedItems).map(async (id) => {
                if (typeof id === 'number') {
                    await maintenancePlansApi.approve(id, user?.fullName || 'Bilinmeyen');
                }
            });

            await Promise.all(promises);
            showSuccess(`${selectedItems.size} bakım planı başarıyla onaylandı!`);
            setSelectedItems(new Set());
            refetch();
        } catch (error) {
            showError('Bakım planları onaylanamadı');
            console.error(error);
        }
    };

    // Reject selected maintenance plans
    const handleRejectPlans = async () => {
        if (selectedItems.size === 0) {
            showError('Lütfen reddedilecek en az bir plan seçin');
            return;
        }

        try {
            const promises = Array.from(selectedItems).map(async (id) => {
                if (typeof id === 'number') {
                    await maintenancePlansApi.update(id, {
                        status: 'Rejected',
                        approvedBy: user?.fullName,
                        approvedAt: new Date().toISOString()
                    });
                }
            });

            await Promise.all(promises);
            showSuccess(`${selectedItems.size} bakım planı reddedildi!`);
            setSelectedItems(new Set());
            refetch();
        } catch (error) {
            showError('Bakım planları reddedilemedi');
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
        const statusText = {
            Pending: 'Beklemede',
            Approved: 'Onaylandı',
            Rejected: 'Reddedildi',
            Completed: 'Tamamlandı'
        };
        return (
            <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status as keyof typeof styles] || 'bg-gray-500/20 text-gray-400'}`}>
                {statusText[status as keyof typeof statusText] || status}
            </span>
        );
    };

    if (!maintenancePlans || !engines) return <LoadingSpinner text="Kalite kontrol yükleniyor..." />;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Kalite Kontrol - Bakım Planları</h1>
                    <p className="text-brand-light">Motorlar için bakım planlarını inceleyin ve onaylayın.</p>
                </div>
                {canCreate && (
                    <div className="flex gap-3">
                        <button
                            onClick={() => setControlRequestModalOpen(true)}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md flex items-center space-x-2"
                        >
                            <PaperclipIcon />
                            <span>Kontrol Talebi</span>
                        </button>
                        <button
                            onClick={() => setCreateModalOpen(true)}
                            className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md flex items-center space-x-2"
                        >
                            <PlusIcon />
                            <span>Bakım Planı Oluştur</span>
                        </button>
                    </div>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-brand-card p-4 rounded-lg border border-brand-border">
                    <p className="text-brand-light text-sm">Toplam Plan</p>
                    <p className="text-3xl font-bold text-white">{kpis.total}</p>
                </div>
                <div className="bg-brand-card p-4 rounded-lg border border-brand-border">
                    <p className="text-brand-light text-sm">Onay Bekleyenler</p>
                    <p className="text-3xl font-bold text-yellow-400">{kpis.pending}</p>
                </div>
                <div className="bg-brand-card p-4 rounded-lg border border-brand-border">
                    <p className="text-brand-light text-sm">Onaylananlar</p>
                    <p className="text-3xl font-bold text-green-400">{kpis.approved}</p>
                </div>
                <div className="bg-brand-card p-4 rounded-lg border border-brand-border">
                    <p className="text-brand-light text-sm">Reddedilenler</p>
                    <p className="text-3xl font-bold text-red-400">{kpis.rejected}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-2 border-b border-brand-border">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-4 py-2 font-semibold ${activeTab === 'pending' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-brand-light'}`}
                >
                    Bekleyen ({kpis.pending})
                </button>
                <button
                    onClick={() => setActiveTab('approved')}
                    className={`px-4 py-2 font-semibold ${activeTab === 'approved' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-brand-light'}`}
                >
                    Onaylanan ({kpis.approved})
                </button>
                <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-2 font-semibold ${activeTab === 'all' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-brand-light'}`}
                >
                    Tümü ({kpis.total})
                </button>
            </div>

            {/* Search and Actions */}
            <div className="flex justify-between items-center">
                <div className="relative flex-1 max-w-md">
                    <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-light" />
                    <input
                        type="text"
                        placeholder="Motor, tip veya açıklamaya göre ara..."
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
                            <span>Onayla ({selectedItems.size})</span>
                        </button>
                        <button
                            onClick={handleRejectPlans}
                            disabled={selectedItems.size === 0}
                            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md flex items-center space-x-2"
                        >
                            <XIcon />
                            <span>Reddet ({selectedItems.size})</span>
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
                                <th className="p-3 font-semibold">MOTOR</th>
                                <th className="p-3 font-semibold">PLAN TİPİ</th>
                                <th className="p-3 font-semibold">AÇIKLAMA</th>
                                <th className="p-3 font-semibold">PLANLI TARİH</th>
                                <th className="p-3 font-semibold">SÜRE (SAAT)</th>
                                <th className="p-3 font-semibold">ÇEVRİM</th>
                                <th className="p-3 font-semibold">DURUM</th>
                                <th className="p-3 font-semibold">OLUŞTURAN</th>
                                <th className="p-3 font-semibold">ONAYLAYAN</th>
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
                                        {engines?.find(e => e.id === plan.engineId)?.serialNumber || 'Yok'}
                                    </td>
                                    <td className="p-3">{plan.planType}</td>
                                    <td className="p-3 max-w-xs truncate">{plan.description}</td>
                                    <td className="p-3">{new Date(plan.scheduledDate).toLocaleDateString('tr-TR')}</td>
                                    <td className="p-3">{plan.dueHours ? `${plan.dueHours} saat` : '-'}</td>
                                    <td className="p-3">{plan.dueCycles ? `${plan.dueCycles} çevrim` : '-'}</td>
                                    <td className="p-3">{getStatusBadge(plan.status)}</td>
                                    <td className="p-3 text-brand-light">{plan.createdBy}</td>
                                    <td className="p-3 text-brand-light">{plan.approvedBy || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredPlans.length === 0 && (
                        <div className="p-12 text-center text-brand-light">
                            {searchTerm ? 'Aramanızla eşleşen bakım planı bulunamadı.' : 'Bakım planı bulunamadı.'}
                        </div>
                    )}
                </div>
            </div>

            {/* Create Maintenance Plan Modal */}
            {isCreateModalOpen && (
                <Modal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)} title="Bakım Planı Oluştur">
                    <form onSubmit={handleCreatePlan} className="space-y-4">
                        <select
                            value={newPlan.engineId}
                            onChange={(e) => setNewPlan({...newPlan, engineId: e.target.value})}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            required
                        >
                            <option value="">-- Motor Seçin --</option>
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
                            <option value="Rutin İnceleme">Rutin İnceleme</option>
                            <option value="Planlanmış Bakım">Planlanmış Bakım</option>
                            <option value="Kapsamlı Bakım">Kapsamlı Bakım</option>
                            <option value="Komponent Değişimi">Komponent Değişimi</option>
                            <option value="Performans Kontrolü">Performans Kontrolü</option>
                            <option value="Güvenlik İncelemesi">Güvenlik İncelemesi</option>
                            <option value="Diğer">Diğer</option>
                        </select>

                        <textarea
                            value={newPlan.description}
                            onChange={(e) => setNewPlan({...newPlan, description: e.target.value})}
                            placeholder="Bakım Planı Açıklaması"
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
                                placeholder="Süre (Saat) - Opsiyonel"
                                className="bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            />
                            <input
                                type="number"
                                value={newPlan.dueCycles}
                                onChange={(e) => setNewPlan({...newPlan, dueCycles: e.target.value})}
                                placeholder="Çevrim - Opsiyonel"
                                className="bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-brand-light mb-2">
                                Döküman Ekle (Opsiyonel)
                            </label>
                            <input
                                type="file"
                                onChange={(e) => setUploadedDocument(e.target.files?.[0] || null)}
                                className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-blue-600"
                            />
                            {uploadedDocument && (
                                <p className="mt-2 text-sm text-green-400">✓ {uploadedDocument.name}</p>
                            )}
                        </div>

                        <button type="submit" className="w-full bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">
                            Bakım Planı Oluştur
                        </button>
                    </form>
                </Modal>
            )}

            {/* Control Request Modal */}
            {isControlRequestModalOpen && (
                <Modal isOpen={isControlRequestModalOpen} onClose={() => setControlRequestModalOpen(false)} title="Kontrol Talebi Oluştur">
                    <form onSubmit={handleCreateControlRequest} className="space-y-4">
                        <select
                            value={newControlRequest.engineId}
                            onChange={(e) => setNewControlRequest({...newControlRequest, engineId: e.target.value})}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            required
                        >
                            <option value="">-- Motor Seçin --</option>
                            {engines?.map(e => (
                                <option key={e.id} value={e.id}>
                                    {e.serialNumber} - {e.model}
                                </option>
                            ))}
                        </select>

                        <select
                            value={newControlRequest.controlType}
                            onChange={(e) => setNewControlRequest({...newControlRequest, controlType: e.target.value})}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            required
                        >
                            <option value="Rutin Kontrol">Rutin Kontrol</option>
                            <option value="Performans Testi">Performans Testi</option>
                            <option value="Görsel İnceleme">Görsel İnceleme</option>
                            <option value="Titreşim Analizi">Titreşim Analizi</option>
                            <option value="Sızdırmazlık Testi">Sızdırmazlık Testi</option>
                            <option value="Güvenlik Kontrolü">Güvenlik Kontrolü</option>
                            <option value="Kalibrasyon">Kalibrasyon</option>
                            <option value="Diğer">Diğer</option>
                        </select>

                        <textarea
                            value={newControlRequest.description}
                            onChange={(e) => setNewControlRequest({...newControlRequest, description: e.target.value})}
                            placeholder="Kontrol Talebi Açıklaması"
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            rows={4}
                            required
                        />

                        <input
                            type="date"
                            value={newControlRequest.requestDate}
                            onChange={(e) => setNewControlRequest({...newControlRequest, requestDate: e.target.value})}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            required
                        />

                        <select
                            value={newControlRequest.priority}
                            onChange={(e) => setNewControlRequest({...newControlRequest, priority: e.target.value as any})}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            required
                        >
                            <option value="Düşük">Düşük</option>
                            <option value="Orta">Orta</option>
                            <option value="Yüksek">Yüksek</option>
                            <option value="Kritik">Kritik</option>
                        </select>

                        <div>
                            <label className="block text-sm font-semibold text-brand-light mb-2">
                                Döküman Ekle (Opsiyonel)
                            </label>
                            <input
                                type="file"
                                onChange={(e) => setUploadedDocument(e.target.files?.[0] || null)}
                                className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700"
                            />
                            {uploadedDocument && (
                                <p className="mt-2 text-sm text-green-400">✓ {uploadedDocument.name}</p>
                            )}
                        </div>

                        <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md">
                            Kontrol Talebi Oluştur
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default QualityControl;
