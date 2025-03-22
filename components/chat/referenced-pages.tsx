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
    // Get the PDF viewer iframe
    const pdfViewer = document.getElementById('pdf-viewer');
    
    if (pdfViewer) {
      try {
        // Try to access the iframe's contentWindow
        if (pdfViewer.contentWindow) {
          // Try to use postMessage first
          pdfViewer.contentWindow.postMessage({ type: 'scrollToPage', pageNumber }, '*');
        }
        
        // Also update the iframe src as a fallback method
        const currentSrc = pdfViewer.getAttribute('src') || '';
        const baseUrl = currentSrc.split('#')[0];
        
        // Update the iframe src with the page parameter
        pdfViewer.setAttribute('src', `${baseUrl}#page=${pageNumber}`);
        
        console.log(`Navigating to page ${pageNumber}`);
      } catch (error) {
        console.error("Error scrolling to page:", error);
      }
    } else {
      console.warn("PDF viewer element not found");
      
      // Last resort: try to use the page URL directly
      if (pageUrlMap[pageNumber]) {
        const url = pageUrlMap[pageNumber];
        // Extract just the page parameter if it exists
        const pageParam = url.includes('#page=') ? url.split('#page=')[1] : pageNumber;
        window.location.hash = `page=${pageParam}`;
      }
    }
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