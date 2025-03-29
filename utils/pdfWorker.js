import { parentPort, workerData } from 'worker_threads';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Pinecone } from '@pinecone-database/pinecone';

// This function will run in a separate thread
async function processChunks() {
  try {
    const { chunks, documentId, fileUrl, pineconeApiKey, pineconeIndex } = workerData;
    
    // Initialize embeddings
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
    
    // Initialize Pinecone client in the worker - using updated SDK
    const pinecone = new Pinecone({
      apiKey: pineconeApiKey,
    });
    
    const index = pinecone.index(pineconeIndex);
    
    // Process each page in the batch
    const results = await Promise.all(
      chunks.map(async (page) => {
        // Create embeddings for each chunk in the page
        const pageChunks = page.chunks || [];
        
        if (pageChunks.length === 0) {
          return { pageNumber: page.pageNumber, vectorCount: 0, success: true };
        }
        
        // Generate embeddings for all chunks in this page
        const embeddingResults = await embeddings.embedDocuments(pageChunks);
        
        // Create vector objects for storage
        const vectors = pageChunks.map((chunk, idx) => ({
          id: `${documentId}-p${page.pageNumber}-c${idx}`,
          values: embeddingResults[idx],
          metadata: {
            text: chunk,
            pageNumber: page.pageNumber,
            documentId: documentId,
            fileUrl: fileUrl
          }
        }));
        
        // Upsert vectors directly from the worker thread
        if (vectors.length > 0) {
          // Upsert in batches of 100 to avoid rate limits
          const batchSize = 100;
          for (let i = 0; i < vectors.length; i += batchSize) {
            const batch = vectors.slice(i, i + batchSize);
            
            try {
              // Use the correct format for the Pinecone SDK
              // The records property is expected to be an array of vectors
              await index.upsert({
                records: batch
              });
              
              console.log(`Worker: Upserted batch of ${batch.length} vectors for page ${page.pageNumber}`);
            } catch (error) {
              console.error(`Upsert error details:`, error);
              console.error(`Failed batch sample:`, JSON.stringify(batch[0]));
              throw error;
            }
          }
        }
        
        return {
          pageNumber: page.pageNumber,
          vectorCount: vectors.length,
          success: true
        };
      })
    );
    
    // Send the results back to the main thread
    parentPort.postMessage({
      success: true,
      results: results
    });
  } catch (error) {
    console.error("Worker error:", error);
    parentPort.postMessage({ 
      success: false,
      error: error.message 
    });
  }
}

// Start processing
processChunks(); 