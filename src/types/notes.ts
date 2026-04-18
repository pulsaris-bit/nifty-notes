export type NotePermission = 'owner' | 'read' | 'write';

export interface SharedBy {
  id: string;
  email: string;
  displayName: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  notebookId: string;
  labelIds: string[];
  createdAt: Date;
  updatedAt: Date;
  pinned: boolean;
  password: string | null;
  archived: boolean;
  /** When set, the note is in the trash; null/undefined means active. */
  deletedAt?: Date | null;
  /** 'owner' for own notes; 'read'/'write' for notes shared with you. */
  permission?: NotePermission;
  /** Owner info when this note was shared with you; null/undefined for own notes. */
  sharedBy?: SharedBy | null;
}

export interface NoteShare {
  recipientId: string;
  email: string;
  displayName: string;
  permission: 'read' | 'write';
  createdAt: string;
}

export interface UserSearchResult {
  id: string;
  email: string;
  displayName: string;
}

export interface PresenceViewer {
  userId: string;
  displayName: string;
}

export const TRASH_RETENTION_DAYS = 30;

export interface Notebook {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}
