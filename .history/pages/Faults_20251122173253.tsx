import React, { useState } from 'react';
import { useQuery, useRefetch } from '../hooks/useData';
import { faultsApi, enginesApi, documentsApi } from '../lib/client.ts';
import { documentsApi as newDocsApi } from '../lib/newApis.ts';
import { useAuth } from '../context/AuthContext';
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
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'Open' | 'Solved'>('all');
    const [severityFilter, setSeverityFilter] = useState<'all' | 'Critical' | 'Major' | 'Minor'>('all');

    const canModify = user?.role === 'Administrator' || user?.role === 'Fault Coordinator';
    const canLog = canModify || user?.role === 'Test Engineer';

    const [newFault, setNewFault] = useState({
        engineId: 0,
        description: '',
        severity: Severity.Minor,
        assignedTo: '',
    });

    const handleLogSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newFault.engineId) {
            showError('Lütfen bir motor seçin');
            return;
        }
        try {
            const createdFault = await faultsApi.create({
                engineId: newFault.engineId,
                description: newFault.description,
                severity: newFault.severity,
                reportDate: new Date().toISOString(),
                status: 'Open',
                userName: user.fullName,
                assignedTo: newFault.assignedTo.trim() || undefined,
            });
            
            // Upload documents if any
            if (uploadedFiles.length > 0 && createdFault.id) {
                for (const file of uploadedFiles) {
                    await newDocsApi.upload(file, {
                        relatedType: 'fault',
                        relatedId: createdFault.id,
                        uploadedBy: user.fullName
                    });
                }
            }
            
            setNewFault({ engineId: 0, description: '', severity: Severity.Minor, assignedTo: '' });
            setUploadedFiles([]);
            showSuccess('Arıza başarıyla kaydedildi!');
            refetch();
        } catch (error) {
            showError('Arıza kaydedilemedi');
            console.error(error);
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
                showSuccess('Arıza başarıyla silindi!');
                refetch();
            } catch (error) {
                showError('Arıza silinemedi');
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
            showSuccess('Arıza başarıyla güncellendi!');
            setEditModalOpen(false);
            setEditingFault(null);
            refetch();
        } catch (error) {
            showError('Arıza güncellenemedi');
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

    const getSeverityLabel = (severity: Severity) => {
        switch (severity) {
            case Severity.Critical: return 'Kritik';
            case Severity.Major: return 'Majör';
            case Severity.Minor: return 'Minör';
            default: return severity;
        }
    };

    const getStatusClass = (status: 'Open' | 'Solved') => {
        return status === 'Open' 
            ? 'text-orange-500 bg-orange-500/10' 
            : 'text-green-500 bg-green-500/10';
    };

    const getStatusLabel = (status: 'Open' | 'Solved') => {
        return status === 'Open' ? 'Açık' : 'Çözüldü';
    };

    if (!faults || !engines) return <LoadingSpinner text="Arızalar yükleniyor..." />;

    // Filter faults based on search term, status and severity
    const filteredFaults = faults?.filter(fault => {
        // Status filter
        if (statusFilter !== 'all' && fault.status !== statusFilter) return false;
        
        // Severity filter
        if (severityFilter !== 'all' && fault.severity !== severityFilter) return false;
        
        // Search filter
        if (!searchTerm) return true;
        
        const searchLower = searchTerm.toLowerCase();
        const engine = engines?.find(e => e.id === fault.engineId);
        
        return (
            engine?.serialNumber.toLowerCase().includes(searchLower) ||
            fault.description.toLowerCase().includes(searchLower) ||
            fault.userName.toLowerCase().includes(searchLower) ||
            fault.assignedTo?.toLowerCase().includes(searchLower) ||
            getSeverityLabel(fault.severity).toLowerCase().includes(searchLower) ||
            getStatusLabel(fault.status).toLowerCase().includes(searchLower) ||
            new Date(fault.reportDate).toLocaleDateString('tr-TR').includes(searchLower)
        );
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Arıza Bildirimi</h1>
                    <p className="text-brand-light">Motor veya bileşen arızalarını kaydedin ve takip edin.</p>
                </div>
            </div>
            
            {canLog && (
                 <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
                    <h2 className="text-lg font-bold text-white mb-4">Yeni Arıza Bildir</h2>
                    <form onSubmit={handleLogSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <select
                                value={newFault.engineId}
                                onChange={(e) => setNewFault(prev => ({ ...prev, engineId: parseInt(e.target.value) }))}
                                className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                                required
                            >
                                <option value={0}>-- Motor Seçin --</option>
                                {engines?.map(e => <option key={e.id} value={e.id}>{e.serialNumber}</option>)}
                            </select>
                            
                            <select
                                value={newFault.severity}
                                onChange={(e) => setNewFault(prev => ({...prev, severity: e.target.value as Severity}))}
                                className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            >
                                <option value={Severity.Minor}>Minör</option>
                                <option value={Severity.Major}>Majör</option>
                                <option value={Severity.Critical}>Kritik</option>
                            </select>
                        </div>
                        
                        <textarea
                            value={newFault.description}
                            onChange={(e) => setNewFault(prev => ({...prev, description: e.target.value}))}
                            placeholder="Arıza Açıklaması (örn: Türbin yatağı #2'den yağ sızıntısı gözlemlendi)"
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                            rows={4} 
                            required
                        ></textarea>
                        
                        <input
                            type="text"
                            value={newFault.assignedTo || ''}
                            onChange={(e) => setNewFault(prev => ({...prev, assignedTo: e.target.value}))}
                            placeholder="Sorumlu Kişi (Opsiyonel)"
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                        />
                        
                        <div>
                            <label className="block text-sm font-medium text-brand-light mb-2">
                                Döküman Ekle (Opsiyonel)
                            </label>
                            <input 
                                type="file" 
                                multiple 
                                onChange={(e) => {
                                    if (e.target.files) {
                                        setUploadedFiles(Array.from(e.target.files));
                                    }
                                }}
                                className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            />
                            {uploadedFiles.length > 0 && (
                                <p className="text-sm text-brand-light mt-1">
                                    {uploadedFiles.length} dosya seçildi
                                </p>
                            )}
                        </div>
                        
                        <button type="submit" className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">
                            Arıza Kaydet
                        </button>
                    </form>
                </div>
            )}
            
            <div className="bg-brand-card rounded-lg border border-brand-border">
                <div className="p-4 border-b border-brand-border">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <h2 className="text-lg font-bold text-white">Son Arıza Raporları</h2>
                        
                        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                            {/* Status Filter */}
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'Open' | 'Solved')}
                                className="bg-brand-dark border border-brand-border rounded-md py-2 px-4 text-white focus:outline-none focus:border-brand-primary"
                            >
                                <option value="all">Tüm Durumlar</option>
                                <option value="Open">Açık</option>
                                <option value="Solved">Çözüldü</option>
                            </select>
                            
                            {/* Severity Filter */}
                            <select
                                value={severityFilter}
                                onChange={(e) => setSeverityFilter(e.target.value as 'all' | 'Critical' | 'Major' | 'Minor')}
                                className="bg-brand-dark border border-brand-border rounded-md py-2 px-4 text-white focus:outline-none focus:border-brand-primary"
                            >
                                <option value="all">Tüm Dereceler</option>
                                <option value="Critical">Kritik</option>
                                <option value="Major">Majör</option>
                                <option value="Minor">Minör</option>
                            </select>
                            
                            {/* Search Input */}
                            <div className="relative w-full md:w-80">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Motor, açıklama, kişi ile ara..."
                                    className="w-full bg-brand-dark border border-brand-border rounded-md py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:border-brand-primary"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {(searchTerm || statusFilter !== 'all' || severityFilter !== 'all') && (
                        <p className="text-sm text-brand-light mt-3">
                            {filteredFaults?.length || 0} sonuç bulundu
                        </p>
                    )}
                </div>
                
                <div className="overflow-x-auto">
                     <table className="w-full text-left text-sm">
                        <thead className="border-b border-brand-border bg-brand-dark">
                            <tr>
                                <th className="p-3 font-semibold">TARİH & SAAT</th>
                                <th className="p-3 font-semibold">MOTOR</th>
                                <th className="p-3 font-semibold">AÇIKLAMA</th>
                                <th className="p-3 font-semibold">CİDDİYET</th>
                                <th className="p-3 font-semibold">DURUM</th>
                                <th className="p-3 font-semibold">BİLDİREN</th>
                                <th className="p-3 font-semibold">SORUMLU</th>
                                <th className="p-3 font-semibold">DÖKÜMAN</th>
                                {canModify && <th className="p-3 font-semibold">İŞLEMLER</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredFaults && filteredFaults.length > 0 ? (
                                filteredFaults.map(fault => (
                                    <tr key={fault.id} className="border-b border-brand-border hover:bg-brand-dark">
                                        <td className="p-3 whitespace-nowrap">
                                            <div className="text-white">{new Date(fault.reportDate).toLocaleDateString('tr-TR')}</div>
                                            <div className="text-xs text-brand-light">{new Date(fault.reportDate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td className="p-3">{engines?.find(e => e.id === fault.engineId)?.serialNumber}</td>
                                        <td className="p-3 max-w-md">
                                            <div className="truncate" title={fault.description}>
                                                {fault.description}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded-full font-semibold text-xs whitespace-nowrap ${getSeverityClass(fault.severity)}`}>
                                                {getSeverityLabel(fault.severity)}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded-full font-semibold text-xs whitespace-nowrap ${getStatusClass(fault.status)}`}>
                                                {getStatusLabel(fault.status)}
                                            </span>
                                        </td>
                                        <td className="p-3 text-brand-light">{fault.userName}</td>
                                        <td className="p-3">
                                            {fault.assignedTo ? (
                                                <span className="font-semibold text-brand-primary">{fault.assignedTo}</span>
                                            ) : (
                                                <span className="text-gray-500">-</span>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            {fault.documentId && (
                                                <button 
                                                    onClick={async () => {
                                                        try {
                                                            const blob = await newDocsApi.download(fault.documentId!);
                                                            const doc = await documentsApi.getById(fault.documentId!);
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
                                                            showError('Döküman indirilemedi');
                                                        }
                                                    }}
                                                    className="text-brand-primary hover:text-blue-400"
                                                >
                                                    <PaperclipIcon />
                                                </button>
                                            )}
                                        </td>
                                        {canModify && (
                                            <td className="p-3 flex space-x-4">
                                                <button onClick={() => handleEdit(fault)} className="text-brand-light hover:text-white">
                                                    <PencilIcon />
                                                </button>
                                                <button onClick={() => handleDelete(fault.id!)} className="text-brand-danger hover:text-red-400">
                                                    <TrashIcon />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={canModify ? 9 : 8} className="p-8 text-center text-brand-light">
                                        {searchTerm || statusFilter !== 'all' 
                                            ? 'Arama kriterlerine uygun arıza bulunamadı' 
                                            : 'Henüz arıza kaydı bulunmuyor'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isEditModalOpen && editingFault && (
                <Modal isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} title="Arıza Raporunu Düzenle">
                    <form onSubmit={handleUpdateFault} className="space-y-4">
                        <textarea 
                            value={editingFault.description} 
                            onChange={(e) => setEditingFault({...editingFault, description: e.target.value})}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            rows={4}
                        />
                        
                        <select
                            value={editingFault.severity}
                            onChange={(e) => setEditingFault(prev => ({...prev!, severity: e.target.value as Severity}))}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                        >
                            <option value={Severity.Minor}>Minör</option>
                            <option value={Severity.Major}>Majör</option>
                            <option value={Severity.Critical}>Kritik</option>
                        </select>
                        
                        <select
                            value={editingFault.status}
                            onChange={(e) => setEditingFault(prev => ({...prev!, status: e.target.value as 'Open' | 'Solved'}))}
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                        >
                            <option value="Open">Açık</option>
                            <option value="Solved">Çözüldü</option>
                        </select>
                        
                        <input
                            type="text"
                            value={editingFault.assignedTo || ''}
                            onChange={(e) => setEditingFault(prev => ({...prev!, assignedTo: e.target.value}))}
                            placeholder="Sorumlu Kişi"
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                        />
                        
                        <button type="submit" className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">
                            Değişiklikleri Kaydet
                        </button>
                    </form>
                </Modal>
            )}
            
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                title="Arıza Sil"
                message="Bu arıza raporunu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
                confirmText="Sil"
                cancelText="İptal"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
                variant="danger"
            />
        </div>
    );
};

export default Faults;
