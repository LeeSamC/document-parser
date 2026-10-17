import {pgTable, uuid, varchar, timestamp, text} from 'drizzle-orm/pg-core'

export const documents = pgTable('documents', {
    documentId: uuid('documentId').defaultRandom().primaryKey(),
    fileName: varchar('filename').notNull(),
    mimeType: text('mime_type').notNull()
})