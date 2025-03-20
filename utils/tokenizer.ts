// Note: No 'use server' directive here since these are pure utility functions
import { encode, decode } from 'gpt-tokenizer';

/**
 * Truncates text to a specified token limit
 * @param text The text to truncate
 * @param maxTokens Maximum number of tokens (default: 4000)
 * @returns Truncated text
 */
export function truncateToTokenLimit(text: string, maxTokens: number = 4000): string {
  const tokens = encode(text);
  
  if (tokens.length <= maxTokens) {
    return text;
  }
  
  // Truncate to max tokens
  const truncatedTokens = tokens.slice(0, maxTokens);
  return decode(truncatedTokens);
}

/**
 * Counts the number of tokens in a text
 * @param text The text to count tokens for
 * @returns Number of tokens
 */
export function countTokens(text: string): number {
  return encode(text).length;
}

/**
 * Splits text into chunks that respect token limits
 * @param text The text to split
 * @param maxTokens Maximum tokens per chunk (default: 4000)
 * @param overlap Overlap between chunks in tokens (default: 200)
 * @returns Array of text chunks
 */
export function splitTextIntoTokenChunks(
  text: string, 
  maxTokens: number = 4000,
  overlap: number = 200
): string[] {
  const tokens = encode(text);
  const chunks: string[] = [];
  
  if (tokens.length <= maxTokens) {
    return [text];
  }
  
  let i = 0;
  while (i < tokens.length) {
    const chunkTokens = tokens.slice(i, i + maxTokens);
    chunks.push(decode(chunkTokens));
    i += (maxTokens - overlap);
    
    // Avoid creating very small final chunks
    if (i + maxTokens > tokens.length && tokens.length - i < maxTokens / 3) {
      break;
    }
  }
  
  // Add the final chunk if needed
  if (i < tokens.length) {
    chunks.push(decode(tokens.slice(i)));
  }
  
  return chunks;
} 