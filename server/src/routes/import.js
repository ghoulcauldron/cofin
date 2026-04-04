import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/auth.js'
import { parsePdf } from '../utils/pdfParser.js'
import { parsePastedRows } from '../utils/pasteParser.js'
import { parseCsv } from '../utils/csvParser.js'

export const importRouter = Router()
importRouter.use(requireAuth)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'text/csv', 'application/vnd.ms-excel', 'text/plain']
    cb(null, allowed.includes(file.mimetype) || file.originalname.endsWith('.csv'))
  }
})

// PDF or CSV upload → returns parsed transactions for user review before committing
importRouter.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No valid file uploaded (PDF or CSV only)' })
  const { institution } = req.body

  try {
    let transactions = []
    const isPdf = req.file.mimetype === 'application/pdf' || req.file.originalname.endsWith('.pdf')
    if (isPdf) {
      transactions = await parsePdf(req.file.buffer, institution)
    } else {
      transactions = await parseCsv(req.file.buffer.toString('utf-8'), institution)
    }
    res.json({
      transactions,
      count: transactions.length,
      source: isPdf ? 'pdf' : 'csv',
      institution: institution || 'unknown'
    })
  } catch (err) {
    res.status(422).json({ error: 'Could not parse file', detail: err.message })
  }
})

// Paste handler — tab/space delimited rows copied from bank website
importRouter.post('/paste', async (req, res) => {
  const { text, institution } = req.body
  if (!text?.trim()) return res.status(400).json({ error: 'No text provided' })
  try {
    const transactions = parsePastedRows(text, institution)
    res.json({
      transactions,
      count: transactions.length,
      source: 'paste',
      institution: institution || 'unknown'
    })
  } catch (err) {
    res.status(422).json({ error: 'Could not parse pasted text', detail: err.message })
  }
})
