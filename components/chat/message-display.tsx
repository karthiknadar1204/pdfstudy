import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    }>;
    referencedPages?: number[];
  };
}

export function MessageDisplay({ message }: MessageDisplayProps) {
  // Sort sources by score (highest first)
  const sortedSources = message.sources 
    ? [...message.sources].sort((a, b) => b.score - a.score)
    : [];

  return (
    <div className={`flex ${message.isUserMessage ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 ${
          message.isUserMessage
            ? "bg-primary text-primary-foreground"
            : message.isError
            ? "bg-destructive/10 text-destructive"
            : "bg-card border"
        }`}
      >
        {message.isStreaming ? (
          <div>
            <div className="prose dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content || "Thinking..."}
              </ReactMarkdown>
              <span className="inline-block animate-pulse">▋</span>
            </div>
            
            {message.sources && message.sources.length > 0 && (
              <div className="mt-3 pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground font-medium mb-1">Sources:</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {message.referencedPages?.map(page => (
                    <Badge key={page} variant="outline" className="text-xs">
                      Page {page}
                    </Badge>
                  ))}
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {sortedSources.slice(0, 3).map((source, idx) => (
                    <Card key={idx} className="p-2 text-xs text-muted-foreground">
                      <div className="font-medium flex justify-between">
                        <span>Page {source.pageNumber}</span>
                        <span className="text-xs opacity-70">
                          {Math.round(source.score * 100)}% match
                        </span>
                      </div>
                      {source.preview && (
                        <p className="mt-1 opacity-85 text-xs line-clamp-2">{source.preview}</p>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="prose dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
            
            {!message.isUserMessage && message.sources && message.sources.length > 0 && (
              <div className="mt-3 pt-2 border-t border-border/50">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-xs text-muted-foreground font-medium">Sources:</p>
                  {message.referencedPages && message.referencedPages.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Referenced Pages: {message.referencedPages.join(', ')}
                    </p>
                  )}
                </div>
                
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {sortedSources.map((source, idx) => (
                    <Card key={idx} className="p-2 text-xs text-muted-foreground">
                      <div className="font-medium flex justify-between">
                        <span>
                          Page {source.pageNumber}
                          {source.chunkIndex !== undefined && ` (Chunk ${source.chunkIndex + 1})`}
                        </span>
                        <span className="text-xs opacity-70">
                          {Math.round(source.score * 100)}% match
                        </span>
                      </div>
                      {source.preview && (
                        <p className="mt-1 opacity-85 text-xs">{source.preview}</p>
                      )}
                    </Card>
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