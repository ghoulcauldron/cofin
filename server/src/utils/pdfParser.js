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

// ─── Reference number stripper ─────────────────────────────────────────────
// Chase embeds these in transaction lines — they look like numbers but aren't amounts:
//   PPD ID: 3260302465   CCD ID: 2462467002   Web ID: Intfitrvos
//   account refs like 90496401420256 (>8 digits, no decimal)
//   card refs like "Card 9929"
function stripReferenceNoise(str) {
  return str
    .replace(/\b(PPD|CCD|Web|ACH)\s+ID:\s*\S+/gi, '')   // PPD ID: 3260302465
    .replace(/\bCard\s+\d{4}\b/gi, '')                    // Card 9929
    .replace(/\b\d{9,}\b/g, '')                           // long digit strings (account/ref numbers)
    .replace(/\bRef:\s*\S+/gi, '')                         // Ref: 1799205702-NV...
    .replace(/\bTrn:\s*\S+/gi, '')                         // Trn: 2280272086Gb
    .replace(/\bBref:\s*\S+/gi, '')                        // Bref: 2A1Afd6B-...
    .replace(/\bIid:\s*\S+/gi, '')                         // Iid: 20260327...
    .replace(/\bRecd:\s*\S+/gi, '')                        // Recd: 18:19:26
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Transaction subtype classifier ───────────────────────────────────────
// Classifies checking account transactions so CC payments etc. are flagged
function classifySubtype(description, amount, type) {
  const d = description.toLowerCase()

  // Credit card payments — inter-account transfer, not spend
  if (/american express|amex.*pmt|citi.*payment|discover.*payment|chase.*payment|capital one.*payment|cc.*pymt|ccpymt/i.test(description)) {
    return 'cc_payment'
  }
  // Bank transfers
  if (/transfer|dda to dda|schwab|fidelity|vanguard|wells fargo ifi/i.test(d)) {
    return 'transfer'
  }
  // Venmo / Zelle / PayPal — could be reimbursement, flag for review
  if (/venmo|zelle|paypal|cashapp|cash app/i.test(d)) {
    return 'p2p_transfer'
  }
  // Payroll / direct deposit
  if (/payroll|direct deposit|payroll|salary/i.test(d)) {
    return 'payroll'
  }
  // ATM
  if (/atm|cash withdrawal/i.test(d)) {
    return 'atm'
  }
  // Regular debit / subscription
  return type === 'income' ? 'deposit' : 'debit'
}

// ─── Chase checking/savings parser ────────────────────────────────────────
function parseChase(text) {
  const year = detectYear(text)
  const transactions = []

  // Work within transaction detail section only
  const startMarker = text.indexOf('TRANSACTION DETAIL')
  const section = startMarker !== -1 ? text.slice(startMarker) : text

  // Split on MM/DD pattern glued to start of description (no space between date and text)
  const txPattern = /(\d{2}\/\d{2})([A-Z][^\n]+(?:\n(?!\d{2}\/\d{2})[^\n]*)*)/g

  let match
  while ((match = txPattern.exec(section)) !== null) {
    const date = match[1]

    // Join multi-line blocks, collapse whitespace
    const rawBlock = match[2].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()

    // Skip header/summary lines
    if (/^(DATE|DESCRIPTION|AMOUNT|BALANCE|Beginning|Ending|Deposits|ATM &|Electronic|CHECKING|IN CASE|JPMorgan|Service)/i.test(rawBlock)) continue

    // Strip reference noise BEFORE amount extraction
    const cleanBlock = stripReferenceNoise(rawBlock)

    // Now extract dollar amounts — these are the only real numbers left
    // Chase format: description then AMOUNT then BALANCE on same line
    // e.g. "Con Ed of NY Cecony Cecony -133.795,992.16"
    //       amount = -133.79, balance = 5,992.16
    const amounts = []
    const amtRegex = /-?[\d,]*\d{1,3}(?:,\d{3})*\.\d{2}(?!\d)/g
    let amtMatch
    while ((amtMatch = amtRegex.exec(cleanBlock)) !== null) {
      const val = parseAmount(amtMatch[0])
      if (!isNaN(val)) {
        amounts.push({ val, raw: amtMatch[0], idx: amtMatch.index })
      }
    }

    if (amounts.length === 0) continue

    // Second-to-last = transaction amount, last = running balance
    // If only one number found, it is the transaction amount
    const txAmt = amounts.length >= 2 ? amounts[amounts.length - 2] : amounts[amounts.length - 1]
    const amount = txAmt.val
    const absAmount = Math.abs(amount)
    if (absAmount === 0) continue

    // Description = everything in cleanBlock before the transaction amount position
    let description = cleanBlock.slice(0, txAmt.idx).trim()
    description = description.replace(/\s+/g, ' ').trim()
    if (!description || description.length < 2) continue

    const type = amount < 0 ? 'expense' : 'income'
    const subtype = classifySubtype(description, absAmount, type)

    // Auto-categorise based on subtype
    let category = 'Uncategorized'
    if (subtype === 'payroll') category = 'Income'
    if (subtype === 'cc_payment') category = 'CC Payment'
    if (subtype === 'transfer') category = 'Transfer'
    if (subtype === 'p2p_transfer') category = 'Transfer'
    if (subtype === 'atm') category = 'Cash'

    transactions.push({
      date: normalizeDate(date, year),
      description,
      amount: absAmount,
      type,
      category,
      subtype,
      source: 'pdf',
      institution: 'chase',
      raw: rawBlock
    })
  }

  return transactions
}

// ─── Amex credit card parser ───────────────────────────────────────────────
// All Amex statement lines are charges (expenses) — payments appear as credits
function parseAmex(text) {
  const year = detectYear(text)
  const transactions = []
  const regex = /(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+\$?([\d,]+\.\d{2})\s*$/gm
  let match
  while ((match = regex.exec(text)) !== null) {
    const description = match[2].trim().replace(/\s+/g, ' ')
    const amount = parseAmount(match[3])
    const subtype = classifySubtype(description, amount, 'expense')
    transactions.push({
      date: normalizeDate(match[1], year),
      description,
      amount,
      type: 'expense',
      category: 'Uncategorized',
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
    transactions.push({
      date: normalizeDate(match[1], year),
      description,
      amount: Math.abs(amount),
      type,
      category: 'Uncategorized',
      subtype: classifySubtype(description, Math.abs(amount), type),
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
    transactions.push({
      date: normalizeDate(match[1], year),
      description,
      amount,
      type: 'expense',
      category: 'Uncategorized',
      subtype: classifySubtype(description, amount, 'expense'),
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
    transactions.push({
      date: normalizeDate(match[1], year),
      description,
      amount: Math.abs(amount),
      type,
      category: 'Uncategorized',
      subtype: classifySubtype(description, Math.abs(amount), type),
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
    transactions.push({
      date: normalizeDate(match[1], year),
      description,
      amount: Math.abs(amount),
      type,
      category: 'Uncategorized',
      subtype: classifySubtype(description, Math.abs(amount), type),
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