export function chunkText(text: string, size = 1200, overlap =150): string[] {
    const paragraphs = text.split(/\n{2,}|\r\n{2,}/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean)
    const chunks: string[] = []
    let current = ""

    const push = () => {
        if(current.trim()) chunks.push(current.trim())
        current = ""
    }

    for(const p of paragraphs){
        if(p.length > size) {
            push()
            for(let i = 0; i < p.length; i+= size - overlap) chunks.push(p.slice(i, i + size))
            continue
        }

        if((current + " " + p).length > size) {
            const tail = current.slice(-overlap)
            push()
            current = tail
        }

        current = current ? `${current}\n${p}` : p
    }

    push()
    return chunks
}