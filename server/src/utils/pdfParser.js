import pdfParse from 'pdf-parse'

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseAmount(str) {
  return parseFloat(str.replace(/[$,]/g, '')) || 0
}

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

function detectYear(text) {
  const m = text.match(/through\s+\w+\s+\d{1,2},\s+(\d{4})/)
  if (m) return parseInt(m[1])
  const m2 = text.match(/\b(202\d)\b/)
  return m2 ? parseInt(m2[1]) : new Date().getFullYear()
}

// ─── Chase-specific amount extraction ─────────────────────────────────────
// Chase PDFs concatenate amounts and balances with no separator:
//   -133.795,992.16 = amount(-133.79) + balance(5,992.16)
// They also glue reference numbers to amounts:
//   32603024654,557.19 = ref(3260302465) + amount(4,557.19)
// Strategy: insert spaces at these boundaries, then extract clean amounts.

function separateChaseNumbers(str) {
  return str
    // Ref number (6+ digits) immediately followed by comma-separated amount: "32603024654,557.19"
    .replace(/(\d{6,})(\d(?:,\d{3})+\.\d{2})/g, '$1 $2')
    // Ref number immediately followed by negative amount: "2462467002-133.79"
    .replace(/(\d{6,})(-\d)/g, '$1 $2')
    // Ref number immediately followed by small amount (no comma): "ref114.59"
    .replace(/(\d{6,})(\d{1,3}\.\d{2})(?!\d)/g, '$1 $2')
    // Amount immediately followed by balance (decimal boundary): "-133.795,992.16"
    .replace(/(\.\d{2})(\d)/g, '$1 $2')
}

function extractChaseAmounts(str) {
  const separated = separateChaseNumbers(str)
  const results = []
  const re = /-?(?:\d{1,3},)*\d+\.\d{2}(?!\d)/g
  let m
  while ((m = re.exec(separated)) !== null) {
    const val = parseFloat(m[0].replace(/,/g,''))
    if (!isNaN(val) && Math.abs(val) > 0) {
      results.push({ val, raw: m[0], idx: m.index })
    }
  }
  return results
}

// Strip reference/routing noise from Chase lines.
// KEY: strip ID labels only ("PPD ID: "), not the values —
// the digit values get handled by separateChaseNumbers().
function stripChaseNoise(block) {
  return block
    .replace(/\b(PPD|CCD|Web|ACH)\s+ID:\s*/gi, '')    // strip label, leave digits for separator
    .replace(/\bCard\s+\d{4}\b/gi, '')                  // "Card 9929"
    .replace(/\bRef:\s*\S+/gi, '')
    .replace(/\bTrn:\s*\S+/gi, '')
    .replace(/\bBref:\s*\S+/gi, '')
    .replace(/\bIid:\s*\S+/gi, '')
    .replace(/\bRecd:\s*[\d:]+/gi, '')
    .replace(/\bFrom:\s*\S+/gi, '')
    .replace(/\bInfo:\s*/gi, '')
    .replace(/\bVia\s+\S+/gi, '')
    .replace(/\b[A-Z][A-Z0-9]{7,}\b/g, '')             // long alphanumeric reference codes
    .replace(/\s+/g, ' ').trim()
}

// ─── Transaction subtype classifier ───────────────────────────────────────
function classifySubtype(description) {
  const d = description.toLowerCase()
  if (/american express|amex|citi card|discover|capital one|ccpymt|cc pymt|payment to chase card|robinhood card payment/i.test(d)) return 'cc_payment'
  if (/schwab|fidelity|vanguard|wells fargo ifi|dda to dda/i.test(d)) return 'transfer'
  if (/venmo|zelle|cashapp/i.test(d)) return 'p2p_transfer'
  if (/paypal/i.test(d)) return 'p2p_transfer'
  if (/payroll|direct deposit/i.test(d)) return 'payroll'
  if (/atm|cash withdrawal/i.test(d)) return 'atm'
  if (/real time transfer|wire/i.test(d)) return 'wire'
  if (/tmobile|t-mobile|at&t|verizon|comcast|spectrum|con ed|coned|electric|water|gas/i.test(d)) return 'bill'
  return 'debit'
}

function subtypeToCategory(subtype, type) {
  const map = {
    payroll:      'Income',
    wire:         type === 'income' ? 'Income' : 'Transfer',
    cc_payment:   'CC Payment',
    transfer:     'Transfer',
    p2p_transfer: 'Transfer',
    atm:          'Cash',
    bill:         'Utilities',
    debit:        'Uncategorized'
  }
  return map[subtype] || 'Uncategorized'
}

// ─── Chase checking/savings parser ────────────────────────────────────────
function parseChase(text) {
  const year = detectYear(text)
  const transactions = []
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Chase transaction lines: MM/DD glued directly to description (no space)
    const dateMatch = line.match(/^(\d{2}\/\d{2})([A-Z0-9].*)/)
    if (!dateMatch) continue

    const date = dateMatch[1]
    let block = dateMatch[2]

    // Collect continuation lines (multi-line transactions like wire transfers)
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const next = lines[j]
      if (/^\d{2}\/\d{2}[A-Z0-9]/.test(next)) break
      if (/^(IN CASE|For personal|For business|JPMorgan|CHECKING|TRANSACTION DETAIL|Beginning|Ending|\*start\*|\*end\*|Call us|We must|Your name|We accept)/.test(next)) break
      // Stop if continuation is long boilerplate with no amounts
      if (next.length > 100 && !/\d+\.\d{2}/.test(next)) break
      block += ' ' + next
    }

    block = block.replace(/\s+/g, ' ').trim()

    // Hard cap — scooped boilerplate
    if (block.length > 300) continue

    const clean = stripChaseNoise(block)
    const amounts = extractChaseAmounts(clean)
    if (amounts.length === 0) continue

    // Second-to-last amount = transaction, last = running balance
    const txAmt = amounts.length >= 2 ? amounts[amounts.length - 2] : amounts[amounts.length - 1]
    const amount = txAmt.val
    const absAmount = Math.abs(amount)
    if (absAmount === 0) continue

    // Description = everything before the transaction amount in the separated string
    const separated = separateChaseNumbers(clean)
    const rawIdx = separated.indexOf(txAmt.raw)
    let description = rawIdx > 0 ? separated.slice(0, rawIdx).trim() : separated
    // Strip bare long digit sequences remaining in description
    description = description.replace(/\b\d{6,}\b/g, '').replace(/\s+/g, ' ').trim()

    if (!description || description.length < 3) continue
    if (/^(DATE|AMOUNT|BALANCE)$/i.test(description)) continue

    const type = amount < 0 ? 'expense' : 'income'
    const subtype = classifySubtype(description)
    // Chase uses bold text for deposits — bold is lost in PDF extraction.
    // Any positive amount with no explicit negative sign is ambiguous.
    // Flag for user review so they can verify type and amount.
    const needsReview = !txAmt.raw.startsWith('-') && subtype !== 'payroll' && subtype !== 'wire'

    transactions.push({
      date: normalizeDate(date, year),
      description,
      amount: absAmount,
      type,
      category: subtypeToCategory(subtype, type),
      subtype,
      needs_review: needsReview,
      source: 'pdf',
      institution: 'chase',
      raw: block
    })
  }

  return transactions
}

// ─── Amex credit card parser ───────────────────────────────────────────────
function parseAmex(text) {
  const year = detectYear(text)
  const transactions = []
  const regex = /(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+\$?([\d,]+\.\d{2})\s*$/gm
  let match
  while ((match = regex.exec(text)) !== null) {
    const description = match[2].trim().replace(/\s+/g, ' ')
    const amount = parseAmount(match[3])
    const subtype = classifySubtype(description)
    transactions.push({
      date: normalizeDate(match[1], year),
      description,
      amount,
      type: 'expense',
      category: subtypeToCategory(subtype, 'expense'),
      subtype,
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
    const description = match[2].trim().replace(/\s+/g, ' ')
    const type = amount < 0 ? 'expense' : 'income'
    const subtype = classifySubtype(description)
    transactions.push({
      date: normalizeDate(match[1], year),
      description,
      amount: Math.abs(amount),
      type,
      category: subtypeToCategory(subtype, type),
      subtype,
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
    const description = match[2].trim().replace(/\s+/g, ' ')
    const amount = parseAmount(match[3])
    const subtype = classifySubtype(description)
    transactions.push({
      date: normalizeDate(match[1], year),
      description,
      amount,
      type: 'expense',
      category: subtypeToCategory(subtype, 'expense'),
      subtype,
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
    const description = match[2].trim().replace(/\s+/g, ' ')
    const type = amount < 0 ? 'expense' : 'income'
    const subtype = classifySubtype(description)
    transactions.push({
      date: normalizeDate(match[1], year),
      description,
      amount: Math.abs(amount),
      type,
      category: subtypeToCategory(subtype, type),
      subtype,
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
    const description = match[2].trim().replace(/\s+/g, ' ')
    const type = amount < 0 ? 'expense' : 'income'
    const subtype = classifySubtype(description)
    transactions.push({
      date: normalizeDate(match[1], year),
      description,
      amount: Math.abs(amount),
      type,
      category: subtypeToCategory(subtype, type),
      subtype,
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