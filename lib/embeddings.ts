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
    
    // Query the index with the embedding
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK,
      filter: { documentId },
      includeMetadata: true,
    });
    
    // Log the raw response from Pinecone
    console.log("=== RAW PINECONE RESPONSE ===");
    console.log(JSON.stringify(queryResponse.matches.map(m => m.metadata), null, 2));
    
    // Format and return the results
    const results = queryResponse.matches.map(match => ({
      id: match.id,
      score: match.score,
      pageNumber: match.metadata.pageNumber,
      content: match.metadata.content,
      chunkIndex: match.metadata.isChunk ? match.metadata.chunkIndex : undefined,
      isChunk: match.metadata.isChunk,
      pageUrl: match.metadata.pageUrl // Include the page URL
    }));
    
    // Log the formatted results
    console.log("=== FORMATTED SEARCH RESULTS ===");
    console.log(JSON.stringify(results, null, 2));
    
    return results;
  } catch (error) {
    console.error("Error searching vector database:", error);
    return [];
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
    // Check if this is a direct page navigation request
    const pageNavigationMatch = query.match(/(?:go to|take me to|show|navigate to)?\s*page\s*(\d+)/i);
    
    if (pageNavigationMatch) {
      const requestedPage = parseInt(pageNavigationMatch[1]);
      
      // First get the document's base URL by making a search query
      const { results } = await processDocumentQuery("", documentId);
      
      if (results && results.length > 0) {
        // Extract the base URL from any of the results
        const baseUrl = results[0].pageUrl?.split('#')[0];
        
        if (baseUrl) {
          const pageUrl = `${baseUrl}#page=${requestedPage}`;
          
          return {
            message: `I'll help you navigate to [Page ${requestedPage}](${pageUrl}). Click the page number to view it.`,
            sources: [{
              pageNumber: requestedPage,
              score: 1,
              preview: `Navigating to page ${requestedPage}`,
              pageUrl: pageUrl
            }],
            referencedPages: [requestedPage],
            isPageNavigation: true,
            targetPage: requestedPage
          };
        }
      }
      
      // Fallback if we couldn't get the URL
      return {
        message: `I'll help you navigate to page ${requestedPage}.`,
        sources: [],
        referencedPages: [requestedPage],
        isPageNavigation: true,
        targetPage: requestedPage
      };
    }
    
    // Regular document query processing continues...
    const { results } = await processDocumentQuery(query, documentId);
    
    if (!results || results.length === 0) {
      return {
        message: "I couldn't find relevant information in this document to answer your question. Could you please rephrase or ask something else about the document?",
        sources: [],
        referencedPages: []
      };
    }
    
    // Create a map of page numbers to their URLs
    const pageUrlMap = results.reduce((map, result) => {
      if (result.pageUrl) {
        map[result.pageNumber] = result.pageUrl;
      }
      return map;
    }, {} as Record<number, string>);

    // Prepare context from the search results with page URLs
    const context = results
      .map(result => {
        const pageUrl = result.pageUrl ? `[Page ${result.pageNumber}](${result.pageUrl})` : `Page ${result.pageNumber}`;
        return `[${pageUrl}${result.chunkIndex !== undefined ? `, Chunk ${result.chunkIndex}` : ''}]: ${result.content}`;
      })
      .join('\n\n');
    
    // Get unique page numbers for references
    const pageNumbers = [...new Set(results.map(result => result.pageNumber))].sort((a, b) => a - b);
    
    // Modify the system prompt to instruct the AI to use markdown links for page references
    const systemPrompt = `You are an AI assistant that helps users understand PDF documents. 
You have access to specific sections of a document that are relevant to the user's query.
Answer the user's question based ONLY on the provided document sections.

IMPORTANT FORMATTING INSTRUCTIONS:
1. When referring to page numbers in your response, ALWAYS use the format "[Page X](pageUrl)" using the exact URLs provided below.
2. Example format: "As discussed in [Page 5](url-to-page-5), the topic..."
3. Make sure to use the exact page URLs provided - do not modify or create new URLs.
4. Every page number mention in your response should be a clickable link.

If the information in the document sections is not sufficient to answer the question, 
acknowledge that and don't make up information.

Available page URLs:
${Object.entries(pageUrlMap).map(([page, url]) => `Page ${page}: ${url}`).join('\n')}

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