import pdfParse from 'pdf-parse'

// Institution-specific patterns — will grow as we train on real statements
const PATTERNS = {
  chase: {
    transaction: /(\d{2}\/\d{2})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/gm,
    dateFormat: 'MM/DD'
  },
  amex: {
    transaction: /(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+(\$?[\d,]+\.\d{2})\s*$/gm,
    dateFormat: 'MM/DD/YY'
  },
  bofa: {
    transaction: /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/gm,
    dateFormat: 'MM/DD/YYYY'
  },
  citi: {
    transaction: /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+\$?([\d,]+\.\d{2})\s*$/gm,
    dateFormat: 'MM/DD/YYYY'
  },
  wellsfargo: {
    transaction: /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/gm,
    dateFormat: 'MM/DD/YYYY'
  },
  generic: {
    transaction: /(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/gm,
    dateFormat: 'generic'
  }
}

function parseAmount(str) {
  return parseFloat(str.replace(/[$,]/g, '')) || 0
}

function normalizeDate(dateStr, format) {
  const year = new Date().getFullYear()
  if (format === 'MM/DD') {
    const [m, d] = dateStr.split('/')
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  if (format === 'MM/DD/YY') {
    const [m, d, y] = dateStr.split('/')
    return `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  if (format === 'MM/DD/YYYY') {
    const [m, d, y] = dateStr.split('/')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // generic — attempt best parse
  const parts = dateStr.replace(/-/g, '/').split('/')
  if (parts.length === 2) return `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
  if (parts.length === 3) {
    const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
    return `${y}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
  }
  return dateStr
}

export async function parsePdf(buffer, institution = 'generic') {
  const pdf = await pdfParse(buffer)
  const text = pdf.text
  const key = (institution || 'generic').toLowerCase().replace(/[^a-z]/g, '')
  const pattern = PATTERNS[key] || PATTERNS.generic
  const transactions = []

  // Reset regex state
  const regex = new RegExp(pattern.transaction.source, 'gm')
  let match
  while ((match = regex.exec(text)) !== null) {
    const raw = parseAmount(match[3])
    transactions.push({
      date: normalizeDate(match[1], pattern.dateFormat),
      description: match[2].trim().replace(/\s+/g, ' '),
      amount: Math.abs(raw),
      type: raw < 0 ? 'expense' : 'income',
      source: 'pdf',
      institution: key,
      raw: match[0].trim()
    })
  }

  return transactions
}
