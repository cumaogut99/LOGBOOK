import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import type { Component } from '../types';

interface ComponentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (component: Partial<Component>) => Promise<void>;
    component: Component | null;
}

export const ComponentModal: React.FC<ComponentModalProps> = ({
    isOpen,
    onClose,
    onSave,
    component
}) => {
    const [formData, setFormData] = useState<Partial<Component>>({
        description: '',
        partNumber: '',
        serialNumber: '',
        currentHours: 0,
        lifeLimit: 0
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (component) {
            setFormData({
                description: component.description,
                partNumber: component.partNumber,
                serialNumber: component.serialNumber,
                currentHours: component.currentHours,
                lifeLimit: component.lifeLimit
            });
        }
    }, [component]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            console.error('Error saving component:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (field: keyof Component, value: string | number) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Komponent Düzenle"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-brand-light mb-1">
                        Açıklama / İsim
                    </label>
                    <input
                        type="text"
                        value={formData.description || ''}
                        onChange={(e) => handleChange('description', e.target.value)}
                        className="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-brand-light mb-1">
                        Parça Numarası
                    </label>
                    <input
                        type="text"
                        value={formData.partNumber || ''}
                        onChange={(e) => handleChange('partNumber', e.target.value)}
                        className="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-brand-light mb-1">
                        Seri Numarası
                    </label>
                    <input
                        type="text"
                        value={formData.serialNumber || ''}
                        onChange={(e) => handleChange('serialNumber', e.target.value)}
                        className="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-light mb-1">
                            Mevcut Saat
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            value={formData.currentHours || 0}
                            onChange={(e) => handleChange('currentHours', parseFloat(e.target.value))}
                            className="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-brand-light mb-1">
                            Ömür Limiti
                        </label>
                        <input
                            type="number"
                            value={formData.lifeLimit || 0}
                            onChange={(e) => handleChange('lifeLimit', parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            required
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-brand-border">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 bg-brand-border hover:bg-slate-600 text-white rounded-md transition-colors disabled:opacity-50"
                    >
                        İptal
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="px-4 py-2 bg-brand-primary hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Kaydediliyor...
                            </>
                        ) : (
                            'Kaydet'
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};
