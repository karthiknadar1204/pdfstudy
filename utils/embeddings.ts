'use server'

import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { truncateToTokenLimit, splitTextIntoTokenChunks } from "./tokenizer";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

// Get Pinecone index
const getPineconeIndex = () => {
  return pinecone.index('pdftest');
};

/**
 * Generate embeddings for multiple text strings
 * @param texts Array of text strings to embed
 * @returns Array of embedding vectors
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
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

/**
 * Generate embedding for a single text string
 * @param text Text to embed
 * @returns Embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Ensure text doesn't exceed token limits
    const processedText = truncateToTokenLimit(text, 4000);
    
    const response = await openai.embeddings.create({
      input: processedText,
      model: "text-embedding-3-small",
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

/**
 * Query the vector database for similar content
 */
export async function querySimilarContent(
  queryEmbedding: number[],
  documentId: number,
  topK: number = 5
) {
  try {
    const index = getPineconeIndex();
    
    // Query the index with the embedding and filter by documentId
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK,
      filter: { documentId },
      includeMetadata: true,
    });
    
    return queryResponse.matches;
  } catch (error) {
    console.error("Error querying vector database:", error);
    throw error;
  }
}

/**
 * Process a user query against a specific document
 */
export async function processQuery(query: string, documentId: number) {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    // Query the vector database
    const matches = await querySimilarContent(queryEmbedding, documentId);
    
    // Extract and format the results
    const results = matches.map(match => ({
      pageNumber: match.metadata?.pageNumber,
      content: match.metadata?.content,
      score: match.score,
      chunkIndex: match.metadata?.chunkIndex,
    }));
    
    return results;
  } catch (error) {
    console.error("Error processing query:", error);
    throw error;
  }
}

/**
 * Generate a response to a user query using the document content and AI
 */
export async function generateResponseFromDocument(query: string, documentId: number) {
  try {
    // Process the query to get relevant document sections
    const results = await processQuery(query, documentId);
    
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

    // Generate a response using the OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      temperature: 0.5,
      max_tokens: 1000,
    });
    
    // Extract the AI's response
    const aiMessage = response.choices[0].message.content || "I couldn't generate a response based on the document content.";
    
    // Return the response with source information and referenced pages
    return {
      message: aiMessage,
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