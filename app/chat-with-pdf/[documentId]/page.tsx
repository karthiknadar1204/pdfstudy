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
import { MessageDisplay } from "@/components/chat/message-display";

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
        body: JSON.stringify({ message }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response');
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('Failed to read response');
      }
      
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
      console.error('Error sending message:', error);
      
      // Add error message
      setChatMessages((prev) => [
        ...prev,
        {
          content: "Sorry, there was an error processing your request. Please try again.",
          isUserMessage: false,
          isError: true,
          timestamp: new Date().toISOString(),
        },
      ]);
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
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <h3 className="text-lg font-medium">Chat with your document</h3>
                      <p className="text-sm text-muted-foreground">
                        Ask questions about "{documentDetails?.title || 'your document'}"
                      </p>
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg, index) => (
                    <MessageDisplay key={index} message={msg} />
                  ))
                )}
              </div>
            </CardContent>
            
            <div className="border-t p-4">
              <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask a question about your document..."
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading || !message.trim()}>
                  Send
                </Button>
              </form>
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