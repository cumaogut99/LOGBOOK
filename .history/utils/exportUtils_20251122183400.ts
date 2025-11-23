import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Engine, Fault, Test, Component } from '../types';
import { format } from 'date-fns';

// CSV Export
export const exportToCSV = (data: any[], filename: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `${filename}.csv`);
};

// Excel Export
export const exportToExcel = (data: any[], filename: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

// PDF Export for Fleet Status
export const exportFleetStatusToPDF = (engines: Engine[]) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(20);
  doc.text('Fleet Status Report', 14, 20);
  
  // Date
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 28);
  
  // Summary
  doc.setFontSize(12);
  doc.text('Fleet Summary', 14, 40);
  doc.setFontSize(10);
  doc.text(`Total Engines: ${engines.length}`, 14, 48);
  doc.text(`Active: ${engines.filter(e => e.status === 'Active').length}`, 14, 54);
  doc.text(`AOG: ${engines.filter(e => e.status === 'AOG').length}`, 14, 60);
  
  // Engine Table
  const tableData = engines.map(e => [
    e.serialNumber,
    e.model,
    e.status,
    e.totalHours.toFixed(1),
    e.totalCycles.toString(),
    e.location
  ]);
  
  autoTable(doc, {
    startY: 70,
    head: [['Serial Number', 'Model', 'Status', 'Hours', 'Cycles', 'Location']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
  });
  
  doc.save('fleet-status-report.pdf');
};

// PDF Export for Fault History
export const exportFaultHistoryToPDF = (faults: Fault[]) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(20);
  doc.text('Fault History Report', 14, 20);
  
  // Date
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 28);
  
  // Summary
  doc.setFontSize(12);
  doc.text('Fault Summary', 14, 40);
  doc.setFontSize(10);
  doc.text(`Total Faults: ${faults.length}`, 14, 48);
  doc.text(`Open: ${faults.filter(f => f.status === 'Open').length}`, 14, 54);
  doc.text(`Closed: ${faults.filter(f => f.status === 'Closed').length}`, 14, 60);
  
  // Fault Table
  const tableData = faults.map(f => [
    f.reportDate,
    f.severity,
    f.description.substring(0, 50) + (f.description.length > 50 ? '...' : ''),
    f.status,
    f.userName
  ]);
  
  autoTable(doc, {
    startY: 70,
    head: [['Date', 'Severity', 'Description', 'Status', 'Reported By']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [239, 68, 68] },
  });
  
  doc.save('fault-history-report.pdf');
};

// PDF Export for Test Activity
export const exportTestActivityToPDF = (tests: Test[]) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(20);
  doc.text('Test Activity Report', 14, 20);
  
  // Date
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 28);
  
  // Summary
  doc.setFontSize(12);
  doc.text('Test Summary', 14, 40);
  doc.setFontSize(10);
  doc.text(`Total Tests: ${tests.length}`, 14, 48);
  const totalDuration = tests.reduce((sum, t) => sum + t.duration, 0);
  doc.text(`Total Duration: ${totalDuration.toFixed(1)} hours`, 14, 54);
  
  // Test Table
  const tableData = tests.map(t => [
    t.testDate,
    t.testType,
    t.testCell,
    t.duration.toFixed(1),
    t.userName
  ]);
  
  autoTable(doc, {
    startY: 65,
    head: [['Date', 'Test Type', 'Test Cell', 'Duration (hrs)', 'Operator']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129] },
  });
  
  doc.save('test-activity-report.pdf');
};

// Build Report Excel Export
export const exportBuildReportToExcel = (components: Component[], engineSerialNumber: string, fileName?: string) => {
  // Flatten component tree to rows
  const rows: any[] = [];
  
  const flattenComponents = (comps: Component[], parentInfo?: { name: string; partNumber: string; serialNumber: string }) => {
    comps.forEach(comp => {
      if (comp.children && comp.children.length > 0) {
        // This is an assembly with children
        comp.children.forEach(child => {
          rows.push({
            'Alt Assy İsmi': comp.description,
            'Alt Assy Parça Numarası': comp.partNumber,
            'Alt Assy Seri Numarası': comp.serialNumber,
            'Parça İsmi': child.description,
            'Parça Numarası': child.partNumber,
            'Parça Seri Numarası': child.serialNumber,
            'Parça Çalışma Saati': child.currentHours,
            'Parça Ömrü': child.lifeLimit
          });
        });
      } else {
        // This is a standalone component
        rows.push({
          'Alt Assy İsmi': '-',
          'Alt Assy Parça Numarası': '-',
          'Alt Assy Seri Numarası': '-',
          'Parça İsmi': comp.description,
          'Parça Numarası': comp.partNumber,
          'Parça Seri Numarası': comp.serialNumber,
          'Parça Çalışma Saati': comp.currentHours,
          'Parça Ömrü': comp.lifeLimit
        });
      }
    });
  };
  
  flattenComponents(components);
  
  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(rows);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 25 }, // Alt Assy İsmi
    { wch: 25 }, // Alt Assy Parça Numarası
    { wch: 25 }, // Alt Assy Seri Numarası
    { wch: 25 }, // Parça İsmi
    { wch: 25 }, // Parça Numarası
    { wch: 25 }, // Parça Seri Numarası
    { wch: 20 }, // Parça Çalışma Saati
    { wch: 15 }  // Parça Ömrü
  ];
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Build Report');
  
  // Generate filename
  const timestamp = new Date().toISOString().split('T')[0];
  const finalFileName = fileName || `BR_${engineSerialNumber}_${timestamp}.xlsx`;
  
  // Save file
  XLSX.writeFile(wb, finalFileName);
};

