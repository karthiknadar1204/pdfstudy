import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

interface MessageDisplayProps {
  message: {
    id?: string;
    content: string;
    isUserMessage: boolean;
    isStreaming?: boolean;
    isError?: boolean;
    sources?: Array<{
      pageNumber: number;
      score: number;
      preview: string;
      chunkIndex?: number;
      pageUrl?: string;
    }>;
    referencedPages?: number[];
  };
}

export function MessageDisplay({ message }: MessageDisplayProps) {
  // Create a map of page numbers to URLs
  const pageUrlMap = React.useMemo(() => {
    if (!message.sources) return {};
    
    return message.sources.reduce((map, source) => {
      if (source.pageUrl) {
        map[source.pageNumber] = source.pageUrl;
      }
      return map;
    }, {} as Record<number, string>);
  }, [message.sources]);

  // Function to scroll to a specific page in the PDF viewer
  const scrollToPage = (pageNumber: number) => {
    console.log(`Requesting navigation to page ${pageNumber}`);
    
    // Use window.postMessage to communicate with our custom PDF viewer
    window.postMessage({ type: 'scrollToPage', pageNumber }, '*');
  };

  return (
    <div className={`flex ${message.isUserMessage ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] ${message.isUserMessage 
        ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2' 
        : 'bg-muted rounded-2xl rounded-tl-sm px-4 py-2'}`}>
        
        {message.isUserMessage ? (
          <div className="prose dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div>
            <div className="prose dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
            
            {!message.isUserMessage && message.referencedPages && message.referencedPages.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border/50">
                <h4 className="text-sm font-medium mb-2">Referenced Pages:</h4>
                <div className="flex flex-wrap gap-2">
                  {message.referencedPages.map((pageNum) => (
                    <Button
                      key={pageNum}
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => scrollToPage(pageNum)}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      Page {pageNum}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 