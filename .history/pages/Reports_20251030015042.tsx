import React, { useState } from 'react';
import { useQuery } from '../hooks/useData';
import { enginesApi, faultsApi, testsApi } from '../lib/client.ts';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { showSuccess, showError } from '../utils/toast';
import { exportToCSV, exportToExcel, exportFleetStatusToPDF, exportFaultHistoryToPDF, exportTestActivityToPDF } from '../utils/exportUtils';
import { format } from 'date-fns';

const Reports: React.FC = () => {
  const engines = useQuery(() => enginesApi.getAll(), []);
  const faults = useQuery(() => faultsApi.getAll(), []);
  const tests = useQuery(() => testsApi.getAll(), []);
  
  const [selectedReport, setSelectedReport] = useState<string>('fleet');
  const [dateFilter, setDateFilter] = useState<'all' | '7days' | '30days' | '90days'>('all');

  if (!engines || !faults || !tests) return <LoadingSpinner text="Loading reports..." />;

  // Filter data by date
  const getFilteredData = () => {
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (dateFilter) {
      case '7days':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case '30days':
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case '90days':
        cutoffDate.setDate(now.getDate() - 90);
        break;
      default:
        return { faults, tests };
    }
    
    const filteredFaults = faults.filter(f => new Date(f.reportDate) >= cutoffDate);
    const filteredTests = tests.filter(t => new Date(t.testDate) >= cutoffDate);
    
    return { faults: filteredFaults, tests: filteredTests };
  };

  const { faults: filteredFaults, tests: filteredTests } = getFilteredData();

  // Report handlers
  const handleFleetStatusExport = (format: 'pdf' | 'csv' | 'excel') => {
    try {
      if (format === 'pdf') {
        exportFleetStatusToPDF(engines);
      } else if (format === 'csv') {
        const data = engines.map(e => ({
          'Serial Number': e.serialNumber,
          'Manufacturer': e.manufacturer,
          'Model': e.model,
          'Status': e.status,
          'Total Hours': e.totalHours,
          'Total Cycles': e.totalCycles,
          'Location': e.location
        }));
        exportToCSV(data, 'fleet-status');
      } else {
        const data = engines.map(e => ({
          'Serial Number': e.serialNumber,
          'Manufacturer': e.manufacturer,
          'Model': e.model,
          'Status': e.status,
          'Total Hours': e.totalHours,
          'Total Cycles': e.totalCycles,
          'Location': e.location
        }));
        exportToExcel(data, 'fleet-status');
      }
      showSuccess(`Report exported as ${format.toUpperCase()}`);
    } catch (error) {
      showError('Failed to export report');
    }
  };

  const handleFaultHistoryExport = (format: 'pdf' | 'csv' | 'excel') => {
    try {
      if (format === 'pdf') {
        exportFaultHistoryToPDF(filteredFaults);
      } else if (format === 'csv') {
        const data = filteredFaults.map(f => ({
          'Date': f.reportDate,
          'Severity': f.severity,
          'Description': f.description,
          'Status': f.status,
          'Reported By': f.userName
        }));
        exportToCSV(data, 'fault-history');
      } else {
        const data = filteredFaults.map(f => ({
          'Date': f.reportDate,
          'Severity': f.severity,
          'Description': f.description,
          'Status': f.status,
          'Reported By': f.userName
        }));
        exportToExcel(data, 'fault-history');
      }
      showSuccess(`Report exported as ${format.toUpperCase()}`);
    } catch (error) {
      showError('Failed to export report');
    }
  };

  const handleTestActivityExport = (format: 'pdf' | 'csv' | 'excel') => {
    try {
      if (format === 'pdf') {
        exportTestActivityToPDF(filteredTests);
      } else if (format === 'csv') {
        const data = filteredTests.map(t => ({
          'Date': t.testDate,
          'Test Type': t.testType,
          'Test Cell': t.testCell,
          'Duration': t.duration,
          'Description': t.description,
          'Operator': t.userName
        }));
        exportToCSV(data, 'test-activity');
      } else {
        const data = filteredTests.map(t => ({
          'Date': t.testDate,
          'Test Type': t.testType,
          'Test Cell': t.testCell,
          'Duration': t.duration,
          'Description': t.description,
          'Operator': t.userName
        }));
        exportToExcel(data, 'test-activity');
      }
      showSuccess(`Report exported as ${format.toUpperCase()}`);
    } catch (error) {
      showError('Failed to export report');
    }
  };

  const reportCards = [
    {
      id: 'fleet',
      title: 'Engine Fleet Status Report',
      description: 'Complete overview of all engines, their status, hours, and location',
      icon: '🛩️',
      stats: `${engines.length} Engines`,
      handler: handleFleetStatusExport
    },
    {
      id: 'faults',
      title: 'Fault History Report',
      description: 'Detailed fault reports with severity and resolution status',
      icon: '⚠️',
      stats: `${filteredFaults.length} Faults`,
      handler: handleFaultHistoryExport
    },
    {
      id: 'tests',
      title: 'Test Activity Summary',
      description: 'Test logs with duration, type, and operator information',
      icon: '🧪',
      stats: `${filteredTests.length} Tests`,
      handler: handleTestActivityExport
    },
  ];

  const selectedReportData = reportCards.find(r => r.id === selectedReport);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-brand-light">Generate and export comprehensive reports</p>
      </div>

      {/* Date Filter */}
      <div className="bg-brand-card p-4 rounded-lg border border-brand-border">
        <label className="block text-sm font-semibold text-white mb-2">Date Range Filter</label>
        <div className="flex gap-2">
          <button
            onClick={() => setDateFilter('all')}
            className={`px-4 py-2 rounded-md transition-colors ${
              dateFilter === 'all' 
                ? 'bg-brand-primary text-white' 
                : 'bg-brand-dark text-brand-light hover:bg-opacity-80'
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => setDateFilter('7days')}
            className={`px-4 py-2 rounded-md transition-colors ${
              dateFilter === '7days' 
                ? 'bg-brand-primary text-white' 
                : 'bg-brand-dark text-brand-light hover:bg-opacity-80'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setDateFilter('30days')}
            className={`px-4 py-2 rounded-md transition-colors ${
              dateFilter === '30days' 
                ? 'bg-brand-primary text-white' 
                : 'bg-brand-dark text-brand-light hover:bg-opacity-80'
            }`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setDateFilter('90days')}
            className={`px-4 py-2 rounded-md transition-colors ${
              dateFilter === '90days' 
                ? 'bg-brand-primary text-white' 
                : 'bg-brand-dark text-brand-light hover:bg-opacity-80'
            }`}
          >
            Last 90 Days
          </button>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reportCards.map(report => (
          <div
            key={report.id}
            onClick={() => setSelectedReport(report.id)}
            className={`bg-brand-card p-6 rounded-lg border cursor-pointer transition-all ${
              selectedReport === report.id
                ? 'border-brand-primary ring-2 ring-brand-primary ring-opacity-50'
                : 'border-brand-border hover:border-brand-primary'
            }`}
          >
            <div className="text-4xl mb-4">{report.icon}</div>
            <h3 className="text-lg font-bold text-white mb-2">{report.title}</h3>
            <p className="text-sm text-brand-light mb-4">{report.description}</p>
            <p className="text-brand-primary font-semibold">{report.stats}</p>
          </div>
        ))}
      </div>

      {/* Export Section */}
      {selectedReportData && (
        <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
          <h2 className="text-xl font-bold text-white mb-4">Export {selectedReportData.title}</h2>
          <p className="text-brand-light mb-6">{selectedReportData.description}</p>
          
          <div className="flex gap-4">
            <button
              onClick={() => selectedReportData.handler('pdf')}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Export as PDF
            </button>
            
            <button
              onClick={() => selectedReportData.handler('excel')}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export as Excel
            </button>
            
            <button
              onClick={() => selectedReportData.handler('csv')}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export as CSV
            </button>
          </div>
        </div>
      )}

      {/* Preview Section */}
      <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
        <h2 className="text-xl font-bold text-white mb-4">Report Preview</h2>
        
        {selectedReport === 'fleet' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-brand-border">
                <tr>
                  <th className="p-3">Serial Number</th>
                  <th className="p-3">Model</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Hours</th>
                  <th className="p-3">Cycles</th>
                  <th className="p-3">Location</th>
                </tr>
              </thead>
              <tbody>
                {engines.slice(0, 10).map(e => (
                  <tr key={e.id} className="border-b border-brand-border hover:bg-brand-dark">
                    <td className="p-3">{e.serialNumber}</td>
                    <td className="p-3">{e.model}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        e.status === 'Active' ? 'bg-green-500/20 text-green-400' :
                        e.status === 'AOG' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="p-3">{e.totalHours.toFixed(1)}</td>
                    <td className="p-3">{e.totalCycles}</td>
                    <td className="p-3">{e.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {engines.length > 10 && (
              <p className="text-brand-light text-sm mt-4">Showing 10 of {engines.length} engines...</p>
            )}
          </div>
        )}

        {selectedReport === 'faults' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-brand-border">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Reported By</th>
                </tr>
              </thead>
              <tbody>
                {filteredFaults.slice(0, 10).map(f => (
                  <tr key={f.id} className="border-b border-brand-border hover:bg-brand-dark">
                    <td className="p-3">{f.reportDate}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        f.severity === 'Critical' ? 'bg-red-500/20 text-red-400' :
                        f.severity === 'Major' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-400/20 text-blue-400'
                      }`}>
                        {f.severity}
                      </span>
                    </td>
                    <td className="p-3">{f.description.substring(0, 50)}...</td>
                    <td className="p-3">{f.status}</td>
                    <td className="p-3">{f.userName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredFaults.length > 10 && (
              <p className="text-brand-light text-sm mt-4">Showing 10 of {filteredFaults.length} faults...</p>
            )}
          </div>
        )}

        {selectedReport === 'tests' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-brand-border">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Test Type</th>
                  <th className="p-3">Test Cell</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Operator</th>
                </tr>
              </thead>
              <tbody>
                {filteredTests.slice(0, 10).map(t => (
                  <tr key={t.id} className="border-b border-brand-border hover:bg-brand-dark">
                    <td className="p-3">{t.testDate}</td>
                    <td className="p-3">{t.testType}</td>
                    <td className="p-3">{t.testCell}</td>
                    <td className="p-3">{t.duration.toFixed(1)} hrs</td>
                    <td className="p-3">{t.userName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredTests.length > 10 && (
              <p className="text-brand-light text-sm mt-4">Showing 10 of {filteredTests.length} tests...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
