import React, { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";

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
      // Update the iframe src with the page parameter
      const baseUrl = fileUrl.split('#')[0];
      iframeRef.current.src = `${baseUrl}#page=${pageNumber}`;
      setCurrentPage(pageNumber);
    }
  };
  
  // Set up a message listener to handle page navigation requests
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'scrollToPage') {
        goToPage(event.data.pageNumber);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
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
          console.log("PDF viewer loaded");
        }}
      />
    </div>
  );
} 