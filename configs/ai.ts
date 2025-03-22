import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

// Grok client for chat completions and summaries
export const grokClient = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

// OpenAI client for embeddings
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

export const getPineconeIndex = () => {
  return pinecone.index('pdftest');
}; 