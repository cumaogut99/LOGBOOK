import React, { useState, useMemo } from 'react';
import { useQuery, useRefetch } from '../hooks/useData';
import { enginesApi } from '../lib/client.ts';
import { maintenancePlansApi, controlRequestsApi, documentsApi } from '../lib/newApis.ts';
import { useAuth } from '../context/AuthContext';
import type { MaintenancePlan, ControlRequest, LifeLimitAlert } from '../types';
import { CheckIcon, XIcon, PlusIcon, SearchIcon, PaperclipIcon } from '../constants';
import Modal from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { showSuccess, showError } from '../utils/toast';
import { formatStoredDate, parseFlexibleDate } from '../utils/dateDisplay';

// Maintenance Detail Modal Component
const MaintenanceDetailModal: React.FC<{ 
    plan: MaintenancePlan, 
    engines: any[] | null, 
    canModify: boolean, 
    onComplete: (plan: MaintenancePlan) => void 
}> = ({ plan, engines, canModify, onComplete }) => {
    const [history, setHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    
    React.useEffect(() => {
        if (plan.maintenanceType === 'periodic' && plan.id) {
            setLoadingHistory(true);
            maintenancePlansApi.getHistory(plan.id)
                .then(setHistory)
                .catch(err => console.error('Failed to load history:', err))
                .finally(() => setLoadingHistory(false));
        }
    }, [plan.id, plan.maintenanceType]);
    
    return (
        <div className="space-y-4">
            <div>
                <p className="text-sm text-brand-light">Motor</p>
                <p className="text-white font-semibold">
                    {engines?.find(e => e.id === plan.engineId)?.serialNumber}
                </p>
            </div>
            <div>
                <p className="text-sm text-brand-light">Bakım Tipi</p>
                <p className="text-white">{plan.planType}</p>
            </div>
            <div>
                <p className="text-sm text-brand-light">Açıklama</p>
                <p className="text-white">{plan.description}</p>
            </div>
            
            {plan.maintenanceType === 'periodic' && (
                <>
                    <div className="bg-brand-dark p-3 rounded-md">
                        <p className="text-xs text-brand-light mb-2">Periyodik Bakım Bilgileri</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            {plan.periodicIntervalHours && (
                                <div>
                                    <span className="text-brand-light">Periyot:</span>
                                    <span className="text-white ml-2">{plan.periodicIntervalHours} saat</span>
                                </div>
                            )}
                            {plan.lastPerformedHours !== null && plan.lastPerformedHours !== undefined && (
                                <div>
                                    <span className="text-brand-light">Son Bakım:</span>
                                    <span className="text-white ml-2">{plan.lastPerformedHours.toFixed(1)} saat</span>
                                </div>
                            )}
                            {plan.nextDueHours && (
                                <div>
                                    <span className="text-brand-light">Sonraki:</span>
                                    <span className="text-white ml-2">{plan.nextDueHours.toFixed(1)} saat</span>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Maintenance History */}
                    {loadingHistory ? (
                        <div className="text-center py-4">
                            <LoadingSpinner text="Geçmiş yükleniyor..." />
                        </div>
                    ) : history.length > 0 ? (
                        <div>
                            <p className="text-sm text-brand-light mb-2">Bakım Geçmişi ({history.length} bakım)</p>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {history.map((h, idx) => (
                                    <div key={h.id || idx} className="bg-brand-dark p-3 rounded-md text-sm">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-semibold text-white">
                                                {h.performedAtHours?.toFixed(1)} saat
                                            </span>
                                            <span className="text-xs text-brand-light">
                                                {formatStoredDate(h.performedDate, 'dd.MM.yyyy HH:mm')}
                                            </span>
                                        </div>
                                        <div className="text-xs text-brand-light">
                                            <span>Yapan: {h.performedBy}</span>
                                            {h.notes && <p className="mt-1 text-white">{h.notes}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-4 text-brand-light text-sm">
                            Henüz bakım geçmişi bulunmuyor
                        </div>
                    )}
                </>
            )}
            
            {canModify && plan.status !== 'Completed' && (
                <button
                    onClick={() => onComplete(plan)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
                >
                    ✅ Bakım Tamamlandı
                </button>
            )}
        </div>
    );
};

const QualityControl: React.FC = () => {
    const { user } = useAuth();
    const { refreshKey, refetch } = useRefetch();
    
    // Data fetching
    const maintenancePlans = useQuery(() => maintenancePlansApi.getAll(), [refreshKey]);
    const controlRequests = useQuery(() => controlRequestsApi.getAll(), [refreshKey]);
    const engines = useQuery(() => enginesApi.getAll(), [refreshKey]);
    const lifeLimitAlerts = useQuery(() => enginesApi.getAllLifeLimitAlerts(), [refreshKey]);
    const duePlans = useQuery(() => maintenancePlansApi.getDue(), [refreshKey]);

    // Main tabs
    const [activeMainTab, setActiveMainTab] = useState<'maintenance' | 'life-limits' | 'controls'>('maintenance');
    
    // Sub tabs for Maintenance
    const [maintenanceSubTab, setMaintenanceSubTab] = useState<'one-time' | 'periodic'>('one-time');
    const [oneTimeTab, setOneTimeTab] = useState<'pending' | 'completed'>('pending');
    const [periodicTab, setPeriodicTab] = useState<'pending' | 'completed' | 'planned'>('pending');
    
    // Sub tabs for Life Limits
    const [lifeLimitsTab, setLifeLimitsTab] = useState<'pending' | 'completed'>('pending');
    
    // Sub tabs for Controls
    const [controlsTab, setControlsTab] = useState<'pending' | 'completed'>('pending');

    // Modals
    const [isCreateMaintenanceModalOpen, setCreateMaintenanceModalOpen] = useState(false);
    const [isCreateControlModalOpen, setCreateControlModalOpen] = useState(false);
    const [detailModal, setDetailModal] = useState<{
        isOpen: boolean;
        type: 'maintenance' | 'life-limit' | 'control' | null;
        data: any;
    }>({ isOpen: false, type: null, data: null });

    // Search
    const [searchTerm, setSearchTerm] = useState('');
    const [uploadedDocument, setUploadedDocument] = useState<File | null>(null);

    // New maintenance plan form
    const [newPlan, setNewPlan] = useState({
        engineId: '',
        planType: 'Rutin İnceleme',
        maintenanceType: 'one-time' as 'one-time' | 'periodic',
        description: '',
        scheduledDate: '',
        dueHours: '',
        dueCycles: '',
        periodicIntervalHours: '',
        periodicIntervalCycles: ''
    });

    // New control request form
    const [newControlRequest, setNewControlRequest] = useState({
        engineId: '',
        controlType: 'Rutin Kontrol',
        description: '',
        requestDate: '',
        priority: 'Orta' as 'Düşük' | 'Orta' | 'Yüksek' | 'Kritik'
    });

    const canModify = user?.role === 'Quality Control Engineer' || user?.role === 'Administrator';

    // Calculate KPIs
    const kpis = useMemo(() => {
        const critical = lifeLimitAlerts?.filter(a => a.status === 'critical').length || 0;
        const warnings = lifeLimitAlerts?.filter(a => a.status === 'warning').length || 0;
        const dueCount = duePlans?.length || 0;
        
        // Today's tasks
        const today = new Date().toISOString().split('T')[0];
        const todayTasks = maintenancePlans?.filter(p => {
            if (p.status === 'Completed') return false;
            const d = parseFlexibleDate(p.scheduledDate);
            if (!d) return false;
            return d.toISOString().split('T')[0] === today;
        }).length || 0;
        
        // Overdue
        const overdue = maintenancePlans?.filter(p => {
            if (p.status === 'Completed') return false;
            const schedDate = parseFlexibleDate(p.scheduledDate);
            if (!schedDate) return false;
            return schedDate < new Date();
        }).length || 0;

        return {
            critical,
            warnings: warnings + dueCount,
            today: todayTasks,
            overdue
        };
    }, [lifeLimitAlerts, duePlans, maintenancePlans]);

    // Filter maintenance plans
    const filteredMaintenancePlans = useMemo(() => {
        if (!maintenancePlans) return [];
        
        let filtered = maintenancePlans;
        
        // Filter by maintenance type
        filtered = filtered.filter(p => p.maintenanceType === maintenanceSubTab);
        
        // Filter by status
        if (maintenanceSubTab === 'one-time') {
            if (oneTimeTab === 'pending') {
                filtered = filtered.filter(p => p.status !== 'Completed');
            } else {
                filtered = filtered.filter(p => p.status === 'Completed');
            }
        } else {
            if (periodicTab === 'pending') {
                // Show only periodic plans that are due
                filtered = duePlans?.filter(p => p.maintenanceType === 'periodic') || [];
            } else if (periodicTab === 'completed') {
                // Periodic plans never have status 'Completed', they stay Active
                // Show history instead (will be handled in detail view)
                filtered = [];
            } else {
                // Planned - show all active/approved periodic plans
                filtered = filtered.filter(p => 
                    p.maintenanceType === 'periodic' && 
                    (p.status === 'Active' || p.status === 'Approved')
                );
            }
        }
        
        // Search filter
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
    }, [maintenancePlans, maintenanceSubTab, oneTimeTab, periodicTab, searchTerm, engines, duePlans]);

    // Filter life limit alerts
    const filteredLifeLimitAlerts = useMemo(() => {
        if (!lifeLimitAlerts) return [];
        
        // For now, pending shows all alerts (we don't have completed tracking yet)
        if (lifeLimitsTab === 'pending') {
            return lifeLimitAlerts.filter(a => !a.actionTaken);
        } else {
            return lifeLimitAlerts.filter(a => a.actionTaken);
        }
    }, [lifeLimitAlerts, lifeLimitsTab]);

    // Filter control requests
    const filteredControlRequests = useMemo(() => {
        if (!controlRequests) return [];
        
        let filtered = controlRequests;
        
        if (controlsTab === 'pending') {
            filtered = filtered.filter(r => r.status !== 'Tamamlandı');
        } else {
            filtered = filtered.filter(r => r.status === 'Tamamlandı');
        }
        
        if (searchTerm) {
            filtered = filtered.filter(r => {
                const engine = engines?.find(e => e.id === r.engineId);
                return (
                    r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    r.controlType.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    engine?.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())
                );
            });
        }
        
        return filtered;
    }, [controlRequests, controlsTab, searchTerm, engines]);

    // Create maintenance plan
    const handleCreatePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newPlan.engineId || !newPlan.description) {
            showError('Lütfen tüm gerekli alanları doldurun');
            return;
        }

        if (newPlan.maintenanceType === 'one-time' && !newPlan.scheduledDate) {
            showError('Tek seferlik bakım için planlı tarih gereklidir');
            return;
        }

        if (newPlan.maintenanceType === 'periodic') {
            if (!newPlan.periodicIntervalHours && !newPlan.periodicIntervalCycles) {
                showError('Periyodik bakım için en az bir periyodik aralık (saat veya çevrim) girmelisiniz');
                return;
            }
        }
        
        try {
            let documentId = undefined;
            if (uploadedDocument) {
                const doc = await documentsApi.upload(uploadedDocument, {
                    relatedType: 'maintenance',
                    uploadedBy: user.fullName
                });
                documentId = doc.id;
            }

            await maintenancePlansApi.create({
                engineId: parseInt(newPlan.engineId),
                planType: newPlan.planType,
                maintenanceType: newPlan.maintenanceType,
                description: newPlan.description,
                scheduledDate: newPlan.scheduledDate || new Date().toISOString(),
                dueHours: newPlan.dueHours ? parseFloat(newPlan.dueHours) : undefined,
                dueCycles: newPlan.dueCycles ? parseInt(newPlan.dueCycles) : undefined,
                periodicIntervalHours: newPlan.periodicIntervalHours ? parseFloat(newPlan.periodicIntervalHours) : undefined,
                periodicIntervalCycles: newPlan.periodicIntervalCycles ? parseInt(newPlan.periodicIntervalCycles) : undefined,
                status: newPlan.maintenanceType === 'periodic' ? 'Active' : 'Approved', // Auto-approve
                createdBy: user.fullName,
                createdAt: new Date().toISOString()
            });
            
            setNewPlan({
                engineId: '',
                planType: 'Rutin İnceleme',
                maintenanceType: 'one-time',
                description: '',
                scheduledDate: '',
                dueHours: '',
                dueCycles: '',
                periodicIntervalHours: '',
                periodicIntervalCycles: ''
            });
            setUploadedDocument(null);
            setCreateMaintenanceModalOpen(false);
            showSuccess('Bakım planı başarıyla oluşturuldu ve otomatik onaylandı!');
            refetch();
        } catch (error: any) {
            showError('Bakım planı oluşturulamadı', error);
        }
    };

    // Create control request
    const handleCreateControlRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newControlRequest.engineId || !newControlRequest.description || !newControlRequest.requestDate) {
            showError('Lütfen tüm gerekli alanları doldurun');
            return;
        }
        
        try {
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
            setCreateControlModalOpen(false);
            showSuccess('Kontrol talebi başarıyla oluşturuldu!');
            refetch();
        } catch (error: any) {
            showError('Kontrol talebi oluşturulamadı', error);
        }
    };

    // Complete maintenance
    const handleCompleteMaintenance = async (plan: MaintenancePlan, notes?: string) => {
        if (!user) return;
        try {
            await maintenancePlansApi.complete(plan.id!, user.fullName);
            showSuccess('Bakım tamamlandı olarak işaretlendi!');
            setDetailModal({ isOpen: false, type: null, data: null });
            refetch();
        } catch (error) {
            showError('Bakım tamamlanamadı', error);
        }
    };

    // Update control request status
    const handleUpdateControlStatus = async (id: number, newStatus: 'Beklemede' | 'İşlemde' | 'Tamamlandı' | 'İptal') => {
        if (!user) return;
        
        try {
            await controlRequestsApi.update(id, {
                status: newStatus,
                completedBy: newStatus === 'Tamamlandı' ? user.fullName : undefined,
                completedAt: newStatus === 'Tamamlandı' ? new Date().toISOString() : undefined
            });
            showSuccess('Kontrol talebi durumu güncellendi!');
            setDetailModal({ isOpen: false, type: null, data: null });
            refetch();
        } catch (error) {
            showError('Kontrol talebi güncellenemedi', error);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            Pending: 'bg-yellow-500/20 text-yellow-400',
            Approved: 'bg-green-500/20 text-green-400',
            Active: 'bg-blue-500/20 text-blue-400',
            Completed: 'bg-green-500/20 text-green-400',
            Rejected: 'bg-red-500/20 text-red-400'
        };
        const statusText = {
            Pending: 'Beklemede',
            Approved: 'Onaylı',
            Active: 'Aktif',
            Completed: 'Tamamlandı',
            Rejected: 'Reddedildi'
        };
        return (
            <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status as keyof typeof styles] || 'bg-gray-500/20 text-gray-400'}`}>
                {statusText[status as keyof typeof statusText] || status}
            </span>
        );
    };

    const getPriorityBadge = (priority: string) => {
        const styles = {
            'Düşük': 'bg-gray-500/20 text-gray-400',
            'Orta': 'bg-blue-500/20 text-blue-400',
            'Yüksek': 'bg-orange-500/20 text-orange-400',
            'Kritik': 'bg-red-500/20 text-red-400'
        };
        return (
            <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[priority as keyof typeof styles] || 'bg-gray-500/20 text-gray-400'}`}>
                {priority}
            </span>
        );
    };

    if (!maintenancePlans || !controlRequests || !engines) return <LoadingSpinner text="Kalite kontrol yükleniyor..." />;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold">Kalite Kontrol & Bakım Yönetimi</h1>
                    <p className="text-brand-light">Motor sağlığı, bakım planları ve kalite kontrollerini takip edin</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setCreateControlModalOpen(true)}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md flex items-center space-x-2 transition-colors"
                    >
                        <PlusIcon />
                        <span>Kontrol Talebi</span>
                    </button>
                    <button
                        onClick={() => setCreateMaintenanceModalOpen(true)}
                        className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md flex items-center space-x-2 transition-colors"
                    >
                        <PlusIcon />
                        <span>Bakım Planı</span>
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-brand-card p-4 rounded-lg border border-red-500/30">
                    <p className="text-red-400 text-sm font-semibold">🔴 KRİTİK</p>
                    <p className="text-3xl font-bold text-white">{kpis.critical}</p>
                    <p className="text-brand-light text-xs">Life limit aşıldı</p>
                </div>
                <div className="bg-brand-card p-4 rounded-lg border border-yellow-500/30">
                    <p className="text-yellow-400 text-sm font-semibold">⚠️ UYARILAR</p>
                    <p className="text-3xl font-bold text-white">{kpis.warnings}</p>
                    <p className="text-brand-light text-xs">Yaklaşan bakımlar</p>
                </div>
                <div className="bg-brand-card p-4 rounded-lg border border-blue-500/30">
                    <p className="text-blue-400 text-sm font-semibold">📅 BUGÜN</p>
                    <p className="text-3xl font-bold text-white">{kpis.today}</p>
                    <p className="text-brand-light text-xs">Yapılacak işler</p>
                </div>
                <div className="bg-brand-card p-4 rounded-lg border border-orange-500/30">
                    <p className="text-orange-400 text-sm font-semibold">⏰ GECİKEN</p>
                    <p className="text-3xl font-bold text-white">{kpis.overdue}</p>
                    <p className="text-brand-light text-xs">Süresi geçmiş</p>
                </div>
            </div>

            {/* Main Tabs */}
            <div className="flex space-x-2 border-b border-brand-border">
                <button
                    onClick={() => setActiveMainTab('maintenance')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        activeMainTab === 'maintenance' 
                            ? 'border-b-2 border-brand-primary text-brand-primary' 
                            : 'text-brand-light hover:text-white'
                    }`}
                >
                    🔧 Bakım Planları
                </button>
                <button
                    onClick={() => setActiveMainTab('life-limits')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        activeMainTab === 'life-limits' 
                            ? 'border-b-2 border-brand-primary text-brand-primary' 
                            : 'text-brand-light hover:text-white'
                    }`}
                >
                    ⚠️ Ömür Limitleri ({lifeLimitAlerts?.length || 0})
                </button>
                <button
                    onClick={() => setActiveMainTab('controls')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        activeMainTab === 'controls' 
                            ? 'border-b-2 border-brand-primary text-brand-primary' 
                            : 'text-brand-light hover:text-white'
                    }`}
                >
                    🔍 Kontroller
                </button>
            </div>

            {/* Content based on active tab */}
            {activeMainTab === 'maintenance' && (
                <div className="space-y-4">
                    {/* Maintenance Sub Tabs */}
                    <div className="flex space-x-2 border-b border-brand-border/50">
                        <button
                            onClick={() => setMaintenanceSubTab('one-time')}
                            className={`px-3 py-2 text-sm font-semibold transition-colors ${
                                maintenanceSubTab === 'one-time' 
                                    ? 'border-b-2 border-blue-400 text-blue-400' 
                                    : 'text-brand-light hover:text-white'
                            }`}
                        >
                            📅 Tek Seferlik
                        </button>
                        <button
                            onClick={() => setMaintenanceSubTab('periodic')}
                            className={`px-3 py-2 text-sm font-semibold transition-colors ${
                                maintenanceSubTab === 'periodic' 
                                    ? 'border-b-2 border-blue-400 text-blue-400' 
                                    : 'text-brand-light hover:text-white'
                            }`}
                        >
                            🔄 Periyodik
                        </button>
                    </div>

                    {/* One-time or Periodic content */}
                    {maintenanceSubTab === 'one-time' && (
                        <div>
                            <div className="flex space-x-2 mb-4">
                                <button
                                    onClick={() => setOneTimeTab('pending')}
                                    className={`px-3 py-1 text-sm rounded transition-colors ${
                                        oneTimeTab === 'pending'
                                            ? 'bg-brand-primary text-white'
                                            : 'bg-brand-dark text-brand-light hover:text-white'
                                    }`}
                                >
                                    ⏳ Bekleyen ({filteredMaintenancePlans.filter((_, i, arr) => oneTimeTab === 'pending' ? true : false).length})
                                </button>
                                <button
                                    onClick={() => setOneTimeTab('completed')}
                                    className={`px-3 py-1 text-sm rounded transition-colors ${
                                        oneTimeTab === 'completed'
                                            ? 'bg-brand-primary text-white'
                                            : 'bg-brand-dark text-brand-light hover:text-white'
                                    }`}
                                >
                                    ✅ Tamamlanan
                                </button>
                            </div>

                            {/* Table */}
                            <div className="bg-brand-card rounded-lg border border-brand-border">
                                <div className="p-4 border-b border-brand-border">
                                    <h3 className="text-lg font-bold text-white mb-2">
                                        Tek Seferlik Bakımlar - {oneTimeTab === 'pending' ? 'Bekleyen' : 'Tamamlanan'}
                                    </h3>
                                    <SearchFilter
                                        searchTerm={searchTerm}
                                        onSearchChange={setSearchTerm}
                                        placeholder="Motor, bakım tipi veya açıklamaya göre ara..."
                                    />
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="border-b border-brand-border bg-brand-dark">
                                            <tr>
                                                <th className="p-3 font-semibold">MOTOR</th>
                                                <th className="p-3 font-semibold">BAKIM TİPİ</th>
                                                <th className="p-3 font-semibold">PLANLI TARİH</th>
                                                {oneTimeTab === 'pending' && <th className="p-3 font-semibold">DURUM</th>}
                                                {oneTimeTab === 'completed' && <th className="p-3 font-semibold">TAMAMLANMA</th>}
                                                <th className="p-3 font-semibold">OLUŞTURAN</th>
                                                <th className="p-3 font-semibold">İŞLEM</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredMaintenancePlans.map(plan => {
                                                const engine = engines?.find(e => e.id === plan.engineId);
                                                const schedDate = parseFlexibleDate(plan.scheduledDate);
                                                const isOverdue = schedDate != null && schedDate < new Date() && oneTimeTab === 'pending';
                                                
                                                return (
                                                    <tr key={plan.id} className="border-b border-brand-border hover:bg-brand-dark transition-colors">
                                                        <td className="p-3 font-semibold">{engine?.serialNumber || 'N/A'}</td>
                                                        <td className="p-3">{plan.planType}</td>
                                                        <td className="p-3">
                                                            {formatStoredDate(plan.scheduledDate, 'dd.MM.yyyy')}
                                                            {isOverdue && <span className="ml-2 text-red-400 text-xs">🔴 Gecikti</span>}
                                                        </td>
                                                        {oneTimeTab === 'pending' && (
                                                            <td className="p-3">{getStatusBadge(plan.status)}</td>
                                                        )}
                                                        {oneTimeTab === 'completed' && (
                                                            <td className="p-3 text-brand-light text-xs">
                                                                {plan.approvedAt ? formatStoredDate(plan.approvedAt, 'dd.MM.yyyy') : '-'}
                                                            </td>
                                                        )}
                                                        <td className="p-3 text-brand-light">{plan.createdBy}</td>
                                                        <td className="p-3">
                                                            <button
                                                                onClick={() => setDetailModal({ isOpen: true, type: 'maintenance', data: plan })}
                                                                className="text-brand-primary hover:text-blue-400 transition-colors"
                                                            >
                                                                Detay
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    {filteredMaintenancePlans.length === 0 && (
                                        <div className="p-12 text-center text-brand-light">
                                            {searchTerm ? 'Aramanızla eşleşen bakım planı bulunamadı.' : 'Bakım planı bulunamadı.'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {maintenanceSubTab === 'periodic' && (
                        <div>
                            <div className="flex space-x-2 mb-4">
                                <button
                                    onClick={() => setPeriodicTab('pending')}
                                    className={`px-3 py-1 text-sm rounded transition-colors ${
                                        periodicTab === 'pending'
                                            ? 'bg-brand-primary text-white'
                                            : 'bg-brand-dark text-brand-light hover:text-white'
                                    }`}
                                >
                                    ⏳ Vakti Gelmiş ({duePlans?.filter(p => p.maintenanceType === 'periodic').length || 0})
                                </button>
                                <button
                                    onClick={() => setPeriodicTab('completed')}
                                    className={`px-3 py-1 text-sm rounded transition-colors ${
                                        periodicTab === 'completed'
                                            ? 'bg-brand-primary text-white'
                                            : 'bg-brand-dark text-brand-light hover:text-white'
                                    }`}
                                >
                                    ✅ Tamamlanan
                                </button>
                                <button
                                    onClick={() => setPeriodicTab('planned')}
                                    className={`px-3 py-1 text-sm rounded transition-colors ${
                                        periodicTab === 'planned'
                                            ? 'bg-brand-primary text-white'
                                            : 'bg-brand-dark text-brand-light hover:text-white'
                                    }`}
                                >
                                    📆 Planlananlar
                                </button>
                            </div>

                            {/* Periodic Table */}
                            <div className="bg-brand-card rounded-lg border border-brand-border">
                                <div className="p-4 border-b border-brand-border">
                                    <h3 className="text-lg font-bold text-white mb-2">
                                        Periyodik Bakımlar - {
                                            periodicTab === 'pending' ? 'Vakti Gelmiş' : 
                                            periodicTab === 'completed' ? 'Tamamlanan' : 
                                            'Gelecek Bakımlar'
                                        }
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="border-b border-brand-border bg-brand-dark">
                                            <tr>
                                                <th className="p-3 font-semibold">MOTOR</th>
                                                <th className="p-3 font-semibold">BAKIM TİPİ</th>
                                                <th className="p-3 font-semibold">PERİYOT</th>
                                                {periodicTab === 'pending' && <th className="p-3 font-semibold">AŞIM</th>}
                                                {periodicTab === 'planned' && <th className="p-3 font-semibold">SONRAKİ</th>}
                                                {periodicTab === 'completed' && <th className="p-3 font-semibold">TAMAMLANMA</th>}
                                                <th className="p-3 font-semibold">İŞLEM</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredMaintenancePlans.map(plan => {
                                                const engine = engines?.find(e => e.id === plan.engineId);
                                                const overdue = (plan as any).overdueHours || 0;
                                                
                                                return (
                                                    <tr key={plan.id} className="border-b border-brand-border hover:bg-brand-dark transition-colors">
                                                        <td className="p-3 font-semibold">{engine?.serialNumber || 'N/A'}</td>
                                                        <td className="p-3">{plan.planType}</td>
                                                        <td className="p-3">
                                                            {plan.periodicIntervalHours ? `${plan.periodicIntervalHours}h` : '-'}
                                                            {plan.periodicIntervalCycles ? ` / ${plan.periodicIntervalCycles}c` : ''}
                                                        </td>
                                                        {periodicTab === 'pending' && (
                                                            <td className="p-3">
                                                                <span className={overdue > 10 ? 'text-red-400 font-semibold' : 'text-yellow-400'}>
                                                                    +{overdue.toFixed(1)}h {overdue > 10 ? '🔴' : '⚠️'}
                                                                </span>
                                                            </td>
                                                        )}
                                                        {periodicTab === 'planned' && (
                                                            <td className="p-3 text-brand-light">
                                                                {plan.nextDueHours ? `${plan.nextDueHours}h` : '-'}
                                                            </td>
                                                        )}
                                                        {periodicTab === 'completed' && (
                                                            <td className="p-3 text-brand-light text-xs">
                                                                {plan.approvedAt ? formatStoredDate(plan.approvedAt, 'dd.MM.yyyy') : '-'}
                                                            </td>
                                                        )}
                                                        <td className="p-3">
                                                            <button
                                                                onClick={() => setDetailModal({ isOpen: true, type: 'maintenance', data: plan })}
                                                                className="text-brand-primary hover:text-blue-400 transition-colors"
                                                            >
                                                                Detay
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    {filteredMaintenancePlans.length === 0 && (
                                        <div className="p-12 text-center text-brand-light">
                                            {periodicTab === 'pending' ? 'Vakti gelmiş periyodik bakım bulunmuyor.' : 
                                             periodicTab === 'completed' ? 'Tamamlanmış periyodik bakım bulunmuyor.' :
                                             'Aktif periyodik plan bulunmuyor.'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeMainTab === 'life-limits' && (
                <div>
                    <div className="flex space-x-2 mb-4">
                        <button
                            onClick={() => setLifeLimitsTab('pending')}
                            className={`px-3 py-1 text-sm rounded transition-colors ${
                                lifeLimitsTab === 'pending'
                                    ? 'bg-brand-primary text-white'
                                    : 'bg-brand-dark text-brand-light hover:text-white'
                            }`}
                        >
                            🔴 Bekleyen ({filteredLifeLimitAlerts.length})
                        </button>
                        <button
                            onClick={() => setLifeLimitsTab('completed')}
                            className={`px-3 py-1 text-sm rounded transition-colors ${
                                lifeLimitsTab === 'completed'
                                    ? 'bg-brand-primary text-white'
                                    : 'bg-brand-dark text-brand-light hover:text-white'
                            }`}
                        >
                            ✅ Tamamlanan
                        </button>
                    </div>

                    <div className="bg-brand-card rounded-lg border border-brand-border">
                        <div className="p-4 border-b border-brand-border">
                            <h3 className="text-lg font-bold text-white">
                                Ömür Limiti Uyarıları - {lifeLimitsTab === 'pending' ? 'Bekleyen' : 'Tamamlanan'}
                            </h3>
                            {lifeLimitsTab === 'pending' && (
                                <p className="text-sm text-brand-light mt-1">
                                    🔴 Kritik: {filteredLifeLimitAlerts.filter(a => a.status === 'critical').length} | 
                                    ⚠️ Uyarı: {filteredLifeLimitAlerts.filter(a => a.status === 'warning').length}
                                </p>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-brand-border bg-brand-dark">
                                    <tr>
                                        <th className="p-3 font-semibold">MOTOR</th>
                                        <th className="p-3 font-semibold">PARÇA</th>
                                        <th className="p-3 font-semibold">PARÇA NO</th>
                                        <th className="p-3 font-semibold">MEVCUT</th>
                                        <th className="p-3 font-semibold">LİMİT</th>
                                        <th className="p-3 font-semibold">KALAN</th>
                                        <th className="p-3 font-semibold">DURUM</th>
                                        <th className="p-3 font-semibold">İŞLEM</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLifeLimitAlerts.map((alert, idx) => (
                                        <tr key={idx} className="border-b border-brand-border hover:bg-brand-dark transition-colors">
                                            <td className="p-3 font-semibold">{alert.engineSerialNumber}</td>
                                            <td className="p-3">{alert.description}</td>
                                            <td className="p-3 text-brand-light">{alert.partNumber}</td>
                                            <td className="p-3">{alert.currentHours.toFixed(1)}h</td>
                                            <td className="p-3">{alert.lifeLimit}h</td>
                                            <td className="p-3">
                                                <span className={alert.remaining <= 0 ? 'text-red-400 font-semibold' : 'text-yellow-400'}>
                                                    {alert.remaining.toFixed(1)}h
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                {alert.status === 'critical' ? '🔴 Kritik' : '⚠️ Uyarı'}
                                            </td>
                                            <td className="p-3">
                                                <button
                                                    onClick={() => setDetailModal({ isOpen: true, type: 'life-limit', data: alert })}
                                                    className="text-brand-primary hover:text-blue-400 transition-colors"
                                                >
                                                    Detay
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredLifeLimitAlerts.length === 0 && (
                                <div className="p-12 text-center text-brand-light">
                                    {lifeLimitsTab === 'pending' ? 'Ömür limiti uyarısı bulunmuyor.' : 'Tamamlanmış aksiyon bulunmuyor.'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeMainTab === 'controls' && (
                <div>
                    <div className="flex space-x-2 mb-4">
                        <button
                            onClick={() => setControlsTab('pending')}
                            className={`px-3 py-1 text-sm rounded transition-colors ${
                                controlsTab === 'pending'
                                    ? 'bg-brand-primary text-white'
                                    : 'bg-brand-dark text-brand-light hover:text-white'
                            }`}
                        >
                            ⏳ Bekleyen ({filteredControlRequests.length})
                        </button>
                        <button
                            onClick={() => setControlsTab('completed')}
                            className={`px-3 py-1 text-sm rounded transition-colors ${
                                controlsTab === 'completed'
                                    ? 'bg-brand-primary text-white'
                                    : 'bg-brand-dark text-brand-light hover:text-white'
                            }`}
                        >
                            ✅ Tamamlanan
                        </button>
                    </div>

                    <div className="bg-brand-card rounded-lg border border-brand-border">
                        <div className="p-4 border-b border-brand-border">
                            <h3 className="text-lg font-bold text-white mb-2">
                                Kontrol Talepleri - {controlsTab === 'pending' ? 'Bekleyen' : 'Tamamlanan'}
                            </h3>
                            <SearchFilter
                                searchTerm={searchTerm}
                                onSearchChange={setSearchTerm}
                                placeholder="Motor, kontrol tipi veya açıklamaya göre ara..."
                            />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-brand-border bg-brand-dark">
                                    <tr>
                                        <th className="p-3 font-semibold">MOTOR</th>
                                        <th className="p-3 font-semibold">KONTROL TİPİ</th>
                                        <th className="p-3 font-semibold">ÖNCELİK</th>
                                        <th className="p-3 font-semibold">TALEP TARİHİ</th>
                                        <th className="p-3 font-semibold">TALEP EDEN</th>
                                        <th className="p-3 font-semibold">DURUM</th>
                                        <th className="p-3 font-semibold">İŞLEM</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredControlRequests.map(request => {
                                        const engine = engines?.find(e => e.id === request.engineId);
                                        return (
                                            <tr key={request.id} className="border-b border-brand-border hover:bg-brand-dark transition-colors">
                                                <td className="p-3 font-semibold">{engine?.serialNumber || 'N/A'}</td>
                                                <td className="p-3">{request.controlType}</td>
                                                <td className="p-3">{getPriorityBadge(request.priority)}</td>
                                                <td className="p-3">{formatStoredDate(request.requestDate, 'dd.MM.yyyy')}</td>
                                                <td className="p-3 text-brand-light">{request.createdBy}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                        request.status === 'Beklemede' ? 'bg-yellow-500/20 text-yellow-400' :
                                                        request.status === 'İşlemde' ? 'bg-blue-500/20 text-blue-400' :
                                                        request.status === 'Tamamlandı' ? 'bg-green-500/20 text-green-400' :
                                                        'bg-gray-500/20 text-gray-400'
                                                    }`}>
                                                        {request.status}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <button
                                                        onClick={() => setDetailModal({ isOpen: true, type: 'control', data: request })}
                                                        className="text-brand-primary hover:text-blue-400 transition-colors"
                                                    >
                                                        Detay
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {filteredControlRequests.length === 0 && (
                                <div className="p-12 text-center text-brand-light">
                                    {searchTerm ? 'Aramanızla eşleşen kontrol talebi bulunamadı.' : 
                                     controlsTab === 'pending' ? 'Bekleyen kontrol talebi bulunmuyor.' :
                                     'Tamamlanmış kontrol talebi bulunmuyor.'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Create Maintenance Modal */}
            {isCreateMaintenanceModalOpen && (
                <Modal isOpen={isCreateMaintenanceModalOpen} onClose={() => setCreateMaintenanceModalOpen(false)} title="Bakım Planı Oluştur">
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
                                    {e.serialNumber} - {e.model} ({e.totalHours}h)
                                </option>
                            ))}
                        </select>

                        <div>
                            <label className="block text-sm font-semibold text-brand-light mb-2">Bakım Tipi</label>
                            <select
                                value={newPlan.maintenanceType}
                                onChange={(e) => setNewPlan({...newPlan, maintenanceType: e.target.value as 'one-time' | 'periodic'})}
                                className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                                required
                            >
                                <option value="one-time">Tek Seferlik</option>
                                <option value="periodic">Periyodik</option>
                            </select>
                        </div>

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

                        {newPlan.maintenanceType === 'one-time' && (
                            <input
                                type="date"
                                value={newPlan.scheduledDate}
                                onChange={(e) => setNewPlan({...newPlan, scheduledDate: e.target.value})}
                                className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                                required
                            />
                        )}

                        {newPlan.maintenanceType === 'periodic' && (
                            <div>
                                <label className="block text-sm font-semibold text-brand-light mb-2">
                                    Periyodik Aralık (En az birini girin)
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={newPlan.periodicIntervalHours}
                                        onChange={(e) => setNewPlan({...newPlan, periodicIntervalHours: e.target.value})}
                                        placeholder="Her X Saatte Bir"
                                        className="bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                                    />
                                    <input
                                        type="number"
                                        value={newPlan.periodicIntervalCycles}
                                        onChange={(e) => setNewPlan({...newPlan, periodicIntervalCycles: e.target.value})}
                                        placeholder="Her X Çevrimde Bir"
                                        className="bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                                    />
                                </div>
                            </div>
                        )}

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

                        <div className="bg-green-500/10 border border-green-500/30 rounded-md p-3 text-sm">
                            <p className="text-green-400 font-semibold">✓ Otomatik Onay</p>
                            <p className="text-brand-light text-xs mt-1">
                                Bu plan oluşturulduğunda otomatik olarak onaylanacaktır.
                            </p>
                        </div>

                        <button type="submit" className="w-full bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md transition-colors">
                            Bakım Planı Oluştur
                        </button>
                    </form>
                </Modal>
            )}

            {/* Create Control Request Modal */}
            {isCreateControlModalOpen && (
                <Modal isOpen={isCreateControlModalOpen} onClose={() => setCreateControlModalOpen(false)} title="Kontrol Talebi Oluştur">
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

                        <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
                            Kontrol Talebi Oluştur
                        </button>
                    </form>
                </Modal>
            )}

            {/* Detail Modals - simplified for now */}
            {detailModal.isOpen && detailModal.type === 'maintenance' && (
                <Modal isOpen={detailModal.isOpen} onClose={() => setDetailModal({ isOpen: false, type: null, data: null })} title="Bakım Planı Detayı">
                    <MaintenanceDetailModal plan={detailModal.data} engines={engines} canModify={canModify} onComplete={handleCompleteMaintenance} />
                </Modal>
            )}

            {detailModal.isOpen && detailModal.type === 'control' && (
                <Modal isOpen={detailModal.isOpen} onClose={() => setDetailModal({ isOpen: false, type: null, data: null })} title="Kontrol Talebi Detayı">
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm text-brand-light">Motor</p>
                            <p className="text-white font-semibold">
                                {engines?.find(e => e.id === detailModal.data.engineId)?.serialNumber}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-brand-light">Kontrol Tipi</p>
                            <p className="text-white">{detailModal.data.controlType}</p>
                        </div>
                        <div>
                            <p className="text-sm text-brand-light">Açıklama</p>
                            <p className="text-white">{detailModal.data.description}</p>
                        </div>
                        <div>
                            <p className="text-sm text-brand-light">Öncelik</p>
                            {getPriorityBadge(detailModal.data.priority)}
                        </div>
                        {canModify && detailModal.data.status !== 'Tamamlandı' && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleUpdateControlStatus(detailModal.data.id, 'İşlemde')}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
                                >
                                    İşlemde
                                </button>
                                <button
                                    onClick={() => handleUpdateControlStatus(detailModal.data.id, 'Tamamlandı')}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
                                >
                                    ✅ Tamamlandı
                                </button>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {detailModal.isOpen && detailModal.type === 'life-limit' && (
                <Modal isOpen={detailModal.isOpen} onClose={() => setDetailModal({ isOpen: false, type: null, data: null })} title="Ömür Limiti Uyarısı">
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm text-brand-light">Motor</p>
                            <p className="text-white font-semibold">{detailModal.data.engineSerialNumber}</p>
                        </div>
                        <div>
                            <p className="text-sm text-brand-light">Parça</p>
                            <p className="text-white">{detailModal.data.description}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-brand-light">Mevcut Saat</p>
                                <p className="text-white font-semibold">{detailModal.data.currentHours.toFixed(1)}h</p>
                            </div>
                            <div>
                                <p className="text-sm text-brand-light">Life Limit</p>
                                <p className="text-white font-semibold">{detailModal.data.lifeLimit}h</p>
                            </div>
                        </div>
                        <div>
                            <p className="text-sm text-brand-light">Kalan</p>
                            <p className={`text-2xl font-bold ${detailModal.data.remaining <= 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                                {detailModal.data.remaining.toFixed(1)}h {detailModal.data.status === 'critical' ? '🔴' : '⚠️'}
                            </p>
                        </div>
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 text-sm">
                            <p className="text-yellow-400 font-semibold">⚠️ Aksiyon Gerekiyor</p>
                            <p className="text-brand-light text-xs mt-1">
                                Bu parça ömrünü doldurmuş veya doldurmak üzere. Montaj sekmesinden parça değişimi yapılmalı.
                            </p>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

// SearchFilter component (inline for simplicity)
const SearchFilter: React.FC<{ searchTerm: string; onSearchChange: (term: string) => void; placeholder: string }> = ({ 
    searchTerm, 
    onSearchChange, 
    placeholder 
}) => {
    return (
        <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-light w-4 h-4" />
            <input
                type="text"
                placeholder={placeholder}
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-brand-dark border border-brand-border rounded-md text-white placeholder-brand-light focus:outline-none focus:border-brand-primary"
            />
        </div>
    );
};

export default QualityControl;
