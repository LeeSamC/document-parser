import fs from 'node:fs/promises'
import { Router } from 'express'
import multer from 'multer'
import {and, desc, eq, ilike, sql} from 'drizzle-orm'
import {z} from 'zod'
import {db} from '../db'
import {activities, budgetLines, documentChunks, documents, DOC_STATUSES, DOC_TYPES, indicators, risks, summaries} from '../db/schema'
import {env} from '../env'
import { asyncHandler, HttpError, validate } from '../middleware/errors'
import { isSupported } from '../parsers'
import { ingestUpload, processDocument } from '../services/ingest'

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1},
    fileFilter: (_req, file, cb) => {
        const name =  Buffer.from(file.originalname, 'latin1').toString("utf8")
        isSupported(name) ? cb(null, true) : cb(new HttpError(415, "Unsupported file type. Use PDF, DOCX, XLSX, CSV, TXT or MD"))
    }
})

const optStr = z.string().trim().max(100).optional().transform((v) => v || undefined)
const uploadBody = z.object({
    docType: z.enum(DOC_TYPES).optional().or(z.literal("").transform(() =>  undefined)),
    beneficiaryEntity: optStr,
    reportingPeriod: optStr
})

const listQuery = z.object({
    type: z.enum(DOC_TYPES).optional(),
    status: z.enum(DOC_STATUSES).optional(),
    entity: z.string().max(100).optional(),
    q: z.string().max(200).optional()
})

const idParams = z.object({id: z.uuid()})

const listColumns = {
    id: documents.documentId, filename: documents.filename, mimeType: documents.mimeType, sizeBytes: documents.sizeBytes,
    docType: documents.docType, beneficiaryEntity: documents.beneficiaryEntity, reportingPeriod: documents.reportingPeriod,
    status: documents.status, errorMessage: documents.errorMessage, pageCount: documents.pageCount,
    metadata: documents.metadata, createdAt: documents.createdAt, updatedAt: documents.updatedAt,
}

export const router = Router()

router.post('/', upload.single("file"), validate(uploadBody, "body"), asyncHandler(async (req, res) => {
    if(!req.file) {
        throw new HttpError(400, 'No file uploaded (multipart field name must be "file")')
    }
    const {document, duplicate} = await ingestUpload(req.file, res.locals.body)
    const {rawText, storagePath, ...safe} = document
    res.status(duplicate ? 200 : 201).json({...safe, duplicate})
}))

router.get('/', validate(listQuery, 'query'), asyncHandler(async (_req, res) => {
    const f = res.locals.query as z.infer<typeof listQuery>
    const where = and(
        f.type ? eq(documents.docType, f.type) : undefined,
        f.status ? eq(documents.status, f.status) : undefined,
        f.entity ? eq(documents.beneficiaryEntity, f.entity) : undefined,
        f.q ? ilike(documents.filename, `%${f.q.replace(/[%_]/g, "\\$&")}%`) : undefined
    )
    res.json(await db.select(listColumns).from(documents).where(where).orderBy(desc(documents.createdAt)).limit(200))
}))

router.get('/:id', validate(idParams, 'params'), asyncHandler(async (_req, res) => {
    const {id} = res.locals.params as {id: string}
    const [doc] = await db.select().from(documents).where(eq(documents.documentId, id)).limit(1)
    if(!doc){
        throw new HttpError(404, "Document Not Found")
    }
    const [latestSummary] = await db.select().from(summaries).where(eq(summaries.documentId, id)).orderBy(desc(summaries.createdAt))
    const {storagePath, rawText, ...rest} = doc
    res.json({...rest, textPreview: rawText?.slice(0, 5000) ?? null, textLength: rawText?.length ?? 0, summary: latestSummary ?? null})
}))

router.get('/:id/data', validate(idParams, 'params'), asyncHandler(async (_req, res) => {
    const {id} = res.locals.params as {id: string}
    const [a, i, b, r] = await Promise.all([
        db.select().from(activities).where(eq(activities.documentId, id)),
        db.select().from(indicators).where(eq(indicators.documentId, id)),
        db.select().from(budgetLines).where(eq(budgetLines.documentId, id)),
        db.select().from(risks).where(eq(risks.documentId, id)),
    ])
    res.json({activities: a, indicators: i, budgetLines: b, risks: r})
}))

router.get('/:id/download', validate(idParams, 'params'), asyncHandler(async (_req, res) => {
    const {id} = res.locals.params as {id: string}
    const [doc] = await db.select().from(documents).where(eq(documents.documentId, id)).limit(1);
    if(!doc){
        throw new HttpError(404, 'Document not found')
    }
    res.download(doc.storagePath, doc.filename)
    
}))

router.post('/:id/reprocess', validate(idParams, 'params'), asyncHandler(async (_req, res) => {
    const {id} = res.locals.params as {id: string}
    const [exist] = await db.select({id: documents.documentId}).from(documents).where(eq(documents.documentId, id)).limit(1)
    if(!exist){
        throw new HttpError(404, 'Document not found')
    }
    const {rawText, storagePath, ...safe} = await processDocument(id)
    res.json(safe)
}))

router.delete('/:id', validate(idParams, 'params'), asyncHandler(async (_req, res) => {
    const {id} = res.locals.params as {id: string}
    const [doc] = await db.delete(documents).where(eq(documents.documentId, id)).returning({storagePath: documents.storagePath})
    if(!doc) {
        throw new HttpError(404, 'Document not found')
    }
    await fs.rm(doc.storagePath, {force: true})
    res.status(204).end()
}))

const searchQuery = z.object({q: z.string().trim().min(2).max(200), limit: z.coerce.number().int().min(1).max(50).default(20)})
export const searchRouter = Router()
searchRouter.get('/', validate(searchQuery, 'query'), asyncHandler(async (_req, res) => {
    const {q, limit} = res.locals.query as z.infer<typeof searchQuery>
    const tsq = sql`websearch_to_tsquery('english', ${q})`
    const vec = sql`to_tsvector('english', ${documentChunks.content})`
    const rows = await db.select({
        documentId: documents.documentId,
        filename: documents.filename,
        docType: documents.docType,
        snippet: sql<string>`ts_headline('english', ${documentChunks.content}, ${tsq}, 'MaxWords=40, MinWords=15')`,
        rank: sql<number>`ts_rank(${vec}, ${tsq})`,
    })
    .from(documentChunks)
    .innerJoin(
        documents,
        eq(documentChunks.documentId, documents.documentId)
    )
    .where(sql`${vec} @@ ${tsq}`)
    .orderBy(desc(sql`ts_rank(${vec}, ${tsq})`))
    .limit(limit)
    res.json(rows)
}))

export {router as default}