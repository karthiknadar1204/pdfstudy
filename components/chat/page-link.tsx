import React from 'react';
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface PageLinkProps {
  pageNumber: number;
  pageUrl?: string;
}

export function PageLink({ pageNumber, pageUrl }: PageLinkProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 mr-2 mb-2"
      onClick={() => pageUrl && window.open(pageUrl, '_blank')}
      disabled={!pageUrl}
    >
      <ExternalLink className="h-3.5 w-3.5 mr-1" />
      Page {pageNumber}
    </Button>
  );
} 