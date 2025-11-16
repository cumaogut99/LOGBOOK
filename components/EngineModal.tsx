import React, { useState, useEffect } from 'react';
import { Engine, EngineComponent, BrakeType } from '../types';

interface EngineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (engine: Partial<Engine>) => Promise<void>;
  engine?: Engine | null;
  mode: 'add' | 'edit';
  brakeTypes?: BrakeType[]; // Bremze tipleri için
}

export const EngineModal: React.FC<EngineModalProps> = ({
  isOpen,
  onClose,
  onSave,
  engine,
  mode,
  brakeTypes = []
}) => {
  const [formData, setFormData] = useState<Partial<Engine>>({
    serialNumber: '',
    manufacturer: '-', // Hidden field for backend compatibility
    model: '',
    status: 'Aktif',
    totalHours: 0,
    totalCycles: 0,
    location: '',
    components: [],
    activityLog: []
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (engine && mode === 'edit') {
      setFormData({
        ...engine,
        manufacturer: engine.manufacturer || '-' // Ensure manufacturer has a value
      });
    } else {
      setFormData({
        serialNumber: '',
        manufacturer: '-', // Default value for backend compatibility
        model: '',
        status: 'Aktif',
        totalHours: 0,
        totalCycles: 0,
        location: '',
        components: [],
        activityLog: []
      });
    }
    setErrors({});
  }, [engine, mode, isOpen]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.serialNumber?.trim()) {
      newErrors.serialNumber = 'Seri numarası gereklidir';
    }
    if (!formData.model?.trim()) {
      newErrors.model = 'Model gereklidir';
    }
    if (!formData.location?.trim()) {
      newErrors.location = 'Lokasyon gereklidir';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    setLoading(true);
    try {
      // Ensure all required fields are set for backend compatibility
      const engineData = {
        ...formData,
        manufacturer: formData.manufacturer || '-',
        nextServiceDue: formData.nextServiceDue || '0', // NOT NULL field in DB
        components: formData.components || [],
        activityLog: formData.activityLog || []
      };
      console.log('Sending engine data:', engineData);
      await onSave(engineData);
      onClose();
    } catch (error) {
      console.error('Error saving engine:', error);
      throw error; // Re-throw to show error in UI
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof Engine, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-brand-card border border-brand-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-brand-card border-b border-brand-border p-6 z-10">
          <h2 className="text-2xl font-bold text-white">
            {mode === 'add' ? 'Yeni Motor Ekle' : 'Motor Düzenle'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Serial Number */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Seri Numarası <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.serialNumber || ''}
                onChange={(e) => handleChange('serialNumber', e.target.value)}
                className={`w-full bg-brand-dark border ${errors.serialNumber ? 'border-red-500' : 'border-brand-border'} rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary`}
                placeholder="örn: PD170"
              />
              {errors.serialNumber && (
                <p className="text-red-500 text-sm mt-1">{errors.serialNumber}</p>
              )}
            </div>

            {/* Model */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Model <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.model || ''}
                onChange={(e) => handleChange('model', e.target.value)}
                className={`w-full bg-brand-dark border ${errors.model ? 'border-red-500' : 'border-brand-border'} rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary`}
                placeholder="örn: PW1100G-JM"
              />
              {errors.model && (
                <p className="text-red-500 text-sm mt-1">{errors.model}</p>
              )}
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Lokasyon <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.location || ''}
                onChange={(e) => handleChange('location', e.target.value)}
                className={`w-full bg-brand-dark border ${errors.location ? 'border-red-500' : 'border-brand-border'} rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary`}
              >
                <option value="">-- Lokasyon Seçin --</option>
                <option value="Montaj">Montaj</option>
                <option value="Depo">Depo</option>
                <option value="Test Alanı">Test Alanı</option>
                {brakeTypes && brakeTypes.length > 0 && (
                  <optgroup label="Bremze Tipleri">
                    {brakeTypes.map(bt => (
                      <option key={`brake-${bt.id}`} value={bt.name}>{bt.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              {errors.location && (
                <p className="text-red-500 text-sm mt-1">{errors.location}</p>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Durum
              </label>
              <select
                value={formData.status || 'Aktif'}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full bg-brand-dark border border-brand-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="Aktif">Aktif</option>
                <option value="Deaktif">Deaktif</option>
              </select>
            </div>

            {/* Total Hours */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Toplam Saat
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={formData.totalHours || 0}
                onChange={(e) => handleChange('totalHours', parseFloat(e.target.value) || 0)}
                className="w-full bg-brand-dark border border-brand-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>

            {/* Total Cycles */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Toplam Cycle
              </label>
              <input
                type="number"
                min="0"
                value={formData.totalCycles || 0}
                onChange={(e) => handleChange('totalCycles', parseInt(e.target.value) || 0)}
                className="w-full bg-brand-dark border border-brand-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-brand-border">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 bg-brand-dark hover:bg-opacity-80 text-white rounded-md transition-colors disabled:opacity-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Kaydediliyor...
                </>
              ) : (
                mode === 'add' ? 'Motor Ekle' : 'Değişiklikleri Kaydet'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

