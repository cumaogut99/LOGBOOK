import React, { useState, useEffect } from 'react';
import { Component as EngineComponent } from '../types';

interface ComponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (component: Partial<EngineComponent>) => Promise<void>;
  component?: EngineComponent | null;
  mode: 'add' | 'edit';
  parentId?: number | null;
}

export const ComponentModal: React.FC<ComponentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  component,
  mode,
  parentId
}) => {
  const [formData, setFormData] = useState<Partial<EngineComponent>>({
    name: '',
    partNumber: '',
    serialNumber: '',
    currentHours: 0,
    currentCycles: 0,
    lifeLimit: 0,
    status: 'Good',
    parentId: parentId || null,
    children: []
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (component && mode === 'edit') {
      setFormData(component);
    } else {
      setFormData({
        name: '',
        partNumber: '',
        serialNumber: '',
        currentHours: 0,
        currentCycles: 0,
        lifeLimit: 0,
        status: 'Good',
        parentId: parentId || null,
        children: []
      });
    }
    setErrors({});
  }, [component, mode, isOpen, parentId]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Component name is required';
    }
    if (!formData.partNumber?.trim()) {
      newErrors.partNumber = 'Part number is required';
    }
    if (!formData.serialNumber?.trim()) {
      newErrors.serialNumber = 'Serial number is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving component:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof EngineComponent, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
            {mode === 'add' ? 'Add New Component' : 'Edit Component'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Component Name */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-white mb-2">
                Component Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`w-full bg-brand-dark border ${errors.name ? 'border-red-500' : 'border-brand-border'} rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary`}
                placeholder="e.g., High Pressure Turbine"
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name}</p>
              )}
            </div>

            {/* Part Number */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Part Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.partNumber || ''}
                onChange={(e) => handleChange('partNumber', e.target.value)}
                className={`w-full bg-brand-dark border ${errors.partNumber ? 'border-red-500' : 'border-brand-border'} rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary`}
                placeholder="e.g., P/N-12345"
              />
              {errors.partNumber && (
                <p className="text-red-500 text-sm mt-1">{errors.partNumber}</p>
              )}
            </div>

            {/* Serial Number */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Serial Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.serialNumber || ''}
                onChange={(e) => handleChange('serialNumber', e.target.value)}
                className={`w-full bg-brand-dark border ${errors.serialNumber ? 'border-red-500' : 'border-brand-border'} rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary`}
                placeholder="e.g., S/N-67890"
              />
              {errors.serialNumber && (
                <p className="text-red-500 text-sm mt-1">{errors.serialNumber}</p>
              )}
            </div>

            {/* Current Hours */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Current Hours
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={formData.currentHours || 0}
                onChange={(e) => handleChange('currentHours', parseFloat(e.target.value) || 0)}
                className="w-full bg-brand-dark border border-brand-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>

            {/* Current Cycles */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Current Cycles
              </label>
              <input
                type="number"
                min="0"
                value={formData.currentCycles || 0}
                onChange={(e) => handleChange('currentCycles', parseInt(e.target.value) || 0)}
                className="w-full bg-brand-dark border border-brand-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>

            {/* Life Limit */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Life Limit (hours)
              </label>
              <input
                type="number"
                min="0"
                value={formData.lifeLimit || 0}
                onChange={(e) => handleChange('lifeLimit', parseInt(e.target.value) || 0)}
                className="w-full bg-brand-dark border border-brand-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Status
              </label>
              <select
                value={formData.status || 'Good'}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full bg-brand-dark border border-brand-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="Good">Good</option>
                <option value="Warning">Warning</option>
                <option value="Critical">Critical</option>
                <option value="Removed">Removed</option>
              </select>
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                mode === 'add' ? 'Add Component' : 'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

