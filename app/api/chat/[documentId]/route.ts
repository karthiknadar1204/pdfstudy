import { NextRequest, NextResponse } from "next/server";
import { db } from "@/configs/db";
import { documents, users } from "@/configs/schema";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/nextjs/server";
import { generateResponseFromDocument } from "@/lib/embeddings";

export async function POST(
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

    // Get document ID from params
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

    // Parse the request body
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Generate a response based on the document content
    const response = await generateResponseFromDocument(message, documentId);

    return NextResponse.json({
      message: response.message,
      sources: response.sources,
      referencedPages: response.referencedPages
    });
  } catch (error) {
    console.error("Error processing chat:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 