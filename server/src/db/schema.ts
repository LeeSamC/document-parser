import {pgTable, uuid, varchar, text, integer, timestamp, jsonb, index} from "drizzle-orm/pg-core"
import { table } from "node:console"

export const documents = pgTable("documents", {
    documentId: uuid('document_id').defaultRandom().primaryKey(),
    projectId: uuid('project_id'),
    originalName: varchar("original_name", {length: 255}).notNull(),
    storagePath: text("storage_path").notNull(),
    mimeType: varchar("mime_type", {length: 150}).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    status: varchar("status", {length: 30}).notNull().default("UPLOADED"),
    pageCount: integer("page_count"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow(),
    processedAt: timestamp("processed_at", {withTimezone: true}),
})

export const extractedElements = pgTable('extracted_elements', {
    elementId: uuid('element_id').defaultRandom().primaryKey(),
    documentId: uuid('document_id').notNull().references(() => documents.documentId, {onDelete: 'cascade'}),
    original: integer("original").notNull(),
    elementType: varchar("element_type", {length: 40}).notNull(),
    content: jsonb('content').notNull(),
    contentText: text('content_text').notNull(),
    source: jsonb('source').notNull().default({})
},
(table) => [
    index("extracted_elements_document_idx").on(table.documentId)
],
)