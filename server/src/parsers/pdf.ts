import {PDFParse} from 'pdf-parse'
import { detectTextTables } from './textTables'
import { ParsedDocument } from './types'

export async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
    const parser = new PDFParse({data: buffer})

    try{
        const[textResult, infoResult] = await Promise.all([
            parser.getText(),
            parser.getInfo()
        ])
        const text = textResult.text ?? ''

        if(text.trim().length < 20) {
            throw new Error('PDF contains no extractable text (scanned image?). OCR is not enabled in this prototype.')
        }

        return {
            text,
            tables: detectTextTables(text),
            pageCount: textResult.total ?? null,
            metadata: infoResult.info ?? null
        }
    }finally{
        await parser.destroy()
    }
    
}