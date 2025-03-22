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
      // Add AI message with loading state
      const aiMessageId = Date.now().toString();
      const aiMessage = {
        id: aiMessageId,
        content: "",
        isUserMessage: false,
        isStreaming: true,
        sources: [],
        referencedPages: [],
        timestamp: new Date().toISOString(),
      };
      
      setChatMessages((prev) => [...prev, aiMessage]);
      
      // Fetch streaming response
      const response = await fetch(`/api/chat/${documentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable");
      }
      
      const decoder = new TextDecoder();
      let sources = [];
      let referencedPages = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.type === 'metadata') {
              sources = data.sources || [];
              referencedPages = data.referencedPages || [];
              
              // Update the AI message with metadata
              setChatMessages((prev) => 
                prev.map((msg) => 
                  msg.id === aiMessageId 
                    ? { ...msg, sources, referencedPages } 
                    : msg
                )
              );
            } 
            else if (data.type === 'content') {
              // Append content to the AI message
              setChatMessages((prev) => 
                prev.map((msg) => 
                  msg.id === aiMessageId 
                    ? { ...msg, content: msg.content + data.content } 
                    : msg
                )
              );
            }
            else if (data.type === 'error') {
              throw new Error(data.error);
            }
            else if (data.type === 'done') {
              // Mark streaming as complete
              setChatMessages((prev) => 
                prev.map((msg) => 
                  msg.id === aiMessageId 
                    ? { ...msg, isStreaming: false } 
                    : msg
                )
              );
            }
          } catch (e) {
            console.error("Error parsing streaming response:", e);
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      
      // Add error message
      setChatMessages((prev) => [
        ...prev.filter(msg => !msg.isStreaming),
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