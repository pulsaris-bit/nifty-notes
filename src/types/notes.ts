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
