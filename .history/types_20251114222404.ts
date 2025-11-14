export type Role = 'Administrator' | 'Planning Engineer' | 'System Engineer' | 'Test Engineer' | 'Test Operator' | 'Fault Coordinator' | 'Quality Control Engineer' | 'Assembly Engineer' | 'Assembly Operator';

export interface User {
  id?: number;
  username: string;
  passwordHash: string; // In a real app, this would be a hash
  role: Role;
  fullName: string;
}

export interface NavItem {
  path: string;
  name: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  allowedRoles: Role[];
}

export interface Document {
    id?: number;
    fileName: string;
    fileData: Blob | string;
    fileType?: string;
    fileSize?: number;
    relatedType?: 'test' | 'fault' | 'swap' | 'maintenance';
    relatedId?: number;
    uploadedBy?: string;
    uploadedAt?: string;
}

export enum Severity {
  Minor = 'Minor',
  Major = 'Major',
  Critical = 'Critical'
}

export interface TestType {
    id?: number;
    name: string;
    description?: string;
    createdBy: string;
    createdAt: string;
}

export interface BrakeType {
    id?: number;
    name: string;
    description?: string;
    createdBy: string;
    createdAt: string;
}

export interface Operator {
    id?: number;
    name: string;
    description?: string;
    createdBy: string;
    createdAt: string;
}

export interface MaintenancePlan {
    id?: number;
    engineId: number;
    planType: string;
    maintenanceType: 'one-time' | 'periodic'; // Tek seferlik veya periyodik
    description: string;
    scheduledDate: string;
    dueHours?: number;
    dueCycles?: number;
    periodicIntervalHours?: number; // Periyodik bakım için saat aralığı
    periodicIntervalCycles?: number; // Periyodik bakım için çevrim aralığı
    lastPerformedHours?: number; // Son yapılan bakım saati
    nextDueHours?: number; // Bir sonraki bakıma kalan saat
    status: 'Pending' | 'Approved' | 'Completed' | 'Rejected' | 'Active';
    createdBy: string;
    createdAt: string;
    approvedBy?: string;
    approvedAt?: string;
}

export interface Test {
    id?: number;
    engineId: number;
    testType: string;
    brakeType?: string;
    operatorId?: number;
    operatorName?: string;
    testCell: string;
    description: string;
    duration: number;
    testDate: string;
    documentId?: number;
    documents?: Document[];
    userName: string;
}

export interface Fault {
    id?: number;
    engineId: number;
    componentId?: number;
    description: string;
    severity: Severity;
    reportDate: string;
    status: 'Open' | 'Closed';
    documentId?: number;
    documents?: Document[];
    userName: string;
}

export interface SwapActivity {
    id?: number;
    engineId: number;
    componentInstalledId: number;
    componentRemovedId: number;
    swapDate: string;
    swapType: 'Component' | 'Assembly';
    assemblyGroup?: string;
    documentId?: number;
    documents?: Document[];
    userName: string;
}

export interface InventoryItem {
    id?: number;
    partNumber: string;
    serialNumber: string;
    description: string;
    quantity: number;
    location: string;
    userName: string;
}

export interface Component {
  id: number;
  description: string;
  partNumber: string;
  serialNumber: string;
  currentHours: number;
  lifeLimit: number;
  children?: Component[];
}

export interface ActivityLogItem {
  type: 'Swap' | 'Fault' | 'Test';
  details: string;
  date: string;
  severity?: Severity;
  duration?: number;
}

export interface BuildReportHistory {
  id?: number;
  engineId: number;
  uploadDate: string;
  uploadedBy: string;
  fileName: string;
  components: Component[];
  changesSummary?: {
    added: number;
    updated: number;
    removed: number;
  };
}

export interface Engine {
  id?: number;
  model: string;
  serialNumber: string;
  status: 'Active' | 'Maintenance Due' | 'AOG';
  totalHours: number;
  totalCycles: number;
  nextServiceDue: number | string;
  manufacturer: string;
  location?: string;
  components: Component[];
  activityLog: ActivityLogItem[];
  buildReportHistory?: BuildReportHistory[];
}
