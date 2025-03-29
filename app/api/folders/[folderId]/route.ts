import { NextRequest, NextResponse } from "next/server";
import { db } from "@/configs/db";
import { folders, documentFolders, documents } from "@/configs/schema";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/nextjs/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { folderId: string } }
) {
  try {
    const { userId } = getAuth(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const folderId = parseInt(params.folderId);
    
    if (isNaN(folderId)) {
      return NextResponse.json(
        { error: "Invalid folder ID" },
        { status: 400 }
      );
    }

    try {
      // Get all document IDs in this folder
      const docFolders = await db
        .select({ documentId: documentFolders.documentId })
        .from(documentFolders)
        .where(eq(documentFolders.folderId, folderId));

      // Delete document folders associations
      await db
        .delete(documentFolders)
        .where(eq(documentFolders.folderId, folderId));

      // Delete all documents in the folder
      for (const df of docFolders) {
        await db
          .delete(documents)
          .where(eq(documents.id, df.documentId));
      }

      // Delete the folder itself
      await db
        .delete(folders)
        .where(eq(folders.id, folderId));

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error in delete operations:", error);
      throw error;
    }

  } catch (error) {
    console.error("Error deleting folder:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 