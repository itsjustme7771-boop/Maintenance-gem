export type UserRole = 'admin' | 'lead' | 'technician';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: any;
}

export interface Equipment {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  location: string;
  description: string;
  manualUrl?: string;
  createdAt: any;
}

export interface MaintenanceLog {
  id: string;
  equipmentId: string;
  technicianId: string;
  technicianName: string;
  type: 'preventative' | 'repair' | 'emergency';
  description: string;
  resolution: string;
  partsUsed: string[];
  timestamp: any;
}

export interface KnowledgeEntry {
  id: string;
  equipmentId: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  tags: string[];
  createdAt: any;
}
