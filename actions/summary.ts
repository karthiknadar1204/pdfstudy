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
import { openai,grokClient } from '@/configs/ai';
// import { grokClient } from '@/configs/grok';

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
        // Creates a high-level overview and key points
        await generateDocumentOverview(documentId, allContent);
        
        // Identify chapters and generate chapter summaries
        // Identifies the document structure and creates chapter summaries
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


// Sets the order of components (overview = 0, key points = 1)
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
      Analyze this document comprehensively and provide a concise overview.
      
      ANALYSIS REQUIREMENTS:
      - Identify the document type (academic paper, technical manual, business report, etc.)
      - Determine the primary audience and purpose
      - Extract the central thesis or main argument
      - Identify the document's structure and organizational approach
      - Note any significant methodologies, frameworks, or models used
      
      OUTPUT GUIDELINES:
      - Create 3-4 well-structured paragraphs
      - First paragraph: Introduce document type, purpose, and central thesis
      - Middle paragraph(s): Summarize key content areas and significant findings
      - Final paragraph: Conclude with implications, recommendations, or overall significance
      - Use precise, domain-appropriate terminology
      - Maintain objective, analytical tone
    `;
    
    // Add user preferences if provided
    if (options?.focusTopics?.length) {
      overviewPrompt += `\nPay special attention to these topics: ${options.focusTopics.join(', ')}.`;
    }
    
    if (options?.customInstructions) {
      overviewPrompt += `\nAdditional instructions: ${options.customInstructions}`;
    }
    
    overviewPrompt += `\n\nDocument content:\n${content.slice(0, 15000)}... [content truncated for length]`;
    
    const overviewResponse = await grokClient.chat.completions.create({
      model: "grok-2-latest",
      messages: [
        { 
          role: "system", 
          content: "You are an expert document analyst with advanced capabilities in content extraction, pattern recognition, and synthesis. You excel at identifying document structure, purpose, audience, and key arguments. Your summaries are precise, comprehensive, and tailored to the document's domain and complexity level. CRITICAL: You MUST format your response as a valid JSON object with this exact structure (no markdown, no backticks): { \"summary\": { \"introduction\": \"paragraph about document type and purpose\", \"mainContent\": \"paragraph(s) about key content areas\", \"conclusion\": \"paragraph about implications or significance\" } }" 
        },
        { role: "user", content: overviewPrompt }
      ],
      temperature: 0.4,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });
    
    let overview = "";
    try {
      const overviewContent = overviewResponse.choices[0].message.content || "";
      
      // First try to parse as JSON
      try {
        // Remove any backticks that might be wrapping the JSON
        const cleanedContent = overviewContent.replace(/^```json\s*|\s*```$/g, '').trim();
        const overviewJson = JSON.parse(cleanedContent);
        
        // Combine the structured parts into a cohesive overview
        if (overviewJson.summary) {
          const parts = [];
          if (overviewJson.summary.introduction) parts.push(overviewJson.summary.introduction);
          if (overviewJson.summary.mainContent) parts.push(overviewJson.summary.mainContent);
          if (overviewJson.summary.conclusion) parts.push(overviewJson.summary.conclusion);
          overview = parts.join("\n\n");
        } else {
          // If JSON doesn't have expected structure, use the raw content
          overview = overviewContent;
        }
      } catch (jsonError) {
        // If JSON parsing fails, use the raw content
        console.log("Using raw content for overview - JSON parsing failed");
        overview = overviewContent;
      }
    } catch (error) {
      console.error("Error processing overview response:", error);
      overview = overviewResponse.choices[0].message.content || "Failed to generate overview.";
    }
    
    // Generate key points with user preferences
    let keyPointsPrompt = `
      Extract the most significant points from this document using deep analytical techniques.
      
      ANALYSIS APPROACH:
      - Identify central claims, findings, or arguments
      - Extract critical data points, statistics, or evidence
      - Recognize methodological innovations or limitations
      - Identify theoretical frameworks or models
      - Note significant implications or applications
      - Detect gaps, limitations, or areas for future work
      
      OUTPUT REQUIREMENTS:
      - Provide 5-10 key points in bullet format (start each with "- ")
      - Arrange points in logical order (most to least important)
      - Each point should be 1-2 sentences, concise but complete
      - Use precise terminology appropriate to the document's domain
      - Include specific details (numbers, dates, names) when relevant
      - Ensure points collectively represent the document's full scope
    `;
    
    // Add user preferences if provided
    if (options?.focusTopics?.length) {
      keyPointsPrompt += `\nEnsure you include key points related to these topics: ${options.focusTopics.join(', ')}.`;
    }
    
    if (options?.customInstructions) {
      keyPointsPrompt += `\nAdditional instructions: ${options.customInstructions}`;
    }
    
    keyPointsPrompt += `\n\nDocument content:\n${content.slice(0, 15000)}... [content truncated for length]`;
    
    const keyPointsResponse = await grokClient.chat.completions.create({
      model: "grok-2-latest",
      messages: [
        { 
          role: "system", 
          content: "You are an expert information extraction specialist with advanced capabilities in identifying critical information, hierarchical relationships, and conceptual frameworks. You excel at distilling complex documents into precise, well-structured key points that capture the essential content while maintaining nuance and technical accuracy. CRITICAL: You MUST format your response as a valid JSON object with this exact structure (no markdown, no backticks): { \"keyPoints\": [ { \"point\": \"First key point\", \"importance\": \"high|medium|low\" }, { \"point\": \"Second key point\", \"importance\": \"high|medium|low\" }, ... ] }" 
        },
        { role: "user", content: keyPointsPrompt }
      ],
      temperature: 0.4,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });
    
    let keyPoints = "";
    try {
      const keyPointsContent = keyPointsResponse.choices[0].message.content || "";
      
      // First try to parse as JSON
      try {
        // Remove any backticks that might be wrapping the JSON
        const cleanedContent = keyPointsContent.replace(/^```json\s*|\s*```$/g, '').trim();
        const keyPointsJson = JSON.parse(cleanedContent);
        
        // Format key points as bullet points
        if (keyPointsJson.keyPoints && Array.isArray(keyPointsJson.keyPoints)) {
          keyPoints = keyPointsJson.keyPoints.map(item => 
            `- ${item.point}${item.importance ? ` (${item.importance})` : ''}`
          ).join("\n");
        } else {
          // If JSON doesn't have expected structure, use the raw content
          keyPoints = keyPointsContent;
        }
      } catch (jsonError) {
        // If JSON parsing fails, use the raw content
        console.log("Using raw content for key points - JSON parsing failed");
        keyPoints = keyPointsContent;
      }
    } catch (error) {
      console.error("Error processing key points response:", error);
      keyPoints = keyPointsResponse.choices[0].message.content || "Failed to generate key points.";
    }
    
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
    
    const summariesContent = existingSummary?.content || {
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
    // Structure Analysis Prompt - Enhanced for deeper document analysis
    const sampleContent = samplePages.map(doc => doc.pageContent).join("\n\n");
    
    const structureAnalysisPrompt = `
      Perform a comprehensive structural analysis of this ${pageCount}-page document.
      
      ANALYSIS OBJECTIVES:
      1. Identify the precise chapter/section demarcation pattern
      2. Determine the document's hierarchical organization (chapters, sections, subsections)
      3. Analyze heading formatting patterns (numbering systems, typography, indentation)
      4. Detect front matter elements (abstract, TOC, preface, acknowledgments)
      5. Identify back matter elements (appendices, references, glossary)
      6. Estimate optimal chapter extraction strategy based on document type and structure
      
      DOCUMENT TYPE CONSIDERATIONS:
      - For academic papers: Identify IMRAD structure (Intro, Methods, Results, Discussion)
      - For textbooks: Detect learning objectives, summaries, and exercise sections
      - For technical manuals: Identify procedural sections, warnings, and specifications
      - For business documents: Detect executive summaries, recommendations, and action items
      
      OUTPUT REQUIREMENTS:
      Return a precise JSON analysis with:
      {
        "documentType": "academic|textbook|manual|report|other",
        "chapterPattern": "Detailed description of chapter marking pattern",
        "headingHierarchy": "Description of heading levels and their formatting",
        "estimatedChapterCount": number,
        "chapterIdentifiers": ["List of text patterns that indicate chapter starts"],
        "shouldIncludeFrontMatter": boolean,
        "recommendedChapterLimit": number,
        "extractionStrategy": "full_chapters|key_sections|hybrid"
      }
      
      Sample content from the document (beginning, middle, and end):
      ${sampleContent.slice(0, 15000)}... [content truncated for length]
    `;
    
    const structureResponse = await grokClient.chat.completions.create({
      model: "grok-2-latest",
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
        documentType: "Unknown",
        chapterPattern: "Unknown",
        headingHierarchy: "Unknown",
        estimatedChapterCount: 10,
        chapterIdentifiers: ["Chapter", "Section"],
        shouldIncludeFrontMatter: false,
        recommendedChapterLimit: 15,
        extractionStrategy: "full_chapters"
      };
    }
    
    // Determine optimal chapter limit based on document size
    // Chapter Identification Prompt - Enhanced for more precise chapter detection
    const chapterLimit = structureAnalysis.recommendedChapterLimit || 
      (pageCount > 300 ? 20 : pageCount > 100 ? 15 : 10);
    
    // Combine all page content
    const allContent = docs.map(doc => doc.pageContent).join("\n\n");
    
    // Ask GPT to identify chapter structure with the insights from structure analysis
    const chapterIdentificationPrompt = `
      Perform a detailed chapter structure analysis of this document.
      
      DOCUMENT METADATA:
      - Total pages: ${pageCount}
      - Document type: ${structureAnalysis.documentType || "Unknown"}
      - Chapter pattern: ${structureAnalysis.chapterPattern}
      - Heading hierarchy: ${structureAnalysis.headingHierarchy || "Standard hierarchy"}
      - Include front matter: ${structureAnalysis.shouldIncludeFrontMatter}
      
      ANALYSIS REQUIREMENTS:
      1. Identify the most significant chapters/sections based on content importance
      2. Determine the relative importance of each chapter to the document's overall purpose
      3. Locate precise chapter boundaries using heading patterns and content transitions
      4. Assess content density and information value of each chapter
      
      CHAPTER SELECTION CRITERIA:
      - Relevance to document's central thesis or purpose
      - Information density and unique content value
      - Structural significance (introductory, methodological, conclusive)
      - For technical documents: Prioritize methodology, findings, and implementation sections
      - For academic papers: Prioritize methods, results, and discussion sections
      - For business documents: Prioritize executive summary, recommendations, and action items
      
      OUTPUT FORMAT:
      Return a JSON array of chapters with:
      {
        "chapters": [
          {
            "title": "Precise chapter/section title",
            "startMarker": "Exact text that indicates the start of this chapter",
            "importance": "high|medium|low",
            "contentType": "introduction|methodology|results|discussion|conclusion|appendix|other",
            "estimatedLength": "short|medium|long"
          }
        ]
      }
      
      CONSTRAINTS:
      - Identify AT MOST ${chapterLimit} chapters - focus on the most important ones
      - Ensure selected chapters collectively represent the document's full scope
      - Include introduction and conclusion chapters if present
      - For front matter, only include truly significant elements
      
      Document content:
      ${allContent.slice(0, 20000)}... [content truncated for length]
    `;
    
    const chapterResponse = await grokClient.chat.completions.create({
      model: "grok-2-latest",
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
        // Chapter Summarization Prompt - Enhanced for deeper chapter analysis
        if (!chapter.content.trim()) {
          console.log(`Skipping empty chapter "${chapter.title}"`);
          return null;
        }
        
        try {
          const chapterSummaryPrompt = `
            Create a comprehensive yet concise summary of this chapter.
            
            CHAPTER METADATA:
            - Title: "${chapter.title}"
            - Importance: ${chapter.importance || "medium"}
            - Content type: ${chapter.contentType || "main content"}
            
            ANALYSIS APPROACH:
            1. Identify the chapter's primary purpose and relationship to the overall document
            2. Extract central arguments, key findings, or critical information
            3. Identify methodologies, frameworks, or models introduced
            4. Note significant data, statistics, or evidence presented
            5. Recognize limitations, constraints, or qualifications mentioned
            6. Identify connections to other chapters or external references
            
            SUMMARY REQUIREMENTS:
            - Create 2-3 well-structured paragraphs (250-350 words total)
            - First paragraph: Introduce chapter purpose and main focus
            - Middle/final paragraphs: Synthesize key content, findings, and significance
            - Maintain the document's technical terminology and conceptual framework
            - Preserve critical numerical data, methodological details, and specific findings
            - Ensure the summary could stand alone while reflecting the chapter's role in the document
            
            Chapter content:
            ${chapter.content}
            
            ${options?.focusTopics?.length ? `Focus on these topics if present: ${options.focusTopics.join(', ')}` : ''}
            ${options?.customInstructions ? `Additional instructions: ${options.customInstructions}` : ''}
          `;
          
          const summaryResponse = await grokClient.chat.completions.create({
            model: "grok-2-latest",
            messages: [
              { 
                role: "system", 
                content: "You are an expert summarizer that creates concise, accurate chapter summaries. You excel at identifying the core concepts, key arguments, and significant findings in each chapter while maintaining the document's technical terminology and conceptual framework. CRITICAL: You MUST format your response as a valid JSON object with this exact structure (no markdown, no backticks): { \"chapterSummary\": { \"overview\": \"paragraph introducing chapter purpose\", \"keyContent\": \"paragraph synthesizing main content\", \"significance\": \"paragraph about chapter's importance to overall document\" } }" 
              },
              { role: "user", content: chapterSummaryPrompt }
            ],
            temperature: 0.5,
            max_tokens: 800,
            response_format: { type: "json_object" }
          });
          
          let chapterSummary = "";
          try {
            const summaryContent = summaryResponse.choices[0].message.content || "";
            
            // First try to parse as JSON
            try {
              // Remove any backticks that might be wrapping the JSON
              const cleanedContent = summaryContent.replace(/^```json\s*|\s*```$/g, '').trim();
              const summaryJson = JSON.parse(cleanedContent);
              
              // Combine the structured parts into a cohesive chapter summary
              if (summaryJson.chapterSummary) {
                const parts = [];
                if (summaryJson.chapterSummary.overview) parts.push(summaryJson.chapterSummary.overview);
                if (summaryJson.chapterSummary.keyContent) parts.push(summaryJson.chapterSummary.keyContent);
                if (summaryJson.chapterSummary.significance) parts.push(summaryJson.chapterSummary.significance);
                chapterSummary = parts.join("\n\n");
              } else {
                // If JSON doesn't have expected structure, use the raw content
                chapterSummary = summaryContent;
              }
            } catch (jsonError) {
              // If JSON parsing fails, use the raw content
              console.log(`Using raw content for chapter "${chapter.title}" - JSON parsing failed`);
              chapterSummary = summaryContent;
            }
          } catch (error) {
            console.error(`Error processing chapter summary for "${chapter.title}":`, error);
            chapterSummary = summaryResponse.choices[0].message.content || "Failed to generate chapter summary.";
          }
          
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