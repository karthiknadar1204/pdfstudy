import { pgTable, serial, text, timestamp, varchar, uuid, json, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  clerkId: varchar('clerk_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull(),
  username: varchar('username', { length: 255 }),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  profileImageUrl: text('profile_image_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// PDF documents table
export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  userId: serial('user_id').references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileUrl: text('file_url').notNull(),
  fileKey: varchar('file_key', { length: 255 }).notNull(),
  fileSize: serial('file_size').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  hasSummary: boolean('has_summary').default(false).notNull(),
  hasChat: boolean('has_chat').default(false).notNull()
});

// Chat sessions table
export const chatSessions = pgTable('chat_sessions', {
  id: serial('id').primaryKey(),
  userId: serial('user_id').references(() => users.id),
  documentId: serial('document_id').references(() => documents.id),
  title: varchar('title', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Chat messages table
export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  sessionId: serial('session_id').references(() => chatSessions.id),
  isUserMessage: boolean('is_user_message').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// PDF summaries table
export const summaries = pgTable('summaries', {
  id: serial('id').primaryKey(),
  documentId: serial('document_id').references(() => documents.id).unique(),
  content: json('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Add a new table for document chats
export const documentChats = pgTable('document_chats', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  conversations: json('conversations').notNull().$type<{
    messages: Array<{
      id: string;
      content: string;
      isUserMessage: boolean;
      timestamp: string;
      sources?: Array<{
        pageNumber: number;
        score: number;
        preview: string;
        chunkIndex: number;
      }>;
      referencedPages?: number[];
    }>;
    lastUpdated: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

