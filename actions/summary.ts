'use server'

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/configs/db";
import { documents, users, summaries } from "@/configs/schema";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/nextjs/server";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { generateDocumentOverview } from "@/actions/summary";
import { identifyAndSummarizeChapters } from "@/actions/summary";
import path from "path";
import fs from "fs/promises";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type DocumentData = {
  userId: string; 
  title: string;
  fileName: string;
  fileUrl: string;
  fileKey: string;
  fileSize: number;
};

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

    const userDocuments = await db.query.documents.findMany({
      where: eq(documents.userId, user.id),
      orderBy: (documents, { desc }) => [desc(documents.createdAt)],
    });

    return NextResponse.json(userDocuments);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function saveDocumentForSummary(documentData: DocumentData) {
  try {
    // Find user ID from clerk ID
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, documentData.userId),
    });

    if (!user) {
      return { success: false, message: "User not found" };
    }

    // Save document to database
    const [document] = await db.insert(documents)
      .values({
        userId: user.id,
        title: documentData.title,
        fileName: documentData.fileName,
        fileUrl: documentData.fileUrl,
        fileKey: documentData.fileKey,
        fileSize: documentData.fileSize,
      })
      .returning();
    
    const documentId = document.id;
    console.log(`Document saved with ID: ${documentId}`);
    
    // Start processing in a non-blocking way
    (async () => {
      try {
        console.log("Starting summary generation for document:", documentId);
        
        // Download the PDF
        const response = await fetch(documentData.fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }
        
        const pdfBuffer = Buffer.from(await response.arrayBuffer());
        
        // Create temporary directory
        const tempDir = path.join(process.cwd(), 'temp');
        await fs.mkdir(tempDir, { recursive: true });
        
        // Save PDF to temp file for PDFLoader
        const tempFilePath = path.join(tempDir, `${documentId}.pdf`);
        await fs.writeFile(tempFilePath, pdfBuffer);
        
        // Use PDFLoader to extract text content
        const loader = new PDFLoader(tempFilePath, {
          parsedItemSeparator: "",
        });
        const docs = await loader.load();
        const pageCount = docs.length;
        
        console.log(`Document ID: ${documentId}, Page Count: ${pageCount}`);
        
        // Extract content from all pages
        const allContent = docs.map(doc => doc.pageContent).join("\n\n");
        
        // Generate document overview
        await generateDocumentOverview(documentId, allContent);
        
        // Identify chapters and generate chapter summaries
        await identifyAndSummarizeChapters(documentId, docs);
        
        // Clean up temp file
        await fs.unlink(tempFilePath);
        
        // Update document's updatedAt timestamp
        await db.update(documents)
          .set({ 
            updatedAt: new Date()
          })
          .where(eq(documents.id, documentId));
          
        console.log(`Document ${documentId} summary generation completed successfully`);
        
      } catch (error) {
        console.error("=== ERROR PROCESSING PDF FOR SUMMARY ===", error);
        
        // Update the timestamp to indicate something happened
        await db.update(documents)
          .set({ 
            updatedAt: new Date()
          })
          .where(eq(documents.id, documentId));
      }
    })();
    
    // Return success immediately
    return { 
      success: true, 
      message: "Document saved successfully. Summary generation started in background.",
      documentId
    };
    
  } catch (error) {
    console.error("=== ERROR SAVING DOCUMENT FOR SUMMARY ===", error);
    return { success: false, message: "Failed to save document" };
  }
}

async function generateDocumentOverview(documentId: number, content: string) {
  try {
    // Generate an overview of the entire document
    const overviewPrompt = `
      You are an expert at summarizing academic and professional documents.
      Please provide a concise overview of the following document.
      Focus on the main themes, purpose, and scope of the document.
      Keep your response to 3-4 paragraphs maximum.
      
      Document content:
      ${content.slice(0, 15000)}... [content truncated for length]
    `;
    
    const overviewResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert summarizer that creates concise, accurate document overviews." },
        { role: "user", content: overviewPrompt }
      ],
      temperature: 0.5,
      max_tokens: 1000,
    });
    
    const overview = overviewResponse.choices[0].message.content || "Failed to generate overview.";
    
    // Generate key points
    const keyPointsPrompt = `
      Based on the document content, extract 5-10 key points or takeaways.
      Format each point as a bullet point starting with "- ".
      Focus on the most important concepts, findings, or arguments.
      
      Document content:
      ${content.slice(0, 15000)}... [content truncated for length]
    `;
    
    const keyPointsResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert at identifying and extracting key points from documents." },
        { role: "user", content: keyPointsPrompt }
      ],
      temperature: 0.5,
      max_tokens: 1000,
    });
    
    const keyPoints = keyPointsResponse.choices[0].message.content || "Failed to generate key points.";
    
    // Create initial summaries object
    const summariesContent = {
      overview: {
        title: 'Document Overview',
        content: overview,
        order: 0
      },
      keyPoints: {
        title: 'Key Points',
        content: keyPoints,
        order: 1
      },
      chapters: [] // Will be populated later
    };
    
    // Check if a summary record already exists
    const existingSummary = await db.query.summaries.findFirst({
      where: eq(summaries.documentId, documentId),
    });
    
    if (existingSummary) {
      // Update existing record
      await db.update(summaries)
        .set({
          content: summariesContent,
          updatedAt: new Date()
        })
        .where(eq(summaries.documentId, documentId));
    } else {
      // Create new record
      await db.insert(summaries)
        .values({
          documentId,
          content: summariesContent,
        });
    }
    
    console.log(`Generated overview and key points for document ${documentId}`);
    return summariesContent;
    
  } catch (error) {
    console.error("Error generating document overview:", error);
    throw error;
  }
}

async function identifyAndSummarizeChapters(documentId: number, docs: any[]) {
  try {
    // Get existing summaries content
    const existingSummary = await db.query.summaries.findFirst({
      where: eq(summaries.documentId, documentId),
    });
    
    let summariesContent = existingSummary?.content || {
      overview: { title: 'Document Overview', content: '', order: 0 },
      keyPoints: { title: 'Key Points', content: '', order: 1 },
      chapters: []
    };
    
    // Combine all page content
    const allContent = docs.map(doc => doc.pageContent).join("\n\n");
    
    // Ask GPT to identify chapter structure
    const chapterIdentificationPrompt = `
      Analyze the following document and identify its chapter or section structure.
      Return a JSON array of chapters with the following format:
      [
        {
          "title": "Chapter/Section Title",
          "startMarker": "Text that indicates the start of this chapter"
        }
      ]
      
      If the document doesn't have clear chapters, create logical divisions based on content themes.
      Aim for 3-7 chapters/sections total.
      
      Document content:
      ${allContent.slice(0, 15000)}... [content truncated for length]
    `;
    
    const chapterResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert at analyzing document structure and identifying chapters or logical sections." },
        { role: "user", content: chapterIdentificationPrompt }
      ],
      temperature: 0.5,
      max_tokens: 1500,
      response_format: { type: "json_object" }
    });
    
    let chapters;
    try {
      // Parse the JSON response
      const responseContent = chapterResponse.choices[0].message.content || "{}";
      const parsedResponse = JSON.parse(responseContent);
      chapters = parsedResponse.chapters || [];
      
      if (!Array.isArray(chapters) || chapters.length === 0) {
        throw new Error("Invalid chapter structure returned");
      }
    } catch (parseError) {
      console.error("Error parsing chapter structure:", parseError);
      // Fallback to a simple structure
      chapters = [
        { title: "Introduction", startMarker: "" },
        { title: "Main Content", startMarker: "" },
        { title: "Conclusion", startMarker: "" }
      ];
    }
    
    console.log(`Identified ${chapters.length} chapters for document ${documentId}`);
    
    // Split content into chapters
    const chapterContents = [];
    
    if (chapters.length === 1) {
      // If only one chapter, use all content
      chapterContents.push({
        title: chapters[0].title,
        content: allContent
      });
    } else {
      // Split content based on chapter markers
      for (let i = 0; i < chapters.length; i++) {
        const currentChapter = chapters[i];
        const nextChapter = i < chapters.length - 1 ? chapters[i + 1] : null;
        
        let chapterContent = "";
        
        if (i === 0 && currentChapter.startMarker) {
          // First chapter with a start marker
          const startIndex = allContent.indexOf(currentChapter.startMarker);
          if (startIndex >= 0) {
            if (nextChapter && nextChapter.startMarker) {
              const endIndex = allContent.indexOf(nextChapter.startMarker);
              if (endIndex > startIndex) {
                chapterContent = allContent.substring(startIndex, endIndex);
              } else {
                chapterContent = allContent.substring(startIndex);
              }
            } else {
              chapterContent = allContent.substring(startIndex);
            }
          } else {
            // Start marker not found, use beginning of document
            if (nextChapter && nextChapter.startMarker) {
              const endIndex = allContent.indexOf(nextChapter.startMarker);
              if (endIndex > 0) {
                chapterContent = allContent.substring(0, endIndex);
              } else {
                // Divide document evenly
                const chunkSize = Math.floor(allContent.length / chapters.length);
                chapterContent = allContent.substring(0, chunkSize);
              }
            } else {
              // Divide document evenly
              const chunkSize = Math.floor(allContent.length / chapters.length);
              chapterContent = allContent.substring(0, chunkSize);
            }
          }
        } else if (currentChapter.startMarker) {
          // Middle chapters with start markers
          const startIndex = allContent.indexOf(currentChapter.startMarker);
          if (startIndex >= 0) {
            if (nextChapter && nextChapter.startMarker) {
              const endIndex = allContent.indexOf(nextChapter.startMarker);
              if (endIndex > startIndex) {
                chapterContent = allContent.substring(startIndex, endIndex);
              } else {
                chapterContent = allContent.substring(startIndex);
              }
            } else {
              chapterContent = allContent.substring(startIndex);
            }
          } else {
            // Start marker not found, divide document evenly
            const chunkSize = Math.floor(allContent.length / chapters.length);
            const startPos = i * chunkSize;
            const endPos = nextChapter ? (i + 1) * chunkSize : undefined;
            chapterContent = allContent.substring(startPos, endPos);
          }
        } else {
          // Fallback: divide document evenly
          const chunkSize = Math.floor(allContent.length / chapters.length);
          const startPos = i * chunkSize;
          const endPos = nextChapter ? (i + 1) * chunkSize : undefined;
          chapterContent = allContent.substring(startPos, endPos);
        }
        
        chapterContents.push({
          title: currentChapter.title,
          content: chapterContent
        });
      }
    }
    
    // Generate summaries for each chapter
    const chapterSummaries = [];
    
    for (let i = 0; i < chapterContents.length; i++) {
      const chapter = chapterContents[i];
      
      // Skip empty chapters
      if (!chapter.content.trim()) {
        continue;
      }
      
      const chapterSummaryPrompt = `
        You are summarizing a chapter or section of a document titled "${chapter.title}".
        Please provide a concise summary of the following content.
        Focus on the main points, key arguments, and important details.
        Keep your summary to 2-3 paragraphs.
        
        Chapter content:
        ${chapter.content.slice(0, 10000)}... [content truncated for length]
      `;
      
      const summaryResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are an expert summarizer that creates concise, accurate chapter summaries." },
          { role: "user", content: chapterSummaryPrompt }
        ],
        temperature: 0.5,
        max_tokens: 800,
      });
      
      const chapterSummary = summaryResponse.choices[0].message.content || "Failed to generate chapter summary.";
      
      chapterSummaries.push({
        title: chapter.title,
        content: chapterSummary,
        order: i + 2 // Start after overview and key points
      });
      
      console.log(`Generated summary for chapter "${chapter.title}" of document ${documentId}`);
    }
    
    // Update the summaries content with chapter summaries
    summariesContent.chapters = chapterSummaries;
    
    // Update the database record
    if (existingSummary) {
      await db.update(summaries)
        .set({
          content: summariesContent,
          updatedAt: new Date()
        })
        .where(eq(summaries.documentId, documentId));
    } else {
      await db.insert(summaries)
        .values({
          documentId,
          content: summariesContent,
        });
    }
    
    return summariesContent;
    
  } catch (error) {
    console.error("Error identifying and summarizing chapters:", error);
    throw error;
  }
}

export async function regenerateSummaries(documentId: number) {
  try {
    // Delete existing summaries
    await db.delete(summaries)
      .where(eq(summaries.documentId, documentId));
    
    // Get document details
    const document = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });
    
    if (!document) {
      return { success: false, message: "Document not found" };
    }
    
    // Download the PDF
    const response = await fetch(document.fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }
    
    const pdfBuffer = Buffer.from(await response.arrayBuffer());
    
    // Create temporary directory
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    // Save PDF to temp file for PDFLoader
    const tempFilePath = path.join(tempDir, `${documentId}.pdf`);
    await fs.writeFile(tempFilePath, pdfBuffer);
    
    // Use PDFLoader to extract text content
    const loader = new PDFLoader(tempFilePath, {
      parsedItemSeparator: "",
    });
    const docs = await loader.load();
    
    // Extract content from all pages
    const allContent = docs.map(doc => doc.pageContent).join("\n\n");
    
    // Generate document overview
    await generateDocumentOverview(documentId, allContent);
    
    // Identify chapters and generate chapter summaries
    await identifyAndSummarizeChapters(documentId, docs);
    
    // Clean up temp file
    await fs.unlink(tempFilePath);
    
    // Update document's updatedAt timestamp
    await db.update(documents)
      .set({ 
        updatedAt: new Date()
      })
      .where(eq(documents.id, documentId));
    
    return { success: true, message: "Summaries regenerated successfully" };
    
  } catch (error) {
    console.error("Error regenerating summaries:", error);
    return { success: false, message: "Failed to regenerate summaries" };
  }
} 