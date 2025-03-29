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
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Function to navigate to a specific page
  const goToPage = (pageNumber: number) => {
    if (iframeRef.current) {
      console.log(`PDF Viewer: Navigating to page ${pageNumber}`);
      
      try {
        // Set navigating state to show transition effect
        setIsNavigating(true);
        
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
            
            // Reset navigating state after a delay to complete the transition
            setTimeout(() => {
              setIsNavigating(false);
            }, 300);
          }
        }, 50);
      } catch (error) {
        console.error("Error navigating to page:", error);
        setIsNavigating(false);
      }
    }
  };
  
  // Set up message listener for page navigation requests
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'scrollToPage' && event.data?.pageNumber) {
        console.log(`PDF Viewer received request to navigate to page ${event.data.pageNumber}`);
        const pageNumber = parseInt(event.data.pageNumber);
        if (!isNaN(pageNumber) && pageNumber > 0) {
          goToPage(pageNumber);
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    console.log("PDF Viewer: Added message event listener");
    
    return () => {
      window.removeEventListener('message', handleMessage);
      console.log("PDF Viewer: Removed message event listener");
    };
  }, []);
  
  // Add an effect to detect total pages when the PDF loads
  useEffect(() => {
    // Function to attempt to get total pages from the PDF viewer
    const detectTotalPages = () => {
      if (iframeRef.current) {
        try {
          // Try to access the PDF viewer's document to get page count
          const iframeWindow = iframeRef.current.contentWindow;
          
          if (iframeWindow) {
            // Check if PDF.js is loaded in the iframe
            if (iframeWindow.PDFViewerApplication) {
              const pdfViewer = iframeWindow.PDFViewerApplication;
              
              // Check if the PDF is loaded
              if (pdfViewer.pdfDocument) {
                const pageCount = pdfViewer.pagesCount || pdfViewer.pdfDocument.numPages;
                console.log(`PDF Viewer: Detected ${pageCount} total pages`);
                setTotalPages(pageCount);
              } else {
                // PDF document not yet loaded, try again later
                setTimeout(detectTotalPages, 500);
              }
            } else {
              // PDF.js not yet initialized, try again later
              setTimeout(detectTotalPages, 500);
            }
          }
        } catch (error) {
          console.error("Error detecting total pages:", error);
        }
      }
    };
    
    // Set up a load event listener for the iframe
    const handleIframeLoad = () => {
      console.log("PDF viewer iframe loaded, attempting to detect total pages");
      // Give the PDF.js viewer a moment to initialize
      setTimeout(detectTotalPages, 1000);
    };
    
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.addEventListener('load', handleIframeLoad);
    }
    
    return () => {
      if (iframe) {
        iframe.removeEventListener('load', handleIframeLoad);
      }
    };
  }, [fileUrl]);
  
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-2 border-b shrink-0">
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => goToPage(Math.max(1, currentPage - 1))}
            disabled={isNavigating || currentPage <= 1}
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
            disabled={isNavigating || (totalPages > 0 && currentPage >= totalPages)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
      
      <div className="relative flex-1 overflow-hidden">
        {isNavigating && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 transition-opacity duration-300">
            <div className="animate-pulse">Navigating to page {currentPage}...</div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          id="pdf-viewer"
          src={`${fileUrl}#page=1`}
          className={`w-full h-full border-0 transition-opacity duration-300 ${isNavigating ? 'opacity-30' : 'opacity-100'}`}
          title="PDF Viewer"
          onLoad={() => {
            console.log("PDF viewer iframe loaded");
          }}
        />
      </div>
    </div>
  );
} 