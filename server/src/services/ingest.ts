import fs from 'node:fs/promises'
import path from 'node:path'
import {eq} from 'drizzle-orm'
import { db } from '../db'
import { activities, budgetLines, documentChunks, documents, indicators, risks, type Document, type DocType } from '../db/schema'
import { env } from '../env'
import { chunkText } from '../extract/chunker'
import { classifyDocument, detectPeriod } from '../extract/classify'
import { extractStructured } from '../extract/structure'
import { parseBuffer } from '../parsers'
import { createHash } from 'node:crypto'

export interface UploadMeta {
    docType?: DocType
    beneficiaryEntity?: string
    reportingPeriod?: string
}

const sanitize = (s: string) => s.replace(/\u0000/g, "").replace(/\r\n/g, "\n")

async function insertBatched<T>(items: T[], insert: (batch: T[]) => Promise<unknown>, size = 500) {
    for(let i = 0; i < items.length; i += size) await insert(items.slice(i, i + size))
}

export async function ingestUpload(
    file: {buffer: Buffer; originalname: string; mimetype: string; size: number},
    meta: UploadMeta,
): Promise<{document: Document; duplicate: boolean}> {
    const sha256 = createHash("sha256").update(file.buffer).digest("hex")
    const [existing] = await db.select().from(documents).where(eq(documents.sha256, sha256 )).limit(1)
    if(existing) return {document: existing, duplicate: true}

    const filename = Buffer.from(file.originalname, 'latin1').toString('utf8')
    await fs.mkdir(env.UPLOAD_DIR, {recursive: true})
    const storagePath = path.join(env.UPLOAD_DIR, `${sha256}${path.extname(filename).toLowerCase()}`)
    await fs.writeFile(storagePath, file.buffer)

    const [doc] = await db.insert(documents).values({
        filename: filename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        sha256: sha256,
        storagePath: storagePath,
        docType: meta.docType ?? 'other',
        status: 'pending'

    }).returning()

    const processed = await processDocument(doc.documentId)
    return {document: processed, duplicate: false}
}

export async function processDocument(id: string): Promise<Document> {
    const [doc] = await db.select().from(documents).where(eq(documents.documentId, id)).limit(1)
    if(!doc) throw new Error("Document not found")

    await db.update(documents).set({status: 'processing', errorMessage: null, updatedAt: new Date()}).where(eq(documents.documentId, id))

    try{
        const buffer = await fs.readFile(doc.storagePath)
        const parsed = await parseBuffer(buffer, doc.filename)
        const text = sanitize(parsed.text)
        const extracted = extractStructured(parsed.tables)
        const chunks = chunkText(text)

        const docType = doc.docType === 'other' ? classifyDocument(doc.filename, text) : doc.docType
        const reportingPeriod = doc.reportingPeriod ?? detectPeriod(doc.filename, text)

        return await db.transaction(async (tx) => {
            await tx.delete(documentChunks).where(eq(documentChunks.documentId, id))
            await tx.delete(activities).where(eq(activities.documentId, id));
            await tx.delete(indicators).where(eq(indicators.documentId, id));
            await tx.delete(budgetLines).where(eq(budgetLines.documentId, id));
            await tx.delete(risks).where(eq(risks.documentId, id));

            const [updated] = await tx.update(documents).set({
                status: 'parsed',
                docType,
                reportingPeriod,
                rawText: text,
                pageCount: parsed.pageCount,
                metadata: {
                    ...parsed.metadata,
                    tablesFound: parsed.tables.length,
                    tablesMatched: extracted.tablesMatched,
                    tablesSkipped: extracted.tablesSkipped,
                    counts: {
                        chunks: chunks.length,
                        activities: extracted.activities.length,
                        indicators: extracted.indicators.length,
                        budgetLines: extracted.budgetLines.length,
                        risks: extracted.risks.length,
                    },
                },
                updatedAt: new Date()
            })
            .where(eq(documents.documentId, id))
            .returning()
        return updated
        })
    }catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const [failed] = await db.update(documents).set({
            status: 'failed', 
            errorMessage: message.slice(0, 1000), 
            updatedAt: new Date()
        })
        .where(eq(documents.documentId, id))
        .returning()

        return failed
    }
}