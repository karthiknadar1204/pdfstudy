import { NextRequest, NextResponse } from "next/server";
import { db } from "@/configs/db";
import { documents, users, summaries } from "@/configs/schema";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/nextjs/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const { userId } = getAuth(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { documentId: documentIdStr } = params;
    const documentId = parseInt(documentIdStr);
    
    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: "Invalid document ID" },
        { status: 400 }
      );
    }

    // Get the user's ID from the database
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get the document
    const document = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Check if the document belongs to the user
    if (document.userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Get the summaries for this document
    const documentSummary = await db.query.summaries.findFirst({
      where: eq(summaries.documentId, documentId),
    });

    // Format the response to maintain compatibility with the frontend
    const formattedSummaries = [];
    
    if (documentSummary?.content) {
      const content = documentSummary.content;
      
      // Add overview
      if (content.overview) {
        formattedSummaries.push({
          id: `${documentId}-overview`,
          documentId,
          type: 'overview',
          title: content.overview.title,
          content: content.overview.content,
          order: content.overview.order
        });
      }
      
      // Add key points
      if (content.keyPoints) {
        formattedSummaries.push({
          id: `${documentId}-keypoints`,
          documentId,
          type: 'key_points',
          title: content.keyPoints.title,
          content: content.keyPoints.content,
          order: content.keyPoints.order
        });
      }
      
      // Add chapters
      if (content.chapters && Array.isArray(content.chapters)) {
        content.chapters.forEach((chapter, index) => {
          formattedSummaries.push({
            id: `${documentId}-chapter-${index}`,
            documentId,
            type: 'chapter',
            title: chapter.title,
            content: chapter.content,
            order: chapter.order
          });
        });
      }
    }

    return NextResponse.json({
      document,
      summaries: formattedSummaries
    });
  } catch (error) {
    console.error("Error fetching document summaries:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 