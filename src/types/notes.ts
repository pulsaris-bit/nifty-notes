export interface Note {
  id: string;
  title: string;
  content: string;
  notebookId: string;
  createdAt: Date;
  updatedAt: Date;
  pinned: boolean;
}

export interface Notebook {
  id: string;
  name: string;
  icon: string;
  color: string;
}
