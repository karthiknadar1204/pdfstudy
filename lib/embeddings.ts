'use server'

import { openai, pinecone, getPineconeIndex, grokClient } from '@/configs/ai';

/**
 * Generate embeddings for a query string
 * @param query The user's query text
 * @returns An array of embedding values
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  try {
    // Truncate query if it's too long (approximation for 4000 tokens)
    const processedQuery = query.slice(0, 8000);
    
    const response = await openai.embeddings.create({
      input: processedQuery,
      model: "text-embedding-3-small",
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating query embedding:", error);
    throw new Error("Failed to generate embedding for query");
  }
}

/**
 * Search for relevant content in the vector database
 * @param queryEmbedding The embedding vector for the query
 * @param documentId The ID of the document to search within
 * @param topK Number of results to return
 * @returns Array of matching results with their content and metadata
 */
export async function searchVectorDatabase(
  queryEmbedding: number[],
  documentId: number,
  topK: number = 5
) {
  try {
    const index = getPineconeIndex();
    
    // Query the vector database with document filter
    const results = await index.query({
      vector: queryEmbedding,
      topK,
      filter: { documentId },
      includeMetadata: true,
    });
    
    return results.matches.map(match => ({
      score: match.score,
      pageNumber: match.metadata?.pageNumber,
      content: match.metadata?.content,
      documentId: match.metadata?.documentId,
      chunkIndex: match.metadata?.chunkIndex,
      totalChunks: match.metadata?.totalChunks,
    }));
  } catch (error) {
    console.error("Error searching vector database:", error);
    throw new Error("Failed to search document content");
  }
}

/**
 * Process a user query to find relevant document sections
 * @param query The user's question
 * @param documentId The document ID to search within
 * @returns Relevant document sections
 */
export async function processDocumentQuery(query: string, documentId: number) {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateQueryEmbedding(query);
    
    // Search for relevant content in the vector database
    const results = await searchVectorDatabase(queryEmbedding, documentId, 5);
    
    return { results };
  } catch (error) {
    console.error("Error processing document query:", error);
    return { results: [] };
  }
}

/**
 * Generate a response to a user query using the document content and AI
 * @param query The user's question
 * @param documentId The document ID to search within
 * @returns AI-generated response based on document content
 */
export async function generateResponseFromDocument(query: string, documentId: number) {
  try {
    // Process the query to get relevant document sections
    const { results } = await processDocumentQuery(query, documentId);
    
    if (!results || results.length === 0) {
      return {
        message: "I couldn't find relevant information in this document to answer your question. Could you please rephrase or ask something else about the document?",
        sources: [],
        referencedPages: []
      };
    }
    
    // Prepare context from the search results
    const context = results
      .map(result => `[Page ${result.pageNumber}${result.chunkIndex !== undefined ? `, Chunk ${result.chunkIndex}` : ''}]: ${result.content}`)
      .join('\n\n');
    
    // Get unique page numbers for references
    const pageNumbers = [...new Set(results.map(result => result.pageNumber))].sort((a, b) => a - b);
    
    // Create a system prompt for the AI
    const systemPrompt = `You are an AI assistant that helps users understand PDF documents. 
You have access to specific sections of a document that are relevant to the user's query.
Answer the user's question based ONLY on the provided document sections.
If the information in the document sections is not sufficient to answer the question, 
acknowledge that and don't make up information.

IMPORTANT: When referring to information, you MUST cite the specific page numbers using the format "According to page X..." or "[Page X]".
Be sure to mention ALL relevant page numbers that contain information used in your answer.
Format your response using markdown for better readability.

Document sections:
${context}`;

    // Generate a streaming response using the Grok API
    const stream = await grokClient.chat.completions.create({
      model: "grok-2-latest",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      temperature: 0.5,
      max_tokens: 1000,
      stream: true,
    });
    
    // Collect the streamed response
    let aiMessage = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      aiMessage += content;
    }
    
    // Return the response with source information and referenced pages
    return {
      message: aiMessage || "I couldn't generate a response based on the document content.",
      sources: results.map(result => ({
        pageNumber: result.pageNumber,
        score: result.score,
        preview: result.content?.substring(0, 150) + "...",
        chunkIndex: result.chunkIndex
      })),
      referencedPages: pageNumbers
    };
  } catch (error) {
    console.error("Error generating response:", error);
    return {
      message: "I encountered an error while trying to answer your question. Please try again later.",
      sources: [],
      referencedPages: []
    };
  }
} 