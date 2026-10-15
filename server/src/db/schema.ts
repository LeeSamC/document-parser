import {pgTable, uuid, varchar, text, integer, timestamp, jsonb, index} from "drizzle-orm/pg-core"

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