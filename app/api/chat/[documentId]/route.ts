import { NextRequest, NextResponse } from "next/server";
import { db } from "@/configs/db";
import { documents, users, documentChats } from "@/configs/schema";
import { eq, and } from "drizzle-orm";
import { getAuth } from "@clerk/nextjs/server";
import { generateResponseFromDocument, processDocumentQuery } from "@/lib/embeddings";
import { grokClient } from "@/configs/ai";
import { truncateToTokenLimit } from "@/utils/tokenizer";

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
    const { message, previousMessages = [] } = body;

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
    
    // Log the results to see if pageUrl is present
    console.log("=== SEARCH RESULTS IN API ROUTE ===");
    console.log(JSON.stringify(results.map(r => ({
      pageNumber: r.pageNumber,
      pageUrl: r.pageUrl,
      hasPageUrl: !!r.pageUrl
    })), null, 2));
    
    // Prepare context from the search results
    const context = results
      .map(result => `[Page ${result.pageNumber}${result.chunkIndex !== undefined ? `, Chunk ${result.chunkIndex}` : ''}]: ${result.content}`)
      .join('\n\n');
    
    // Get unique page numbers for references
    const pageNumbers = [...new Set(results.map(result => result.pageNumber))].sort((a, b) => a - b);
    
    // Format previous messages for the AI context
    const conversationHistory = previousMessages
      .filter(msg => msg.content && (msg.isUserMessage !== undefined))
      .map(msg => ({
        role: msg.isUserMessage ? "user" : "assistant",
        content: msg.content
      }));
    
    // Create a comprehensive system prompt for the AI
    const systemPrompt = `You are an advanced AI assistant specialized in analyzing and explaining PDF documents. 
You have been given specific sections of a document that are relevant to the user's query.

ROLE AND PURPOSE:
- Your primary role is to help users understand and extract insights from their documents
- Provide clear, accurate explanations based ONLY on the document content provided
- Maintain a helpful, informative, and professional tone
- Act as a subject matter expert for the document's domain
- Detect the document type (receipt, invoice, ticket, academic paper, etc.) and adapt your analysis accordingly

DOCUMENT CONTEXT GUIDELINES:
- Answer questions based EXCLUSIVELY on the provided document sections
- If the information in the document sections is insufficient to answer the question completely, acknowledge the limitations clearly
- Never fabricate information or citations that aren't present in the provided sections
- If you're uncertain about something, express your uncertainty rather than guessing
- Consider the document type and adjust your analysis accordingly (academic paper, legal document, technical manual, etc.)
- For travel documents, identify key details like passenger names, dates, destinations, and booking references
- For financial documents, highlight important figures, payment terms, and due dates
- For academic papers, focus on methodology, findings, and conclusions

CONVERSATION MEMORY:
- You have access to the conversation history between you and the user
- Use this history to understand the context of follow-up questions
- When the user refers to "the previous answer" or asks to "explain more about that", refer to your earlier responses
- Maintain consistency with your previous explanations
- If the user asks for clarification about something you mentioned earlier, provide it based on the document content

CITATION REQUIREMENTS:
- You MUST cite specific page numbers when referencing information using one of these formats:
  * "According to page X..."
  * "[Page X]"
  * "On page X, the document states..."
- Include ALL relevant page numbers that contain information used in your answer
- When citing multiple pages, you can use formats like "Pages X-Y mention..." or "As discussed on pages X, Y, and Z..."
- If information spans multiple chunks from the same page, cite the page number once
- When quoting directly, use quotation marks and provide the exact page reference
- For data tables or figures, specify both the page number and the table/figure number if available

RESPONSE FORMATTING:
- Use markdown formatting to enhance readability
- Use headers (##) for main sections of your response
- Use subheaders (###) for subsections when appropriate
- Use bullet points or numbered lists for sequential information
- Use bold or italic text to emphasize key points
- Include direct quotes from the document when particularly relevant, using quotation marks and proper citation
- For complex topics, consider using tables to organize information
- Use code blocks for any technical content, formulas, or structured data
- For travel itineraries, format dates, times, and locations clearly
- For financial information, present monetary values with appropriate currency symbols

HANDLING SPECIFIC QUERY TYPES:
- For summary requests: Provide concise overviews that capture the main points from the relevant sections
- For comparison requests: Clearly organize similarities and differences in a structured format
- For definition requests: Provide the exact definition from the document with proper citation
- For analysis requests: Focus on explaining relationships between concepts as presented in the document
- For procedural questions: Present steps in a clear, sequential format
- For numerical data: Present precise figures as they appear in the document, with proper context
- For date/time information: Format consistently and highlight time zones if relevant
- For contact information: Format clearly with appropriate labels (phone, email, address)
- For travel documents: Organize departure/arrival information, booking references, and passenger details logically

CRITICAL THINKING:
- Identify key themes and patterns across document sections
- Recognize and explain relationships between concepts
- Highlight important implications or conclusions from the document
- When appropriate, note limitations or assumptions in the document's approach
- Present information in a logical, structured manner
- For travel documents, identify any special conditions, baggage allowances, or cancellation policies
- For financial documents, note payment terms, due dates, and any penalties for late payment
- For academic content, distinguish between facts, hypotheses, and conclusions

DOCUMENT EXTRACTION CAPABILITIES:
- Extract and format tabular data from the document when relevant
- Identify and highlight key entities (people, organizations, locations, dates)
- Recognize document-specific terminology and explain it when needed
- For forms or applications, identify required fields and submission instructions
- For contracts or legal documents, highlight important clauses, deadlines, and obligations

Document sections:
${context}`;

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Prepare messages array with system prompt, conversation history, and current query
          const messages = [
            { role: "system", content: systemPrompt },
            ...conversationHistory,
            { role: "user", content: message }
          ];
          
          // Generate a streaming response using the Grok API
          const grokStream = await grokClient.chat.completions.create({
            model: "grok-2-latest",
            messages: messages,
            temperature: 0.5,
            max_tokens: 1000,
            stream: true,
          });
          
          // Send the initial response with metadata
          const initialData = {
            type: 'metadata',
            sources: results.map(result => {
              // Log each source to check pageUrl
              console.log(`Source for page ${result.pageNumber}:`, { 
                pageUrl: result.pageUrl,
                hasPageUrl: !!result.pageUrl 
              });
              
              return {
                pageNumber: result.pageNumber,
                score: result.score,
                preview: result.content?.substring(0, 150) + "...",
                chunkIndex: result.chunkIndex,
                pageUrl: result.pageUrl
              };
            }),
            referencedPages: pageNumbers
          };
          
          console.log("=== INITIAL DATA BEING SENT TO CLIENT ===");
          console.log(JSON.stringify(initialData, null, 2));
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