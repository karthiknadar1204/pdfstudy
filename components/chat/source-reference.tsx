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
    // Get the PDF viewer iframe
    const pdfViewer = document.getElementById('pdf-viewer');
    
    if (pdfViewer) {
      try {
        console.log(`Attempting to navigate to page ${pageNumber}`);
        
        // For Firebase Storage PDFs, we need to completely reload the iframe with the page parameter
        const currentSrc = pdfViewer.getAttribute('src') || '';
        
        // Extract the base URL without any hash parameters
        const baseUrl = currentSrc.split('#')[0];
        
        // Create a new URL with just the page parameter
        // Using view=FitH to ensure the page fits horizontally in the viewer
        const newSrc = `${baseUrl}#page=${pageNumber}&view=FitH`;
        
        console.log(`Setting iframe src to: ${newSrc}`);
        
        // Replace the iframe src to navigate to the specific page
        pdfViewer.setAttribute('src', newSrc);
        
      } catch (error) {
        console.error("Error scrolling to page:", error);
      }
    } else {
      console.warn("PDF viewer element not found");
      
      // Last resort: try to use the page URL directly
      if (source.pageUrl) {
        const url = source.pageUrl;
        window.open(`${url.split('#')[0]}#page=${pageNumber}`, '_blank');
      }
    }
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