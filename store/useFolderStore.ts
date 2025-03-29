import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

interface Folder {
  id: number;
  uuid: string;
  name: string;
  documents: any[];
}

interface FolderStore {
  folders: Folder[];
  selectedFolderId: number | null;
  isCollapsed: boolean;
  setFolders: (folders: Folder[]) => void;
  addFolder: (folder: Folder) => void;
  selectFolder: (id: number | null) => void;
  toggleCollapse: () => void;
}

export const useFolderStore = create<FolderStore>((set) => ({
  folders: [],
  selectedFolderId: null,
  isCollapsed: false,
  setFolders: (folders) => set({ folders }),
  addFolder: (folder) => set((state) => ({ folders: [...state.folders, folder] })),
  selectFolder: (id) => set({ selectedFolderId: id }),
  toggleCollapse: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
})); 