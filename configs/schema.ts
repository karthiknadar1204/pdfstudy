import { pgTable, serial, text, timestamp, varchar, json, boolean, integer } from 'drizzle-orm/pg-core';

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

// PDF summaries table
export const summaries = pgTable('summaries', {
  id: serial('id').primaryKey(),
  documentId: serial('document_id').references(() => documents.id).unique(),
  content: json('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Document chats table (this is the one we actually use)
export const documentChats = pgTable('document_chats', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  conversations: json('conversations').notNull().$type<{
    messages: Array<{
      id: string;
      content: string;
      isUserMessage: boolean;
      isStreaming?: boolean;
      isError?: boolean;
      timestamp: string;
      sources?: Array<{
        pageNumber: number;
        score: number;
        preview: string;
        chunkIndex?: number;
        pageUrl?: string;
      }>;
      referencedPages?: number[];
    }>;
    lastUpdated: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Folders table
export const folders = pgTable('folders', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).notNull().unique(),
  userId: serial('user_id').references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Document folders table
export const documentFolders = pgTable('document_folders', {
  id: serial('id').primaryKey(),
  documentId: serial('document_id').references(() => documents.id),
  folderId: serial('folder_id').references(() => folders.id),
  createdAt: timestamp('created_at').defaultNow(),
});

