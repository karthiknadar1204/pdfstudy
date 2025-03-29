import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Plus, ChevronDown, ChevronUp, FileText, Check } from "lucide-react";
import { useFolderStore } from "@/store/useFolderStore";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface FolderItemProps {
  folder: {
    id: number;
    name: string;
    documents: any[];
  };
  isSelected: boolean;
  onSelect: () => void;
  currentDocumentId?: number;
}

const FolderItem = ({ folder, isSelected, onSelect, currentDocumentId }: FolderItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (currentDocumentId && folder.documents.some(doc => doc.id === currentDocumentId)) {
      setIsExpanded(true);
    }
  }, [currentDocumentId, folder.documents]);

  return (
    <div className={cn(
      "mb-1 rounded-lg transition-colors",
      isSelected ? "bg-accent" : "hover:bg-accent/50"
    )}>
      <div 
        className="flex items-center justify-between p-2 cursor-pointer"
        onClick={onSelect}
      >
        <div className="flex items-center flex-1">
          {isSelected && <Check className="h-4 w-4 mr-2" />}
          <span className="truncate">{folder.name}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>
      
      {isExpanded && folder.documents && folder.documents.length > 0 && (
        <div className="ml-4 mb-2 space-y-1">
          {folder.documents.map((doc) => (
            <div
              key={doc.id}
              className={cn(
                "flex items-center p-1 text-sm cursor-pointer hover:bg-accent/50 rounded",
                doc.id === currentDocumentId && "bg-primary/10 font-medium"
              )}
              onClick={() => router.push(`/chat-with-pdf/${doc.id}`)}
            >
              <FileText className="h-4 w-4 mr-2" />
              <span className="truncate">{doc.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface DocumentSidebarProps {
  currentDocumentId?: number;
}

export function DocumentSidebar({ currentDocumentId }: DocumentSidebarProps) {
  const { folders, selectedFolderId, isCollapsed, selectFolder, toggleCollapse, setFolders } = useFolderStore();
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  useEffect(() => {
    const fetchFolders = async () => {
      try {
        const response = await fetch('/api/folders');
        if (response.ok) {
          const data = await response.json();
          setFolders(data);
        }
      } catch (error) {
        console.error('Error fetching folders:', error);
      }
    };

    fetchFolders();
  }, [setFolders]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newFolderName }),
      });

      if (response.ok) {
        const folder = await response.json();
        useFolderStore.getState().addFolder(folder);
        setNewFolderName("");
        setIsCreatingFolder(false);
        selectFolder(folder.id);
      }
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const handleFolderSelect = (folderId: number) => {
    selectFolder(folderId);
  };

  return (
    <div className={cn(
      "h-full border-r flex flex-col transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className="p-4 border-b flex items-center justify-between">
        {!isCollapsed && <h2 className="font-semibold">Folders</h2>}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapse}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {!isCollapsed && (
        <div className="flex-1 overflow-auto p-4">
          {folders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              isSelected={folder.id === selectedFolderId}
              onSelect={() => handleFolderSelect(folder.id)}
              currentDocumentId={currentDocumentId}
            />
          ))}

          {isCreatingFolder && (
            <div className="mt-2 p-2 bg-accent/50 rounded-lg">
              <Input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="w-full text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') {
                    setIsCreatingFolder(false);
                    setNewFolderName("");
                  }
                }}
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsCreatingFolder(false);
                    setNewFolderName("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                >
                  Create
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="p-4 border-t">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            if (!isCreatingFolder) {
              setIsCreatingFolder(true);
            }
          }}
        >
          <Plus className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">New Folder</span>}
        </Button>
      </div>
    </div>
  );
} 