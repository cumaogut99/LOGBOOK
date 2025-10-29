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
    fileData: Blob;
}

export enum Severity {
  Minor = 'Minor',
  Major = 'Major',
  Critical = 'Critical'
}

export interface Test {
    id?: number;
    engineId: number;
    testType: string;
    testCell: string;
    description: string;
    duration: number;
    testDate: string;
    documentId?: number;
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
    userName: string;
}

export interface SwapActivity {
    id?: number;
    engineId: number;
    componentInstalledId: number;
    componentRemovedId: number;
    swapDate: string;
    documentId?: number;
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

export interface Engine {
  id?: number;
  model: string;
  serialNumber: string;
  status: 'Active' | 'Maintenance Due' | 'AOG';
  totalHours: number;
  totalCycles: number;
  nextServiceDue: number | string;
  manufacturer: string;
  components: Component[];
  activityLog: ActivityLogItem[];
}
