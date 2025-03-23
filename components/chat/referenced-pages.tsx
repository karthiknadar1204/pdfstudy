import React from 'react';
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

interface ReferencedPagesProps {
  pages: number[];
  pageUrlMap: Record<number, string>;
}

export function ReferencedPages({ pages, pageUrlMap }: ReferencedPagesProps) {
  // Function to scroll to a specific page in the PDF viewer
  const scrollToPage = (pageNumber: number) => {
    console.log(`Requesting navigation to page ${pageNumber}`);
    
    // Use window.postMessage to communicate with our custom PDF viewer
    window.postMessage({ type: 'scrollToPage', pageNumber }, '*');
  };

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium mb-2">Referenced Pages:</h4>
      <div className="flex flex-wrap gap-2">
        {pages.map((pageNum) => (
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
  );
} 