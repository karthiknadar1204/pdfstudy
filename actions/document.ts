'use server'

import { db } from '@/configs/db';
import { documents, users, pdfPages } from '@/configs/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import fs from 'fs/promises';
import path from 'path';
import { storage } from '@/configs/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { openai, pinecone, getPineconeIndex, grokClient } from '@/configs/ai';
import { truncateToTokenLimit, splitTextIntoTokenChunks, countTokens } from "@/utils/tokenizer";

type DocumentData = {
  userId: string; 
  title: string;
  fileName: string;
  fileUrl: string;
  fileKey: string;
  fileSize: number;
};

// Function to generate embeddings
async function generateEmbeddings(texts: string[]) {
  try {
    // Ensure texts don't exceed token limits
    const processedTexts = texts.map(text => truncateToTokenLimit(text, 4000));
    
    const response = await openai.embeddings.create({
      input: processedTexts,
      model: "text-embedding-3-small",
    });
    
    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error("Error generating embeddings:", error);
    throw error;
  }
}

// Function to store embeddings in Pinecone
async function storeEmbeddingsInPinecone(documentId: number, vectors: Array<{
  id: string;
  values: number[];
  metadata: any;
}>) {
  try {
    const index = getPineconeIndex();
    
    // Upsert in batches of 100 to avoid rate limits
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await index.upsert(batch);
      console.log(`Upserted batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(vectors.length/batchSize)}`);
    }
    
    return true;
  } catch (error) {
    console.error("Error storing embeddings in Pinecone:", error);
    return false;
  }
}

// Process chunks and generate embeddings for a single page
async function processPageChunks(documentId: number, page: {
  pageNumber: number;
  content: string;
  chunks: string[];
  metadata: any;
}) {
  try {
    const pageTokenCount = countTokens(page.content);
    const vectors = [];
    
    // For content-dense pages (more than 3000 tokens), use chunk-level embeddings
    if (pageTokenCount > 3000) {
      console.log(`Page ${page.pageNumber} has ${pageTokenCount} tokens - using chunk-level embeddings`);
      
      // Create token-aware chunks
      const tokenChunks = splitTextIntoTokenChunks(page.content, 3800, 200);
      
      // Generate embeddings for each chunk
      const chunkEmbeddings = await generateEmbeddings(tokenChunks);
      
      // Create vectors for each chunk
      tokenChunks.forEach((chunkText, chunkIndex) => {
        vectors.push({
          id: `doc_${documentId}_page_${page.pageNumber}_chunk_${chunkIndex}`,
          values: chunkEmbeddings[chunkIndex],
          metadata: {
            documentId,
            pageNumber: page.pageNumber,
            content: chunkText,
            chunkIndex,
            isChunk: true,
            totalChunks: tokenChunks.length
          }
        });
      });
      
      return {
        pageNumber: page.pageNumber,
        content: page.content,
        chunks: tokenChunks,
        vectors
      };
    } else {
      // For shorter pages, use page-level embedding
      console.log(`Page ${page.pageNumber} has ${pageTokenCount} tokens - using page-level embedding`);
      
      const [embedding] = await generateEmbeddings([page.content]);
      
      vectors.push({
        id: `doc_${documentId}_page_${page.pageNumber}`,
        values: embedding,
        metadata: {
          documentId,
          pageNumber: page.pageNumber,
          content: truncateToTokenLimit(page.content, 4000),
          isChunk: false
        }
      });
      
      return {
        pageNumber: page.pageNumber,
        content: page.content,
        chunks: page.chunks,
        vectors
      };
    }
  } catch (error) {
    console.error(`Error processing chunks for page ${page.pageNumber}:`, error);
    // Return page without embeddings in case of error
    return {
      pageNumber: page.pageNumber,
      content: page.content,
      chunks: page.chunks,
      vectors: []
    };
  }
}

// Process a batch of pages in parallel
async function processBatch(batch: any[], documentId: number) {
  return Promise.all(batch.map(page => processPageChunks(documentId, page)));
}

export async function saveDocument(documentData: DocumentData) {
  console.log("=== DOCUMENT SAVE PROCESS STARTED ===");
  
  try {
    // Get user ID from the database
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, documentData.userId),
    });
    
    if (!user) {
      return { success: false, message: "User not found" };
    }
    
    // Insert document into database
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
        console.log("Document URL:", documentData.fileUrl);
        
        // Download the PDF
        const response = await fetch(documentData.fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }
        
        const pdfBuffer = Buffer.from(await response.arrayBuffer());
        
        // Create temporary directory and data directory
        const tempDir = path.join(process.cwd(), 'temp');
        const dataDir = path.join(process.cwd(), 'data');
        
        await fs.mkdir(tempDir, { recursive: true });
        await fs.mkdir(dataDir, { recursive: true });
        
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
        
        // Create text splitter for chunking
        const textSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: 1000,
          chunkOverlap: 200,
          separators: ["\n\n", "\n", ". ", " ", ""]
        });
        
        // Extract page-wise content with chunks
        const pagesContent = await Promise.all(docs.map(async (doc, index) => {
          // Create chunks for this page's content
          const chunks = await textSplitter.createDocuments([doc.pageContent]);
          const chunkTexts = chunks.map(chunk => chunk.pageContent);
          
          return {
            pageNumber: index + 1,
            content: doc.pageContent,
            chunks: chunkTexts,
            metadata: doc.metadata
          };
        }));
        console.log("pagesContent",pagesContent);
        
        // Process pages in parallel batches
        const batchSize = 5; // Process 5 pages at a time
        const maxConcurrentBatches = 3; // Process up to 3 batches concurrently
        const allVectors = [];
        
        // Process document in chunks to avoid memory issues
        for (let i = 0; i < pagesContent.length; i += batchSize * maxConcurrentBatches) {
          console.log(`Processing pages ${i+1} to ${Math.min(i + batchSize * maxConcurrentBatches, pagesContent.length)} of ${pagesContent.length}`);
          
          const parallelBatches = [];
          
          // Create up to maxConcurrentBatches to process in parallel
          for (let j = 0; j < maxConcurrentBatches; j++) {
            const startIdx = i + (j * batchSize);
            if (startIdx < pagesContent.length) {
              const batch = pagesContent.slice(startIdx, Math.min(startIdx + batchSize, pagesContent.length));
              parallelBatches.push(processBatch(batch, documentId));
            }
          }
          
          // Process batches in parallel
          const batchResults = await Promise.all(parallelBatches);

          console.log("batchResults",batchResults);
          
          // Collect all vectors for storage
          batchResults.flat().forEach(result => {
            if (result.vectors && result.vectors.length > 0) {
              allVectors.push(...result.vectors);
            }
          });
          
          // Store vectors in Pinecone
          if (allVectors.length > 0) {
            await storeEmbeddingsInPinecone(documentId, allVectors);
            console.log(`Stored ${allVectors.length} vectors in Pinecone`);
            // Clear the vectors array to free memory
            allVectors.length = 0;
          }
          
          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Combine page content (without images)
        const combinedData = {
          documentId,
          pageCount,
          pages: pagesContent.map(page => ({
            pageNumber: page.pageNumber,
            content: page.content,
            chunks: page.chunks,
            metadata: page.metadata,
            image: null // No image references
          }))
        };
        
        // Save combined data to a JSON file
        const jsonFilePath = path.join(dataDir, `${documentId}.json`);
        await fs.writeFile(
          jsonFilePath,
          JSON.stringify(combinedData, null, 2)
        );
        
        console.log(`Saved content to ${jsonFilePath}`);
        
        // Clean up temp file
        await fs.unlink(tempFilePath);
        
        // Update document's updatedAt timestamp
        await db.update(documents)
          .set({ 
            updatedAt: new Date()
          })
          .where(eq(documents.id, documentId));
          
        console.log(`Document ${documentId} processing completed successfully`);
        
      } catch (error) {
        console.error("=== ERROR PROCESSING PDF ===", error);
        
        // Just update the timestamp to indicate something happened
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
      message: "Document saved successfully. Processing started in background.",
      documentId
    };
    
  } catch (error) {
    console.error("=== ERROR SAVING DOCUMENT ===", error);
    return { success: false, message: "Failed to save document" };
  }
}

// Function to save PDF page images to the database
// Kept for compatibility but will not be used in the current flow
// async function savePdfPageImages(documentId: number, imageReferences: Array<{
//   pageNumber: number,
//   firebaseUrl: string,
//   imageKey: string,
//   metadata?: any
// }>) {
//   // Format the images array for storage
//   const imagesData = imageReferences.map(img => ({
//     pageNumber: img.pageNumber,
//     imageUrl: img.firebaseUrl,
//     imageKey: img.imageKey || `documents/${documentId}/page_${img.pageNumber}.png`,
//     metadata: img.metadata || null,
//     uploadedAt: new Date()
//   }));


//   const existingRecord = await db.query.pdfPages.findFirst({
//     where: eq(pdfPages.documentId, documentId)
//   });

//   if (existingRecord) {

//     await db.update(pdfPages)
//       .set({ 
//         images: imagesData,
//         updatedAt: new Date()
//       })
//       .where(eq(pdfPages.documentId, documentId));
//   } else {

//     await db.insert(pdfPages)
//       .values({
//         documentId,
//         images: imagesData,
//         uploadedAt: new Date(),
//         updatedAt: new Date()
//       });
//   }
  
//   return imagesData;
// }