import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import { authRouter } from './routes/auth.js'
import { transactionsRouter } from './routes/transactions.js'
import { importRouter } from './routes/import.js'
import { accountsRouter } from './routes/accounts.js'
import { splitRouter } from './routes/split.js'
import { budgetsRouter } from './routes/budgets.js'
import { categoriesRouter } from './routes/categories.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(helmet())
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'cofin-api' }))

// Routes
app.use('/api/auth', authRouter)
app.use('/api/transactions', transactionsRouter)
app.use('/api/import', importRouter)
app.use('/api/accounts', accountsRouter)
app.use('/api/split', splitRouter)
app.use('/api/budgets', budgetsRouter)
app.use('/api/categories', categoriesRouter)

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }))

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error', message: err.message })
})

app.listen(PORT, () => console.log(`cofin API running on port ${PORT}`))