"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/nextjs";
import axios from "axios";
import { FileText, RefreshCw } from "lucide-react";

export default function DocumentSummary() {
  const params = useParams();
  const documentId = params.documentId as string;
  const [documentDetails, setDocumentDetails] = useState<any>(null);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    const fetchDocumentDetails = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get(`/api/summaries/${documentId}`);
        setDocumentDetails(response.data.document);
        setSummaries(response.data.summaries || []);
        
        // Check if summaries are still being generated
        const hasSummaries = response.data.summaries && response.data.summaries.length > 0;
        setIsSummaryLoading(!hasSummaries);
        
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching document:", error);
        toast({
          title: "Error",
          description: "Failed to load document details",
          variant: "destructive",
        });
        setIsLoading(false);
      }
    };

    if (documentId && user) {
      fetchDocumentDetails();
    }
  }, [documentId, toast, user]);

  const regenerateSummary = async () => {
    try {
      setIsSummaryLoading(true);
      toast({
        title: "Processing",
        description: "Regenerating summaries. This may take a minute...",
      });
      
      const response = await axios.post(`/api/summaries/${documentId}/regenerate`);
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Summaries are being regenerated. Please check back in a moment.",
        });
        
        // Refresh the page after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    } catch (error) {
      console.error("Error regenerating summaries:", error);
      toast({
        title: "Error",
        description: "Failed to regenerate summaries",
        variant: "destructive",
      });
      setIsSummaryLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-10 px-4">
        <div className="flex items-center justify-center h-64">
          <p>Loading document...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <h1 className="text-2xl font-bold mb-6">
        Summaries for: {documentDetails?.title || "PDF Document"}
      </h1>
      
      <ResizablePanelGroup direction="horizontal" className="min-h-[600px] rounded-lg border">
        {/* Summaries Panel */}
        <ResizablePanel defaultSize={40} minSize={30}>
          <div className="flex flex-col h-full">
            <CardHeader className="px-4">
              <div className="flex justify-between items-center">
                <CardTitle>Summaries</CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={regenerateSummary}
                  disabled={isSummaryLoading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              </div>
              <CardDescription>
                Chapter-wise summaries of your document
              </CardDescription>
            </CardHeader>
            
            <CardContent className="flex-1 overflow-auto p-4">
              {isSummaryLoading ? (
                <div className="space-y-4">
                  <p className="text-center text-muted-foreground mb-4">
                    Generating summaries... This may take a few minutes depending on document size.
                  </p>
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[80%]" />
                  </div>
                  <div className="space-y-3 mt-6">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[70%]" />
                  </div>
                </div>
              ) : summaries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-center text-muted-foreground">
                    No summaries available yet. Click "Regenerate" to create summaries.
                  </p>
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="w-full mb-4">
                    <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
                    <TabsTrigger value="chapters" className="flex-1">Chapters</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview" className="mt-0">
                    <div className="prose prose-sm max-w-none">
                      <h3 className="text-lg font-semibold mb-2">Document Overview</h3>
                      <div className="bg-muted/30 p-4 rounded-md">
                        {summaries.find(s => s.type === 'overview')?.content || 
                          "No overview available. Try regenerating the summaries."}
                      </div>
                      
                      <h3 className="text-lg font-semibold mt-6 mb-2">Key Points</h3>
                      <div className="bg-muted/30 p-4 rounded-md">
                        {summaries.find(s => s.type === 'key_points')?.content ? (
                          <div dangerouslySetInnerHTML={{ 
                            __html: summaries.find(s => s.type === 'key_points')?.content
                              .replace(/\n/g, '<br>')
                              .replace(/- /g, '• ') 
                          }} />
                        ) : (
                          "No key points available. Try regenerating the summaries."
                        )}
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="chapters" className="mt-0">
                    <div className="space-y-6">
                      {summaries
                        .filter(s => s.type === 'chapter')
                        .sort((a, b) => a.order - b.order)
                        .map((chapter, index) => (
                          <div key={index} className="border rounded-md p-4">
                            <h3 className="text-lg font-semibold mb-2">{chapter.title}</h3>
                            <div className="prose prose-sm max-w-none">
                              <p>{chapter.content}</p>
                            </div>
                          </div>
                        ))}
                        
                      {summaries.filter(s => s.type === 'chapter').length === 0 && (
                        <div className="text-center text-muted-foreground py-8">
                          No chapter summaries available. Try regenerating the summaries.
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </div>
        </ResizablePanel>
        
        <ResizableHandle />
        
        {/* PDF Viewer Panel */}
        <ResizablePanel defaultSize={60}>
          <div className="h-full flex flex-col">
            <CardHeader className="px-4">
              <CardTitle>Document Viewer</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              {documentDetails?.fileUrl && (
                <iframe
                  src={`${documentDetails.fileUrl}#toolbar=1`}
                  className="w-full h-full rounded-b-lg"
                  title="PDF Viewer"
                />
              )}
            </CardContent>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
} 