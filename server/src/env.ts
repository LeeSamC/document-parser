import 'dotenv/config'
import {z} from 'zod'

const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1),
    UPLOAD_DIR: z.string().default("./uploads"),
    MAX_UPLOAD_MB: z.coerce.number().positive().default(25),
    CORS_ORIGIN: z.string().default("http://localhost:5173"),


})

const parsed = schema.safeParse(process.env)
if(!parsed.success){
    console.error("Invalid environmet configs")

    for(const issue of parsed.error.issues) console.error(` - ${issue.path.join(".")}: ${issue.message}`)
    process.exit(1)
}

export const env = parsed.data