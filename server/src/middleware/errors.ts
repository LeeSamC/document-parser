import type {ErrorRequestHandler, NextFunction, Request, RequestHandler, Response} from 'express'
import multer from 'multer'
import {ZodType} from 'zod'

export class HttpError extends Error {
    constructor(public status: number, message: string, public details?: unknown) {
        super(message)
    }
}

export const asyncHandler = 
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
    (req, res, next) => {
        fn(req, res, next).catch(next)
    }

export const validate = 
    (schema: ZodType, source: 'body' | 'query' | 'params'): RequestHandler =>
    (req, res, next) => {
        const r = schema.safeParse(req[source])
        if(!r.success) {
            return next(new HttpError(400, 'Validation failed', r.error.issues.map((i) => ({path: i.path.join('.'), message: i.message}))))
        }
        res.locals[source] = r.data;
        next()
    }

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if(err instanceof HttpError) return res.status(err.status).json({error: err.message, details: err.details})
    if(err instanceof multer.MulterError) return res.status(400).json({error: err.message})
    console.error(err)
    res.status(500).json({error: 'Internal server error'})
}