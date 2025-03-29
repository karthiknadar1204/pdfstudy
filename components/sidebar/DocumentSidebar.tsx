import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Plus, ChevronDown, ChevronUp, FileText, Check, Upload, Trash2 } from "lucide-react";
import { useFolderStore } from "@/store/useFolderStore";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FirebasePdfUploader } from "@/components/firebase-pdf-uploader";
import { useToast } from "@/hooks/use-toast";
import { saveDocument } from "@/actions/document";
import { useUser } from "@clerk/nextjs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface UploadDialogProps {
  folderId: number;
  folderName: string;
  onUploadComplete: () => Promise<void>;
}

const UploadDialog = ({ folderId, folderName, onUploadComplete }: UploadDialogProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("");
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useUser();

  const handleUpload = async (result: any) => {
    if (!user || !result) return;
    
    try {
      const title = documentTitle.trim() || result.name.replace(/\.[^/.]+$/, "") || "Untitled Document";
      
      const response = await saveDocument({
        userId: user.id,
        title: title,
        fileName: result.name,
        fileUrl: result.url,
        fileKey: result.key,
        fileSize: result.size,
        folderId: folderId,
      });
      
      if (response.success && response.documentId) {
        toast({
          title: "Success",
          description: "Document uploaded successfully",
        });
        
        await onUploadComplete();
        
        router.push(`/chat-with-pdf/${response.documentId}`);
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to save document",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving document:", error);
      toast({
        title: "Error",
        description: "Failed to save document",
        variant: "destructive",
      });
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Upload to {folderName}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div>
          <label htmlFor="documentTitle" className="block text-sm font-medium mb-1">
            Document Title (optional)
          </label>
          <Input
            id="documentTitle"
            placeholder="Enter a title for your document"
            value={documentTitle}
            onChange={(e) => setDocumentTitle(e.target.value)}
          />
        </div>
        
        <div className="border-2 border-dashed rounded-lg p-4">
          <FirebasePdfUploader
            onUploadBegin={() => setIsUploading(true)}
            onUploadComplete={(result) => {
              setIsUploading(false);
              handleUpload(result);
            }}
            onUploadError={(error) => {
              setIsUploading(false);
              toast({
                title: "Upload Error",
                description: error.message,
                variant: "destructive",
              });
            }}
          />
        </div>
      </div>
    </DialogContent>
  );
};

interface FolderItemProps {
  folder: {
    id: number;
    name: string;
    documents: any[];
  };
  isSelected: boolean;
  onSelect: () => void;
  currentDocumentId?: number;
  onUploadComplete: () => Promise<void>;
}

const FolderItem = ({ folder, isSelected, onSelect, currentDocumentId, onUploadComplete }: FolderItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<number | null>(null);
  const [folderDeleteConfirmOpen, setFolderDeleteConfirmOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleDeleteDocument = async (documentId: number) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Document deleted successfully",
        });
        onUploadComplete(); // Refresh the folder contents
      } else {
        throw new Error("Failed to delete document");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    }
    setDocumentToDelete(null);
  };

  const handleDeleteFolder = async () => {
    try {
      const response = await fetch(`/api/folders/${folder.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Folder deleted successfully",
        });
        onUploadComplete(); // Refresh the folders list
      } else {
        throw new Error("Failed to delete folder");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete folder",
        variant: "destructive",
      });
    }
    setFolderDeleteConfirmOpen(false);
  };

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
        <div className="flex items-center">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 mr-1"
                onClick={(e) => e.stopPropagation()}
              >
                <Upload className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <UploadDialog 
              folderId={folder.id} 
              folderName={folder.name}
              onUploadComplete={onUploadComplete}
            />
          </Dialog>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 mr-1"
            onClick={(e) => {
              e.stopPropagation();
              setFolderDeleteConfirmOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
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
      </div>
      
      {isExpanded && folder.documents && folder.documents.length > 0 && (
        <div className="ml-4 mb-2 space-y-1">
          {folder.documents.map((doc) => (
            <div
              key={doc.id}
              className={cn(
                "flex items-center justify-between p-1 text-sm hover:bg-accent/50 rounded group",
                doc.id === currentDocumentId && "bg-primary/10 font-medium"
              )}
            >
              <div
                className="flex items-center flex-1 cursor-pointer"
                onClick={() => router.push(`/chat-with-pdf/${doc.id}`)}
              >
                <FileText className="h-4 w-4 mr-2" />
                <span className="truncate">{doc.title}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                onClick={() => {
                  setDocumentToDelete(doc.id);
                }}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Document Delete Confirmation */}
      <ConfirmDialog
        isOpen={documentToDelete !== null}
        onClose={() => setDocumentToDelete(null)}
        onConfirm={() => documentToDelete && handleDeleteDocument(documentToDelete)}
        title="Delete Document"
        description="Are you sure you want to delete this document? This action cannot be undone."
      />

      {/* Folder Delete Confirmation */}
      <ConfirmDialog
        isOpen={folderDeleteConfirmOpen}
        onClose={() => setFolderDeleteConfirmOpen(false)}
        onConfirm={handleDeleteFolder}
        title="Delete Folder"
        description="Are you sure you want to delete this folder and all its documents? This action cannot be undone."
      />
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

  useEffect(() => {
    fetchFolders();
  }, []);

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
        setNewFolderName("");
        setIsCreatingFolder(false);
        await fetchFolders();
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
              onUploadComplete={fetchFolders}
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