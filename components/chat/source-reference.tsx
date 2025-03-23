import React from 'react';
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";

interface SourceReferenceProps {
  source: {
    pageNumber: number;
    preview: string;
    score: number;
    pageUrl?: string;
  };
}

export function SourceReference({ source }: SourceReferenceProps) {
  // Function to scroll to a specific page in the PDF viewer
  const scrollToPage = (pageNumber: number) => {
    console.log(`Requesting navigation to page ${pageNumber}`);
    
    // Use window.postMessage to communicate with our custom PDF viewer
    window.postMessage({ type: 'scrollToPage', pageNumber }, '*');
  };

  return (
    <Card className="p-3 mb-2">
      <div className="flex justify-between items-start mb-1">
        <div className="font-medium">Page {source.pageNumber}</div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 px-2 text-blue-600"
          onClick={() => scrollToPage(source.pageNumber)}
        >
          <FileText className="h-3.5 w-3.5 mr-1" />
          View Page
        </Button>
      </div>
      <p className="text-sm text-gray-700">{source.preview}</p>
    </Card>
  );
} 