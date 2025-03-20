"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/nextjs";
import axios from "axios";

export default function ChatWithPDFDocument() {
  const params = useParams();
  const documentId = params.documentId as string;
  const [documentDetails, setDocumentDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const { toast } = useToast();
  const { user, isLoaded } = useUser();
  const router = useRouter();

  console.log("parameter", params);
  useEffect(() => {
    const fetchDocumentDetails = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get(`/api/documents/${documentId}`);
        setDocumentDetails(response.data);
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

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    // Add user message to chat
    const userMessage = {
      content: message,
      isUserMessage: true,
      timestamp: new Date().toISOString(),
    };
    
    setChatMessages((prev) => [...prev, userMessage]);
    setMessage("");
    
    try {
      // Show loading state
      const loadingMessage = {
        content: "Thinking...",
        isUserMessage: false,
        isLoading: true,
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, loadingMessage]);
      
      // Send request to API
      const response = await axios.post(`/api/chat/${documentId}`, {
        message: message.trim(),
      });
      
      // Remove loading message
      setChatMessages((prev) => prev.filter(msg => !msg.isLoading));
      
      // Add AI response to chat
      const aiMessage = {
        content: response.data.message,
        isUserMessage: false,
        sources: response.data.sources || [],
        referencedPages: response.data.referencedPages || [],
        timestamp: new Date().toISOString(),
      };
      
      setChatMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      
      // Remove loading message
      setChatMessages((prev) => prev.filter(msg => !msg.isLoading));
      
      // Add error message
      setChatMessages((prev) => [
        ...prev,
        {
          content: "Sorry, I encountered an error while processing your request. Please try again.",
          isUserMessage: false,
          isError: true,
          timestamp: new Date().toISOString(),
        },
      ]);
      
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
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
        Chat with: {documentDetails?.title || "PDF Document"}
      </h1>
      
      <ResizablePanelGroup direction="horizontal" className="min-h-[600px] rounded-lg border">
        {/* Chat Panel */}
        <ResizablePanel defaultSize={40} minSize={30}>
          <div className="flex flex-col h-full">
            <CardHeader className="px-4">
              <CardTitle>Chat</CardTitle>
              <CardDescription>
                Ask questions about your document
              </CardDescription>
            </CardHeader>
            
            <CardContent className="flex-1 overflow-auto p-4">
              <div className="space-y-4">
                {chatMessages.length === 0 ? (
                  <p className="text-center text-muted-foreground">
                    Start the conversation by asking a question about your PDF.
                  </p>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        msg.isUserMessage ? "justify-end" : "justify-start"
                      } mb-4`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-2 ${
                          msg.isUserMessage
                            ? "bg-primary text-primary-foreground"
                            : msg.isLoading
                            ? "bg-muted animate-pulse"
                            : msg.isError
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted"
                        }`}
                      >
                        {msg.isLoading ? (
                          <p>Thinking...</p>
                        ) : (
                          <>
                            <div>
                              <p>{msg.content}</p>
                            </div>
                            
                            {!msg.isUserMessage && msg.sources && msg.sources.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-border/50">
                                <p className="text-xs text-muted-foreground font-medium">Sources:</p>
                                <div className="mt-1 space-y-1">
                                  {msg.sources.map((source: any, idx: number) => (
                                    <div key={idx} className="text-xs text-muted-foreground">
                                      <span className="font-medium">
                                        Page {source.pageNumber}
                                        {source.chunkIndex !== undefined && ` (Chunk ${source.chunkIndex + 1})`}
                                      </span>
                                      {source.preview && (
                                        <span className="ml-1 opacity-75">{source.preview}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {!msg.isUserMessage && msg.referencedPages && msg.referencedPages.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-border/50">
                                <p className="text-xs text-muted-foreground font-medium">
                                  Referenced Pages: {msg.referencedPages.join(', ')}
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
            
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask a question..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button onClick={handleSendMessage}>Send</Button>
              </div>
            </div>
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