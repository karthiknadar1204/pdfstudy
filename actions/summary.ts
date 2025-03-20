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

async function generateDocumentOverview(
  documentId: number, 
  content: string,
  options?: {
    focusChapters?: string[];
    focusTopics?: string[];
    customInstructions?: string;
  }
) {
  try {
    // Generate an overview of the entire document
    let overviewPrompt = `
      You are an expert at summarizing academic and professional documents.
      Please provide a concise overview of the following document.
      Focus on the main themes, purpose, and scope of the document.
      Keep your response to 3-4 paragraphs maximum.
    `;
    
    // Add user preferences if provided
    if (options?.focusTopics?.length) {
      overviewPrompt += `\nPay special attention to these topics: ${options.focusTopics.join(', ')}.`;
    }
    
    if (options?.customInstructions) {
      overviewPrompt += `\nAdditional instructions: ${options.customInstructions}`;
    }
    
    overviewPrompt += `\n\nDocument content:\n${content.slice(0, 15000)}... [content truncated for length]`;
    
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
    
    // Generate key points with user preferences
    let keyPointsPrompt = `
      Based on the document content, extract 5-10 key points or takeaways.
      Format each point as a bullet point starting with "- ".
      Focus on the most important concepts, findings, or arguments.
    `;
    
    // Add user preferences if provided
    if (options?.focusTopics?.length) {
      keyPointsPrompt += `\nEnsure you include key points related to these topics: ${options.focusTopics.join(', ')}.`;
    }
    
    if (options?.customInstructions) {
      keyPointsPrompt += `\nAdditional instructions: ${options.customInstructions}`;
    }
    
    keyPointsPrompt += `\n\nDocument content:\n${content.slice(0, 15000)}... [content truncated for length]`;
    
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

async function identifyAndSummarizeChapters(documentId: number, docs: any[], options?: {
  focusChapters?: string[];
  focusTopics?: string[];
  customInstructions?: string;
}) {
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
    
    // Get document metadata
    const pageCount = docs.length;
    console.log(`Processing document with ${pageCount} pages`);
    
    // For very large documents, we need to be selective about content analysis
    // Sample pages from beginning, middle, and end to identify structure
    const samplePages = [];
    
    // Always include first 10 pages
    const startPages = docs.slice(0, Math.min(10, pageCount));
    samplePages.push(...startPages);
    
    // Include some middle pages if document is large
    if (pageCount > 20) {
      const middleStart = Math.floor(pageCount / 2) - 5;
      const middlePages = docs.slice(middleStart, middleStart + 10);
      samplePages.push(...middlePages);
    }
    
    // Include some end pages
    if (pageCount > 10) {
      const endPages = docs.slice(Math.max(0, pageCount - 10), pageCount);
      samplePages.push(...endPages);
    }
    
    // Combine sample pages content for structure analysis
    const sampleContent = samplePages.map(doc => doc.pageContent).join("\n\n");
    
    // Ask GPT to analyze document structure and identify chapter pattern
    const structureAnalysisPrompt = `
      You are analyzing a large document with ${pageCount} pages to identify its chapter structure.
      
      First, determine the pattern used for chapter headings in this document.
      Look for patterns like "Chapter X:", "X. Chapter Title", numbered sections, etc.
      
      Then, estimate how many chapters this document likely contains based on the patterns you identified.
      
      Return your analysis as JSON with the following format:
      {
        "chapterPattern": "Description of how chapters are marked in this document",
        "estimatedChapterCount": number,
        "chapterIdentifiers": ["List of text patterns that indicate chapter starts"],
        "shouldIncludeFrontMatter": boolean,
        "recommendedChapterLimit": number
      }
      
      Sample content from the document (beginning, middle, and end):
      ${sampleContent.slice(0, 15000)}... [content truncated for length]
    `;
    
    const structureResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert at analyzing document structure and identifying chapter patterns." },
        { role: "user", content: structureAnalysisPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });
    
    // Parse structure analysis
    let structureAnalysis;
    try {
      const responseContent = structureResponse.choices[0].message.content || "{}";
      structureAnalysis = JSON.parse(responseContent);
      console.log("Document structure analysis:", structureAnalysis);
    } catch (parseError) {
      console.error("Error parsing structure analysis:", parseError);
      structureAnalysis = {
        chapterPattern: "Unknown",
        estimatedChapterCount: 10,
        chapterIdentifiers: ["Chapter", "Section"],
        shouldIncludeFrontMatter: false,
        recommendedChapterLimit: 15
      };
    }
    
    // Determine optimal chapter limit based on document size
    const chapterLimit = structureAnalysis.recommendedChapterLimit || 
      (pageCount > 300 ? 20 : pageCount > 100 ? 15 : 10);
    
    // Combine all page content
    const allContent = docs.map(doc => doc.pageContent).join("\n\n");
    
    // Ask GPT to identify chapter structure with the insights from structure analysis
    const chapterIdentificationPrompt = `
      Analyze this document and identify its chapter structure.
      
      Document info:
      - Total pages: ${pageCount}
      - Chapter pattern: ${structureAnalysis.chapterPattern}
      - Include front matter (preface, acknowledgments, etc.): ${structureAnalysis.shouldIncludeFrontMatter}
      
      Return a JSON array of chapters with the following format:
      {
        "chapters": [
          {
            "title": "Chapter/Section Title",
            "startMarker": "Text that indicates the start of this chapter",
            "importance": "high/medium/low" (estimate how important this chapter is to the overall document)
          }
        ]
      }
      
      IMPORTANT GUIDELINES:
      1. Identify AT MOST ${chapterLimit} chapters - focus on the most important ones
      2. For textbooks or technical documents, prioritize main content chapters over appendices
      3. For very large documents, focus on major sections rather than every sub-chapter
      4. Include a "Conclusion" or final chapter if present
      5. If front matter should be included, add entries for important front matter like "Preface" or "Introduction"
      
      Document content:
      ${allContent.slice(0, 20000)}... [content truncated for length]
    `;
    
    const chapterResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert at analyzing document structure and identifying the most important chapters or logical sections." },
        { role: "user", content: chapterIdentificationPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
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
      
      // Sort chapters by importance if available
      if (chapters[0].importance) {
        const importanceScore = { high: 3, medium: 2, low: 1 };
        chapters.sort((a, b) => 
          (importanceScore[b.importance] || 0) - (importanceScore[a.importance] || 0)
        );
        
        // Limit to chapter limit, but ensure we keep at least some high importance chapters
        if (chapters.length > chapterLimit) {
          const highImportanceChapters = chapters.filter(c => c.importance === "high");
          const otherChapters = chapters.filter(c => c.importance !== "high");
          
          // Keep all high importance chapters and fill the rest with others
          const remainingSlots = Math.max(0, chapterLimit - highImportanceChapters.length);
          chapters = [
            ...highImportanceChapters,
            ...otherChapters.slice(0, remainingSlots)
          ];
        }
      }
      
      // Limit to chapter limit
      chapters = chapters.slice(0, chapterLimit);
      
      console.log(`Identified ${chapters.length} chapters for document ${documentId}`);
    } catch (parseError) {
      console.error("Error parsing chapter structure:", parseError);
      // Fallback to a simple structure
      chapters = [
        { title: "Introduction", startMarker: "", importance: "high" },
        { title: "Main Content", startMarker: "", importance: "high" },
        { title: "Conclusion", startMarker: "", importance: "high" }
      ];
    }
    
    // For very large documents, we'll use a different approach to split content
    // Instead of trying to find exact chapter boundaries, we'll use the identified
    // chapters as a guide and extract content around those areas
    
    const chapterContents = [];
    
    if (pageCount > 200) {
      console.log("Large document detected, using targeted content extraction");
      
      // For each identified chapter, search for its start marker
      for (const chapter of chapters) {
        // Skip chapters without start markers
        if (!chapter.startMarker || chapter.startMarker.trim() === "") {
          continue;
        }
        
        // Find the start marker in the content
        const startIndex = allContent.indexOf(chapter.startMarker);
        if (startIndex >= 0) {
          // Extract a reasonable amount of content (about 10,000 characters)
          // This should be enough for the AI to understand the chapter
          const chapterContent = allContent.substring(
            startIndex, 
            Math.min(startIndex + 10000, allContent.length)
          );
          
          chapterContents.push({
            title: chapter.title,
            content: chapterContent
          });
        }
      }
      
      // If we couldn't extract content for some chapters, use a fallback approach
      if (chapterContents.length < chapters.length / 2) {
        console.log("Falling back to evenly distributed content extraction");
        
        // Divide document evenly based on chapter count
        const chunkSize = Math.floor(allContent.length / chapters.length);
        
        chapters.forEach((chapter, index) => {
          const startPos = index * chunkSize;
          const endPos = (index + 1) * chunkSize;
          const chapterContent = allContent.substring(startPos, endPos);
          
          chapterContents.push({
            title: chapter.title,
            content: chapterContent
          });
        });
      }
    } else {
      // For smaller documents, use the original approach with improvements
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
          
          if (currentChapter.startMarker && currentChapter.startMarker.trim() !== "") {
            const startIndex = allContent.indexOf(currentChapter.startMarker);
            if (startIndex >= 0) {
              if (nextChapter && nextChapter.startMarker && nextChapter.startMarker.trim() !== "") {
                const endIndex = allContent.indexOf(nextChapter.startMarker);
                if (endIndex > startIndex) {
                  chapterContent = allContent.substring(startIndex, endIndex);
                } else {
                  chapterContent = allContent.substring(startIndex);
                }
              } else {
                // If no next chapter or next chapter has no start marker,
                // take a reasonable chunk of content (50,000 characters max)
                chapterContent = allContent.substring(
                  startIndex, 
                  Math.min(startIndex + 50000, allContent.length)
                );
              }
            } else {
              // Start marker not found, divide document evenly
              const chunkSize = Math.floor(allContent.length / chapters.length);
              const startPos = i * chunkSize;
              const endPos = nextChapter ? (i + 1) * chunkSize : undefined;
              chapterContent = allContent.substring(startPos, endPos);
            }
          } else {
            // No start marker, divide document evenly
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
    }
    
    console.log(`Extracted content for ${chapterContents.length} chapters`);
    
    // Generate summaries for each chapter
    const chapterSummaries = [];
    
    // Process chapters in batches to avoid rate limiting
    const BATCH_SIZE = 3;
    for (let i = 0; i < chapterContents.length; i += BATCH_SIZE) {
      const batch = chapterContents.slice(i, i + BATCH_SIZE);
      
      // Process batch in parallel
      const batchResults = await Promise.all(batch.map(async (chapter, batchIndex) => {
        const chapterIndex = i + batchIndex;
        
        // Skip empty chapters
        if (!chapter.content.trim()) {
          console.log(`Skipping empty chapter "${chapter.title}"`);
          return null;
        }
        
        try {
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
          
          console.log(`Generated summary for chapter "${chapter.title}" of document ${documentId}`);
          
          return {
            title: chapter.title,
            content: chapterSummary,
            order: chapterIndex + 2 // Start after overview and key points
          };
        } catch (error) {
          console.error(`Error generating summary for chapter "${chapter.title}":`, error);
          return {
            title: chapter.title,
            content: "Failed to generate summary for this chapter due to an error.",
            order: chapterIndex + 2
          };
        }
      }));
      
      // Add successful summaries to the result
      chapterSummaries.push(...batchResults.filter(Boolean));
      
      // Add a small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < chapterContents.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
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

export async function regenerateSummaries(documentId: number, options?: {
  focusChapters?: string[];
  focusTopics?: string[];
  customInstructions?: string;
}) {
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
    
    // Generate document overview with user preferences if provided
    await generateDocumentOverview(documentId, allContent, options);
    
    // Identify chapters and generate chapter summaries with user preferences
    await identifyAndSummarizeChapters(documentId, docs, options);
    
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