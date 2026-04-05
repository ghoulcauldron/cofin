import pdfParse from 'pdf-parse'

// ─── Date helpers ──────────────────────────────────────────────────────────

function normalizeDate(dateStr, year) {
  const parts = dateStr.split('/')
  if (parts.length === 2) {
    const y = year || new Date().getFullYear()
    return `${y}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`
  }
  if (parts.length === 3) {
    const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
    return `${y}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`
  }
  return dateStr
}

function parseAmount(str) {
  return parseFloat(str.replace(/[$,]/g, '')) || 0
}

// Detect statement year from Chase header "through April 03, 2026"
function detectYear(text) {
  const m = text.match(/through\s+\w+\s+\d{1,2},\s+(\d{4})/)
  if (m) return parseInt(m[1])
  const m2 = text.match(/\b(202\d)\b/)
  return m2 ? parseInt(m2[1]) : new Date().getFullYear()
}

// ─── Chase checking/savings ────────────────────────────────────────────────
// Extracted text format (date glued to description, amount+balance at end):
//   03/06Jagr Hq LLC      Payroll        PPD ID: 32603024654,557.19
//   03/09Con Ed of NY     Cecony         CCD ID: 2462467002-133.795,992.16
//   03/27Real Time Transfer...           (may span lines)
//                                        3,493.96
function parseChase(text) {
  const year = detectYear(text)
  const transactions = []

  // Work within transaction detail section only
  const startMarker = text.indexOf('TRANSACTION DETAIL')
  const section = startMarker !== -1 ? text.slice(startMarker) : text

  // Each tx starts with MM/DD immediately glued to description (no space)
  const txPattern = /(\d{2}\/\d{2})([A-Z][^\n]+(?:\n(?!\d{2}\/\d{2})[^\n]*)*)/g

  let match
  while ((match = txPattern.exec(section)) !== null) {
    const date = match[1]
    const block = match[2].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()

    // Skip non-transaction lines
    if (/^(DATE|DESCRIPTION|AMOUNT|BALANCE|Beginning|Ending|Deposits|ATM|Electronic|CHECKING|IN CASE)/i.test(block)) continue

    // Find all dollar amounts in block
    const amounts = []
    const amtRegex = /-?[\d,]+\.\d{2}/g
    let amtMatch
    while ((amtMatch = amtRegex.exec(block)) !== null) {
      amounts.push({ val: parseAmount(amtMatch[0]), raw: amtMatch[0], idx: amtMatch.index })
    }
    if (amounts.length < 1) continue

    // Last number = running balance, second-to-last = transaction amount
    const txAmt = amounts.length >= 2 ? amounts[amounts.length - 2] : amounts[amounts.length - 1]
    const amount = txAmt.val
    const absAmount = Math.abs(amount)
    if (absAmount === 0) continue

    // Description = everything before the transaction amount
    let description = block.slice(0, txAmt.idx).trim()
    description = description
      .replace(/\s+(PPD|CCD|Web)\s+ID:\s*\S+/gi, '')
      .replace(/Card\s+\d{4}\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (!description || description.length < 2) continue

    transactions.push({
      date: normalizeDate(date, year),
      description,
      amount: absAmount,
      type: amount < 0 ? 'expense' : 'income',
      source: 'pdf',
      institution: 'chase',
      raw: block
    })
  }

  return transactions
}

// ─── Amex ─────────────────────────────────────────────────────────────────
function parseAmex(text) {
  const year = detectYear(text)
  const transactions = []
  const regex = /(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+\$?([\d,]+\.\d{2})\s*$/gm
  let match
  while ((match = regex.exec(text)) !== null) {
    transactions.push({
      date: normalizeDate(match[1], year),
      description: match[2].trim().replace(/\s+/g, ' '),
      amount: parseAmount(match[3]),
      type: 'expense',
      source: 'pdf',
      institution: 'amex',
      raw: match[0].trim()
    })
  }
  return transactions
}

// ─── BofA ─────────────────────────────────────────────────────────────────
function parseBofa(text) {
  const year = detectYear(text)
  const transactions = []
  const regex = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/gm
  let match
  while ((match = regex.exec(text)) !== null) {
    const amount = parseAmount(match[3])
    transactions.push({
      date: normalizeDate(match[1], year),
      description: match[2].trim().replace(/\s+/g, ' '),
      amount: Math.abs(amount),
      type: amount < 0 ? 'expense' : 'income',
      source: 'pdf',
      institution: 'bofa',
      raw: match[0].trim()
    })
  }
  return transactions
}

// ─── Citi ─────────────────────────────────────────────────────────────────
function parseCiti(text) {
  const year = detectYear(text)
  const transactions = []
  const regex = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+\$?([\d,]+\.\d{2})\s*$/gm
  let match
  while ((match = regex.exec(text)) !== null) {
    transactions.push({
      date: normalizeDate(match[1], year),
      description: match[2].trim().replace(/\s+/g, ' '),
      amount: parseAmount(match[3]),
      type: 'expense',
      source: 'pdf',
      institution: 'citi',
      raw: match[0].trim()
    })
  }
  return transactions
}

// ─── Wells Fargo ───────────────────────────────────────────────────────────
function parseWellsFargo(text) {
  const year = detectYear(text)
  const transactions = []
  const regex = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/gm
  let match
  while ((match = regex.exec(text)) !== null) {
    const amount = parseAmount(match[3])
    transactions.push({
      date: normalizeDate(match[1], year),
      description: match[2].trim().replace(/\s+/g, ' '),
      amount: Math.abs(amount),
      type: amount < 0 ? 'expense' : 'income',
      source: 'pdf',
      institution: 'wellsfargo',
      raw: match[0].trim()
    })
  }
  return transactions
}

// ─── Generic fallback ─────────────────────────────────────────────────────
function parseGeneric(text) {
  const year = detectYear(text)
  const transactions = []
  const regex = /(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/gm
  let match
  while ((match = regex.exec(text)) !== null) {
    const amount = parseAmount(match[3])
    transactions.push({
      date: normalizeDate(match[1], year),
      description: match[2].trim().replace(/\s+/g, ' '),
      amount: Math.abs(amount),
      type: amount < 0 ? 'expense' : 'income',
      source: 'pdf',
      institution: 'generic',
      raw: match[0].trim()
    })
  }
  return transactions
}

// ─── Main export ──────────────────────────────────────────────────────────
export async function parsePdf(buffer, institution = 'generic') {
  const pdf = await pdfParse(buffer)
  const text = pdf.text
  const key = (institution || 'generic').toLowerCase().replace(/[^a-z]/g, '')

  const parsers = {
    chase:      parseChase,
    amex:       parseAmex,
    bofa:       parseBofa,
    wellsfargo: parseWellsFargo,
    citi:       parseCiti,
    generic:    parseGeneric
  }

  const parser = parsers[key] || parseGeneric
  return parser(text)
}