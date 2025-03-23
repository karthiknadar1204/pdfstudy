import React, { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PDFViewerProps {
  fileUrl: string;
}

export function PDFViewer({ fileUrl }: PDFViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  
  // Function to navigate to a specific page
  const goToPage = (pageNumber: number) => {
    if (iframeRef.current) {
      console.log(`PDF Viewer: Navigating to page ${pageNumber}`);
      
      try {
        // Create a new URL with the page parameter
        const baseUrl = fileUrl.split('#')[0];
        const newSrc = `${baseUrl}#page=${pageNumber}`;
        
        // Force a reload by temporarily setting to about:blank
        iframeRef.current.src = 'about:blank';
        
        // After a short delay, set to the new URL
        setTimeout(() => {
          if (iframeRef.current) {
            iframeRef.current.src = newSrc;
            console.log(`Set iframe src to: ${newSrc}`);
            setCurrentPage(pageNumber);
          }
        }, 50);
      } catch (error) {
        console.error("Error navigating to page:", error);
      }
    }
  };
  
  // Set up a message listener to handle page navigation requests
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'scrollToPage') {
        const pageNumber = event.data.pageNumber;
        console.log(`PDF Viewer received request to navigate to page ${pageNumber}`);
        goToPage(pageNumber);
      }
    };
    
    window.addEventListener('message', handleMessage);
    console.log("PDF Viewer: Added message event listener");
    
    return () => {
      window.removeEventListener('message', handleMessage);
      console.log("PDF Viewer: Removed message event listener");
    };
  }, []);
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b">
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => goToPage(Math.max(1, currentPage - 1))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm">
            Page {currentPage} {totalPages > 0 ? `of ${totalPages}` : ''}
          </span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
      
      <iframe
        ref={iframeRef}
        id="pdf-viewer"
        src={`${fileUrl}#page=1`}
        className="flex-1 w-full border-0"
        title="PDF Viewer"
        onLoad={() => {
          console.log("PDF viewer iframe loaded");
        }}
      />
    </div>
  );
} 