import { NextRequest, NextResponse } from "next/server";
import { db } from "@/configs/db";
import { documentChats } from "@/configs/schema";
import { eq, and } from "drizzle-orm";
import { getAuth } from "@clerk/nextjs/server";

// GET endpoint to retrieve chat history for a document
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

    const documentId = parseInt(params.documentId);
    
    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: "Invalid document ID" },
        { status: 400 }
      );
    }

    // Get chat history for this document and user
    const chatHistory = await db.query.documentChats.findFirst({
      where: and(
        eq(documentChats.documentId, documentId),
        eq(documentChats.userId, userId)
      )
    });

    if (!chatHistory) {
      return NextResponse.json({ conversations: { messages: [], lastUpdated: new Date().toISOString() } });
    }

    return NextResponse.json(chatHistory.conversations);
  } catch (error) {
    console.error("Error retrieving chat history:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST endpoint to save chat messages
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

    const documentId = parseInt(params.documentId);
    
    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: "Invalid document ID" },
        { status: 400 }
      );
    }

    const { messages } = await request.json();
    
    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    // Check if a chat record already exists for this document and user
    const existingChat = await db.query.documentChats.findFirst({
      where: and(
        eq(documentChats.documentId, documentId),
        eq(documentChats.userId, userId)
      )
    });

    const now = new Date().toISOString();
    const conversations = {
      messages,
      lastUpdated: now
    };

    if (existingChat) {
      // Update existing chat record
      await db.update(documentChats)
        .set({
          conversations,
          updatedAt: new Date()
        })
        .where(and(
          eq(documentChats.documentId, documentId),
          eq(documentChats.userId, userId)
        ));
    } else {
      // Create new chat record
      await db.insert(documentChats).values({
        documentId,
        userId,
        conversations,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving chat messages:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 