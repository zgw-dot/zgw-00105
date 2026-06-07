/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import importRoutes from './routes/import.js'
import mappingRoutes from './routes/mapping.js'
import rulesRoutes from './routes/rules.js'
import analyzeRoutes from './routes/analyze.js'
import exportRoutes from './routes/export.js'
import { initStorage } from './services/storage.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

initStorage().catch(console.error);

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/import', importRoutes)
app.use('/api/mapping', mappingRoutes)
app.use('/api/rules', rulesRoutes)
app.use('/api/analyze', analyzeRoutes)
app.use('/api/export', exportRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
