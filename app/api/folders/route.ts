import { NextRequest, NextResponse } from "next/server";
import { db } from "@/configs/db";
import { folders, users, documentFolders, documents } from "@/configs/schema";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/nextjs/server";
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get folders with their documents
    const userFolders = await db.query.folders.findMany({
      where: eq(folders.userId, user.id),
      orderBy: (folders, { desc }) => [desc(folders.createdAt)],
    });

    // For each folder, get its documents
    const foldersWithDocs = await Promise.all(
      userFolders.map(async (folder) => {
        const docs = await db.select()
          .from(documents)
          .innerJoin(documentFolders, eq(documents.id, documentFolders.documentId))
          .where(eq(documentFolders.folderId, folder.id));

        return {
          ...folder,
          documents: docs.map(({ documents: doc }) => doc),
        };
      })
    );

    return NextResponse.json(foldersWithDocs);
  } catch (error) {
    console.error("Error fetching folders:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const { name } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      );
    }

    // Generate a UUID for the new folder
    const uuid = uuidv4();

    const [folder] = await db.insert(folders)
      .values({
        uuid,
        name,
        userId: user.id,
      })
      .returning();

    return NextResponse.json({
      ...folder,
      documents: [],
    });
  } catch (error) {
    console.error("Error creating folder:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 