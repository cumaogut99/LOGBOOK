import React, { useState, useMemo } from 'react';
import { useQuery, useRefetch } from '../hooks/useData';
import { testsApi, enginesApi, inventoryApi } from '../lib/client.ts';
import { testTypesApi, brakeTypesApi, documentsApi as newDocsApi } from '../lib/newApis.ts';
import { useAuth } from '../context/AuthContext';
import type { Test, TestType, BrakeType } from '../types';
import { PencilIcon, TrashIcon, PaperclipIcon, PlusIcon } from '../constants';
import Modal from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { showSuccess, showError, showWarning } from '../utils/toast';
import { updateComponentHours, checkLifeLimits, generateLifeLimitMessage } from '../utils/componentUtils';
import { format } from 'date-fns';

const Tests: React.FC = () => {
    const { user } = useAuth();
    const { refreshKey, refetch } = useRefetch();
    const tests = useQuery(() => testsApi.getAll(), [refreshKey]);
    const engines = useQuery(() => enginesApi.getAll(), []);
    const inventory = useQuery(() => inventoryApi.getAll(), []);
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
    const [searchTerm, setSearchTerm] = useState('');

    // Alt montaj gruplarını topla (SADECE depodan - motor üzerindekileri gösterme)
    const assemblyGroups = useMemo(() => {
        if (!inventory) return [];
        
        const groups: Array<{ name: string; partNumber: string; serialNumber: string; location: string }> = [];
        const groupMap = new Map<string, typeof groups[0]>();

        // Sadece depodan alt montaj grupları
        inventory.forEach(item => {
            if (item.assemblyGroup && item.assemblyPartNumber && item.assemblySerialNumber) {
                const key = `${item.assemblyPartNumber}-${item.assemblySerialNumber}`;
                if (!groupMap.has(key)) {
                    groupMap.set(key, {
                        name: item.assemblyGroup,
                        partNumber: item.assemblyPartNumber,
                        serialNumber: item.assemblySerialNumber,
                        location: 'Depo'
                    });
                }
            }
        });

        return Array.from(groupMap.values());
    }, [inventory]);

    // Test logging with document upload
    const handleLogSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newTest.engineId || !newTest.duration || !newTest.testType) {
            showError('Lütfen tüm gerekli alanları doldurun');
            return;
        }
        
        try {
            const duration = parseFloat(newTest.duration);
            
            // Determine if it's an engine or assembly test
            const isEngineTest = newTest.engineId.startsWith('engine-');
            const isAssemblyTest = newTest.engineId.startsWith('assembly-');
            
            let actualEngineId: number | null = null;
            
            if (isEngineTest) {
                actualEngineId = parseInt(newTest.engineId.replace('engine-', ''));
            } else if (isAssemblyTest) {
                // Alt montaj grubu için engine ID = 0 veya null (motor dışı test)
                actualEngineId = 0;
            }
            
            // Create test
            const createdTest = await testsApi.create({
                engineId: actualEngineId!,
                testType: newTest.testType,
                brakeType: newTest.brakeType || undefined,
                testCell: newTest.testCell,
                description: newTest.description,
                duration: duration,
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
            
            // Update engine hours and components (only for engine tests)
            if (isEngineTest && actualEngineId) {
                const engine = engines?.find(e => e.id === actualEngineId);
                if (engine) {
                    // 1. Update total hours
                    const newTotalHours = (engine.totalHours || 0) + duration;
                    
                    // 2. Update total cycles (+1)
                    const newTotalCycles = (engine.totalCycles || 0) + 1;
                    
                    // 3. Update all component hours
                    const updatedComponents = updateComponentHours(engine.components, duration);
                    
                    // 4. Check life limits
                    const exceedingParts = checkLifeLimits(updatedComponents);
                    
                    // 5. Update engine
                    await enginesApi.update(engine.id!, {
                        totalHours: newTotalHours,
                        totalCycles: newTotalCycles,
                        components: updatedComponents
                    });
                    
                    // 6. Show warnings if any parts exceed life limit
                    if (exceedingParts.length > 0) {
                        const warningMessage = generateLifeLimitMessage(exceedingParts);
                        showWarning(`⚠️ ${warningMessage}`);
                    }
                    
                    showSuccess(`Test başarıyla kaydedildi! Motor: ${duration}h eklendi, tüm parça saatleri güncellendi.`);
                }
            } else if (isAssemblyTest) {
                const assemblySN = newTest.engineId.replace('assembly-', '');
                const assembly = assemblyGroups.find(a => a.serialNumber === assemblySN);
                showSuccess(`Alt montaj grubu testi başarıyla kaydedildi! Grup: ${assembly?.name || 'Bilinmiyor'} - ${duration}h`);
            }
            
            setNewTest({ engineId: '', testType: '', brakeType: '', testCell: 'Cell-01 High Alt', description: '', duration: '' });
            setUploadedFiles([]);
            refetch();
        } catch (error) {
            showError('Test kaydedilemedi');
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
            showSuccess('Test tipi başarıyla oluşturuldu!');
            refetch();
        } catch (error) {
            showError('Test tipi oluşturulamadı');
        }
    };
    
    const handleDeleteTestType = async (id: number) => {
        try {
            await testTypesApi.delete(id);
            showSuccess('Test tipi başarıyla silindi!');
            refetch();
        } catch (error) {
            showError('Test tipi silinemedi');
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
            showSuccess('Bremze tipi başarıyla oluşturuldu!');
            refetch();
        } catch (error) {
            showError('Bremze tipi oluşturulamadı');
        }
    };
    
    const handleDeleteBrakeType = async (id: number) => {
        try {
            await brakeTypesApi.delete(id);
            showSuccess('Bremze tipi başarıyla silindi!');
            refetch();
        } catch (error) {
            showError('Bremze tipi silinemedi');
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
                    showSuccess('Test başarıyla silindi!');
                } else if (deleteConfirm.type === 'testType') {
                    await handleDeleteTestType(deleteConfirm.id);
                } else if (deleteConfirm.type === 'brakeType') {
                    await handleDeleteBrakeType(deleteConfirm.id);
                }
                refetch();
            } catch (error) {
                showError(`Silme işlemi başarısız oldu`);
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
            showSuccess('Test başarıyla güncellendi!');
            setEditModalOpen(false);
            setEditingTest(null);
            refetch();
        } catch (error) {
            showError('Test güncellenemedi');
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

    if (!tests || !engines || !testTypes || !brakeTypes) return <LoadingSpinner text="Testler yükleniyor..." />;

    // Filter tests based on search term
    const filteredTests = tests?.filter(test => {
        if (!searchTerm) return true;
        
        const searchLower = searchTerm.toLowerCase();
        const engine = engines?.find(e => e.id === test.engineId);
        
        return (
            engine?.serialNumber.toLowerCase().includes(searchLower) ||
            test.testType.toLowerCase().includes(searchLower) ||
            test.brakeType?.toLowerCase().includes(searchLower) ||
            test.userName.toLowerCase().includes(searchLower) ||
            test.description.toLowerCase().includes(searchLower) ||
            test.testCell.toLowerCase().includes(searchLower) ||
            format(new Date(test.testDate), 'dd.MM.yyyy HH:mm').toLowerCase().includes(searchLower)
        );
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Test Yönetimi</h1>
                    <p className="text-brand-light">Standartlaştırılmış test faaliyetlerini tanımlayın ve kaydedin.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-2 border-b border-brand-border">
                <button
                    onClick={() => setActiveTab('tests')}
                    className={`px-4 py-2 font-semibold ${activeTab === 'tests' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-brand-light'}`}
                >
                    Test Faaliyetleri
                </button>
                {isTestEngineer && (
                    <>
                        <button
                            onClick={() => setActiveTab('testTypes')}
                            className={`px-4 py-2 font-semibold ${activeTab === 'testTypes' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-brand-light'}`}
                        >
                            Test Tipleri
                        </button>
                        <button
                            onClick={() => setActiveTab('brakeTypes')}
                            className={`px-4 py-2 font-semibold ${activeTab === 'brakeTypes' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-brand-light'}`}
                        >
                            Bremze Tipleri
                        </button>
                    </>
                )}
            </div>

            {/* Test Activities Tab */}
            {activeTab === 'tests' && (
                <>
                    {canLog && (
                        <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
                            <h2 className="text-lg font-bold text-white mb-4">Yeni Test Faaliyeti Kaydet</h2>
                            <form onSubmit={handleLogSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <select 
                                        value={newTest.engineId} 
                                        onChange={e => setNewTest({...newTest, engineId: e.target.value})} 
                                        className="bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                                        required
                                    >
                                        <option value="">-- Motor veya Alt Montaj Grubu Seçin --</option>
                                        <optgroup label="🔧 Motorlar">
                                            {engines?.map(e => (
                                                <option key={`engine-${e.id}`} value={`engine-${e.id}`}>
                                                    {e.serialNumber} ({e.model})
                                                </option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="📦 Alt Montaj Grupları">
                                            {assemblyGroups.map((group, idx) => (
                                                <option key={`assembly-${idx}`} value={`assembly-${group.serialNumber}`}>
                                                    {group.name} (PN: {group.partNumber}, SN: {group.serialNumber}) - {group.location}
                                                </option>
                                            ))}
                                        </optgroup>
                                    </select>
                                    
                                    <select 
                                        value={newTest.testType} 
                                        onChange={e => setNewTest({...newTest, testType: e.target.value})} 
                                        className="bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                                        required
                                    >
                                        <option value="">-- Test Tipi Seçin --</option>
                                        {testTypes?.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                    </select>
                                    
                                    <select 
                                        value={newTest.brakeType} 
                                        onChange={e => setNewTest({...newTest, brakeType: e.target.value})} 
                                        className="bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                                    >
                                        <option value="">-- Bremze Tipi Seçin (Opsiyonel) --</option>
                                        {brakeTypes?.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                                    </select>
                                </div>
                                
                                <input 
                                    value={newTest.testCell} 
                                    onChange={e => setNewTest({...newTest, testCell: e.target.value})} 
                                    placeholder="Test Hücresi" 
                                    className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                                    required 
                                />
                                
                                <textarea 
                                    value={newTest.description} 
                                    onChange={e => setNewTest({...newTest, description: e.target.value})} 
                                    placeholder="Test Açıklaması" 
                                    className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                                    rows={3}
                                />
                                
                                <input 
                                    type="number" 
                                    step="0.1"
                                    min="0.1"
                                    max="1000"
                                    value={newTest.duration} 
                                    onChange={e => setNewTest({...newTest, duration: e.target.value})} 
                                    placeholder="Süre (Saat)" 
                                    className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white" 
                                    required 
                                />
                                
                                <div>
                                    <label className="block text-sm font-medium text-brand-light mb-2">
                                        Döküman Ekle (Opsiyonel)
                                    </label>
                                    <input 
                                        type="file" 
                                        multiple 
                                        onChange={handleFileChange}
                                        className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                                    />
                                    {uploadedFiles.length > 0 && (
                                        <p className="text-sm text-brand-light mt-1">
                                            {uploadedFiles.length} dosya seçildi
                                        </p>
                                    )}
                                </div>
                                
                                {/* Auto-update information */}
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-3 text-sm">
                                    <p className="font-semibold text-blue-400 mb-2">ℹ️ Otomatik Güncellemeler:</p>
                                    <ul className="list-disc list-inside text-brand-light ml-2 space-y-1">
                                        <li>Motor toplam saati güncellenecek</li>
                                        <li>Motor cycle sayısı +1 artırılacak</li>
                                        <li>Motor üzerindeki <strong>tüm parça saatleri</strong> güncellenecek</li>
                                        <li>Life limit aşan veya yaklaşan parçalar için uyarı verilecek</li>
                                    </ul>
                                </div>
                                
                                <button type="submit" className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">
                                    Faaliyet Kaydet
                                </button>
                            </form>
                        </div>
                    )}
                    
                    <div className="bg-brand-card rounded-lg border border-brand-border">
                        <div className="p-4 border-b border-brand-border">
                            <div className="flex justify-between items-center">
                                <h2 className="text-lg font-bold text-white">Son Test Faaliyetleri</h2>
                                <div className="relative w-80">
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Motor, test tipi, yapan kişi, açıklama ile ara..."
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
                            {searchTerm && (
                                <p className="text-sm text-brand-light mt-2">
                                    {filteredTests?.length || 0} sonuç bulundu
                                </p>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-brand-border bg-brand-dark">
                                    <tr>
                                        <th className="p-3 font-semibold">TARİH</th>
                                        <th className="p-3 font-semibold">MOTOR</th>
                                        <th className="p-3 font-semibold">TEST TİPİ</th>
                                        <th className="p-3 font-semibold">BREMZE TİPİ</th>
                                        <th className="p-3 font-semibold">TESTİ YAPAN</th>
                                        <th className="p-3 font-semibold">AÇIKLAMA</th>
                                        <th className="p-3 font-semibold">SÜRE</th>
                                        <th className="p-3 font-semibold">DÖKÜMAN</th>
                                        {canModify && <th className="p-3 font-semibold">İŞLEMLER</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTests && filteredTests.length > 0 ? (
                                        filteredTests.map(test => (
                                            <tr key={test.id} className="border-b border-brand-border hover:bg-brand-dark">
                                                <td className="p-3">{format(new Date(test.testDate), 'dd.MM.yyyy HH:mm')}</td>
                                                <td className="p-3">
                                                    {test.engineId === 0 
                                                        ? <span className="text-purple-400">📦 Alt Montaj Grubu</span>
                                                        : engines?.find(e => e.id === test.engineId)?.serialNumber || 'Bilinmiyor'
                                                    }
                                                </td>
                                                <td className="p-3">{test.testType}</td>
                                                <td className="p-3">{test.brakeType || '-'}</td>
                                                <td className="p-3 font-semibold text-brand-primary">{test.userName}</td>
                                                <td className="p-3">{test.description}</td>
                                                <td className="p-3">{test.duration.toFixed(1)} saat</td>
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
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={canModify ? 9 : 8} className="p-8 text-center text-brand-light">
                                                {searchTerm ? 'Arama kriterlerine uygun test bulunamadı' : 'Henüz test kaydı bulunmuyor'}
                                            </td>
                                        </tr>
                                    )}
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
                            <span>Test Tipi Ekle</span>
                        </button>
                    </div>
                    
                    <div className="bg-brand-card rounded-lg border border-brand-border">
                        <h2 className="text-lg font-bold text-white p-4 border-b border-brand-border">Test Tipleri</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-brand-border bg-brand-dark">
                                    <tr>
                                        <th className="p-3 font-semibold">İSİM</th>
                                        <th className="p-3 font-semibold">AÇIKLAMA</th>
                                        <th className="p-3 font-semibold">OLUŞTURAN</th>
                                        <th className="p-3 font-semibold">OLUŞTURMA TARİHİ</th>
                                        <th className="p-3 font-semibold">İŞLEMLER</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {testTypes?.map(type => (
                                        <tr key={type.id} className="border-b border-brand-border hover:bg-brand-dark">
                                            <td className="p-3 font-semibold">{type.name}</td>
                                            <td className="p-3">{type.description || '-'}</td>
                                            <td className="p-3 text-brand-light">{type.createdBy}</td>
                                            <td className="p-3">{format(new Date(type.createdAt), 'dd.MM.yyyy HH:mm')}</td>
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
                            <span>Bremze Tipi Ekle</span>
                        </button>
                    </div>
                    
                    <div className="bg-brand-card rounded-lg border border-brand-border">
                        <h2 className="text-lg font-bold text-white p-4 border-b border-brand-border">Bremze Tipleri</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-brand-border bg-brand-dark">
                                    <tr>
                                        <th className="p-3 font-semibold">İSİM</th>
                                        <th className="p-3 font-semibold">AÇIKLAMA</th>
                                        <th className="p-3 font-semibold">OLUŞTURAN</th>
                                        <th className="p-3 font-semibold">OLUŞTURMA TARİHİ</th>
                                        <th className="p-3 font-semibold">İŞLEMLER</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {brakeTypes?.map(type => (
                                        <tr key={type.id} className="border-b border-brand-border hover:bg-brand-dark">
                                            <td className="p-3 font-semibold">{type.name}</td>
                                            <td className="p-3">{type.description || '-'}</td>
                                            <td className="p-3 text-brand-light">{type.createdBy}</td>
                                            <td className="p-3">{format(new Date(type.createdAt), 'dd.MM.yyyy HH:mm')}</td>
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
                <Modal isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} title="Testi Düzenle">
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
                            Değişiklikleri Kaydet
                        </button>
                    </form>
                </Modal>
            )}
            
            {isTestTypeModalOpen && (
                <Modal isOpen={isTestTypeModalOpen} onClose={() => setTestTypeModalOpen(false)} title="Test Tipi Ekle">
                    <form onSubmit={handleCreateTestType} className="space-y-4">
                        <input 
                            value={newTestType.name} 
                            onChange={(e) => setNewTestType({...newTestType, name: e.target.value})}
                            placeholder="Test Tipi İsmi"
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            required
                        />
                        <textarea 
                            value={newTestType.description} 
                            onChange={(e) => setNewTestType({...newTestType, description: e.target.value})}
                            placeholder="Açıklama (Opsiyonel)"
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            rows={3}
                        />
                        <button type="submit" className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">
                            Test Tipi Oluştur
                        </button>
                    </form>
                </Modal>
            )}
            
            {isBrakeTypeModalOpen && (
                <Modal isOpen={isBrakeTypeModalOpen} onClose={() => setBrakeTypeModalOpen(false)} title="Bremze Tipi Ekle">
                    <form onSubmit={handleCreateBrakeType} className="space-y-4">
                        <input 
                            value={newBrakeType.name} 
                            onChange={(e) => setNewBrakeType({...newBrakeType, name: e.target.value})}
                            placeholder="Bremze Tipi İsmi"
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            required
                        />
                        <textarea 
                            value={newBrakeType.description} 
                            onChange={(e) => setNewBrakeType({...newBrakeType, description: e.target.value})}
                            placeholder="Açıklama (Opsiyonel)"
                            className="w-full bg-brand-dark border border-brand-border rounded-md p-2 text-white"
                            rows={3}
                        />
                        <button type="submit" className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">
                            Bremze Tipi Oluştur
                        </button>
                    </form>
                </Modal>
            )}
            
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                title={`${deleteConfirm.type === 'test' ? 'Test' : deleteConfirm.type === 'testType' ? 'Test Tipi' : 'Bremze Tipi'} Sil`}
                message={`Bu ${deleteConfirm.type === 'test' ? 'testi' : deleteConfirm.type === 'testType' ? 'test tipini' : 'bremze tipini'} silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`}
                confirmText="Sil"
                cancelText="İptal"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirm({ isOpen: false, id: null, type: 'test' })}
                variant="danger"
            />
        </div>
    );
};

export default Tests;
