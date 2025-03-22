import { NextRequest, NextResponse } from "next/server";
import { db } from "@/configs/db";
import { documents, users } from "@/configs/schema";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/nextjs/server";
import { generateResponseFromDocument, processDocumentQuery } from "@/lib/embeddings";
import { grokClient } from "@/configs/ai";

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

    // Get document ID from params
    const { documentId: documentIdStr } = params;
    const documentId = parseInt(documentIdStr);
    
    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: "Invalid document ID" },
        { status: 400 }
      );
    }

    // Get the user's ID from the database
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get the document
    const document = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Check if the document belongs to the user
    if (document.userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Parse the request body
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Process the query to get relevant document sections
    const { results } = await processDocumentQuery(message, documentId);
    
    if (!results || results.length === 0) {
      return NextResponse.json({
        message: "I couldn't find relevant information in this document to answer your question. Could you please rephrase or ask something else about the document?",
        sources: [],
        referencedPages: []
      });
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

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Generate a streaming response using the Grok API
          const grokStream = await grokClient.chat.completions.create({
            model: "grok-2-latest",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message }
            ],
            temperature: 0.5,
            max_tokens: 1000,
            stream: true,
          });
          
          // Send the initial response with metadata
          const initialData = {
            type: 'metadata',
            sources: results.map(result => ({
              pageNumber: result.pageNumber,
              score: result.score,
              preview: result.content?.substring(0, 150) + "...",
              chunkIndex: result.chunkIndex
            })),
            referencedPages: pageNumbers
          };
          controller.enqueue(encoder.encode(JSON.stringify(initialData) + '\n'));
          
          // Stream the content chunks
          for await (const chunk of grokStream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              const data = {
                type: 'content',
                content: content
              };
              controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
            }
          }
          
          // Signal completion
          const finalData = {
            type: 'done'
          };
          controller.enqueue(encoder.encode(JSON.stringify(finalData) + '\n'));
          controller.close();
        } catch (error) {
          console.error("Error in streaming:", error);
          const errorData = {
            type: 'error',
            error: 'An error occurred while generating the response'
          };
          controller.enqueue(encoder.encode(JSON.stringify(errorData) + '\n'));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error("Error processing chat:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 