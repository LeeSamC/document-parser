import { uniqueIndex } from 'drizzle-orm/gel-core';
import { jsonb } from 'drizzle-orm/pg-core'
import {pgTable, pgEnum, uuid, varchar, timestamp, text, integer, date, doublePrecision, numeric, index} from 'drizzle-orm/pg-core'

export const DOC_TYPES = [
    "terms_of_reference",
    "meal_framework",
    "micro_plan",
    "quarterly_report",
    "annual_report",
    "steering_committee_report",
    "budget",
    "risk_register",
    "meeting_minutes",
    "lessons_learned",
    "other",
] as const

export const DOC_STATUSES = ["pending", "processing", "parsed", "failed"] as const;
export const ACTIVITY_STATUSES = ['not_started', 'in_progress', 'completed', 'delayed', 'at_risk', 'cancelled'] as const
export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
export const RISK_STATUS = ['open', 'mitigating', 'closed'] as const

export type DocType = (typeof DOC_TYPES)[number]
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number]
export type Severity = (typeof SEVERITIES)[number]
export type RiskStatus = (typeof RISK_STATUS)[number]

export const docStatusEnum = pgEnum("doc_status", DOC_STATUSES);
export const activityStatusEnum = pgEnum('activity_status', ACTIVITY_STATUSES)
export const severityEnum = pgEnum('severity', SEVERITIES)
export const riskStatusEnum = pgEnum('risk_status', RISK_STATUS)
export const docTypeEnum = pgEnum('doc_type', DOC_TYPES)


const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const documents = pgTable('documents', {
    documentId: uuid("document_id").primaryKey().defaultRandom(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    storagePath: text("storage_path").notNull(),
    docType: docTypeEnum("doc_type").notNull().default("other"),
    beneficiaryEntity: text("beneficiary_entity"), 
    reportingPeriod: text("reporting_period"), 
    status: docStatusEnum("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    rawText: text("raw_text"),
    pageCount: integer("page_count"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
},
(t) => [
    uniqueIndex("documnets_sha256_uq").on(t.sha256 as any),
    index("documents_type_idx").on(t.docType),
    index("documents_entity_idx").on(t.beneficiaryEntity),
    ],
)

export const documentChunks = pgTable('document_chunks', {
    chunkId: uuid('chunk_id').defaultRandom().primaryKey(),
    documentId: uuid('document_id').notNull().references(() => documents.documentId, {onDelete: 'cascade'}),
    position: integer('position').notNull(),
    content: text('content').notNull()
})

export const activities = pgTable('activities', {
    activityId: uuid('activity_id').defaultRandom().primaryKey(),
    documentId: uuid('document_id').notNull().references(() => documents.documentId, {onDelete: 'cascade'}),
    title: text('title').notNull(),
    description: text('description'),
    owner: text('owner'),
    status: activityStatusEnum('status').notNull().default('not_started'),
    startDate: date('start_date', {mode: 'string'}),
    endDate: date('end_date', {mode: 'string'}),
    sourceRef: text('source_ref')
})

export const indicators = pgTable('indicators', {
    indicatorsId: uuid('indicators_id').defaultRandom().primaryKey(),
    documentId: uuid('document_id').notNull().references(() => documents.documentId, {onDelete: 'cascade'}),
    name: text('name').notNull(),
    unit: text('unit'),
    baseline: doublePrecision('baseline'),
    target: doublePrecision('target'),
    period: text('period'),
    sourceRef: text('source_ref'),
})

export const budgetLines = pgTable('budget_lines', {
    budgetIds: uuid('budget_id').defaultRandom().primaryKey(),
    documentId: uuid('document_id').notNull().references(() => documents.documentId, {onDelete: 'cascade'}),
    activityTitle: text('activity_title'),
    budgeted: numeric('budgeted', {precision: 16, scale: 2, mode: 'number'}),
    actual: numeric('actual', {precision: 16, scale: 2, mode: 'number'}),
    currency: text('currency'),
    sourceRef: text('source_ref')
})

export const risks = pgTable('risks', {
    riskId: uuid('risk_id').defaultRandom().primaryKey(),
    documentId: uuid('document_id').notNull().references(() => documents.documentId, {onDelete: 'cascade'}),
    description: text('description').notNull(),
    severity: severityEnum('severity').notNull().default('medium'),
    likelyhood: text('likelyhood'),
    status: riskStatusEnum('status').notNull().default('open'),
    mitigation: text('mitigation'),
    owner: text('owner'),
    sourceRef: text('source_ref')

})

export type Document = typeof documents.$inferSelect