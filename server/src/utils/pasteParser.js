// Parses tab-separated or space-delimited rows copied from bank websites
// Handles Chase, Amex, BofA, Citi and generic formats

function parseAmount(str) {
  if (!str) return null
  const cleaned = str.replace(/[$,\s()]/g, '')
  const val = parseFloat(cleaned)
  return isNaN(val) ? null : val
}

function detectDate(str) {
  const patterns = [
    { re: /^\d{4}-\d{2}-\d{2}$/, fmt: 'ISO' },
    { re: /^\d{2}\/\d{2}\/\d{4}$/, fmt: 'MDY4' },
    { re: /^\d{2}\/\d{2}\/\d{2}$/, fmt: 'MDY2' },
    { re: /^\d{1,2}\/\d{1,2}$/, fmt: 'MD' }
  ]
  for (const { re, fmt } of patterns) {
    if (re.test(str.trim())) return { raw: str.trim(), fmt }
  }
  return null
}

function normalizeDate(raw, fmt) {
  const year = new Date().getFullYear()
  if (fmt === 'ISO') return raw
  const parts = raw.split('/')
  if (fmt === 'MDY4') return `${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`
  if (fmt === 'MDY2') return `20${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`
  if (fmt === 'MD') return `${year}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`
  return raw
}

function isLikelyRefNumber(str) {
  // Long digit-only strings are reference/account numbers, not amounts
  return /^\d{7,}$/.test(str.replace(/[$,\s]/g, ''))
}

function pickTransactionAmount(amountCols) {
  // amountCols: array of { val, idx } in order of appearance (left to right)
  // Chase paste format ends with: ... AMOUNT  BALANCE
  // where AMOUNT can be negative and BALANCE is always positive
  //
  // Rules:
  // 1. If any value is negative — that's the transaction amount (Chase debits)
  // 2. If two positives at the end — second-to-last is amount, last is balance
  // 3. If only one value — that's the amount

  if (amountCols.length === 0) return null
  if (amountCols.length === 1) return amountCols[0]

  // Rule 1: prefer explicit negative
  const negIdx = amountCols.findLastIndex(a => a.val < 0)
  if (negIdx !== -1) return amountCols[negIdx]

  // Rule 2: two or more positives — second-to-last is the transaction amount
  return amountCols[amountCols.length - 2]
}

// ── Chase Sapphire / Chase CC paste parser ──────────────────────────────────
// Chase CC PDFs copy as a single blob with date+description+amount tokens
// Format: "11/14     Payment Thank You-Mobile-1,071.35 11/10     LYFT..."
function parseChaseCC(text) {
  const transactions = []

  // Truncate boilerplate at end of statement
  const boilerplateIdx = text.search(/TOTAL FEES|Year-to-date|Total fees charged|PAYMENTS AND OTHER CREDITS/i)
  const clean = boilerplateIdx > 0 ? text.slice(0, boilerplateIdx) : text

  // Split on date boundaries — each transaction starts with MM/DD + 2+ spaces
  const datePattern = /(\d{1,2}\/\d{2})\s{2,}/g
  const positions = []
  let m
  while ((m = datePattern.exec(clean)) !== null) {
    positions.push({ idx: m.index, date: m[1], contentStart: m.index + m[0].length })
  }

  // Detect statement year from context (Nov-Dec = prior year if current month is Jan+)
  const now = new Date()
  const currentYear = now.getFullYear()

  for (let i = 0; i < positions.length; i++) {
    const { date, contentStart } = positions[i]
    const end = i + 1 < positions.length ? positions[i + 1].idx : clean.length
    const chunk = clean.slice(contentStart, end).trim()

    // Skip foreign currency exchange rate footnotes
    if (/INDIAN RUPEE|EXCHG RATE|exchange rate|X 0\.\d+/i.test(chunk)) continue
    if (!chunk) continue

    // Amount is always the last number in the chunk
    const amtMatch = chunk.match(/-?([\d,]+\.\d{2})$/)
    if (!amtMatch) continue

    const rawAmount = parseFloat(amtMatch[0].replace(/,/g, ''))
    const absAmount = Math.abs(rawAmount)
    if (absAmount === 0) continue

    // Description = chunk minus the trailing amount
    let description = chunk.slice(0, chunk.lastIndexOf(amtMatch[0])).trim()

    // Clean description
    description = description
      .replace(/[A-Z]{2}\s*$/,'')                      // trailing state code
      .replace(/\s+/g, ' ')
      .trim()

    // Detect payment/credit
    const isPayment = /payment thank you|credit|refund/i.test(description) || rawAmount < 0
    const type = isPayment ? 'income' : 'expense'
    if (isPayment) {
      description = 'CC Payment'
    }

    // Normalize date — infer year from month
    const [mo, day] = date.split('/')
    const month = parseInt(mo)
    // If statement month is Nov/Dec and we're past Jan, it's likely prior year
    let txYear = currentYear
    if (month >= 11 && now.getMonth() < 6) txYear = currentYear - 1
    if (month <= 3 && now.getMonth() >= 9) txYear = currentYear + 1
    const normalizedDate = `${txYear}-${mo.padStart(2,'0')}-${day.padStart(2,'0')}`

    transactions.push({
      date: normalizedDate,
      description,
      amount: absAmount,
      type,
      category: isPayment ? 'CC Payment' : 'Uncategorized',
      subtype: isPayment ? 'cc_payment' : 'debit',
      source: 'paste',
      institution: 'chase_sapphire',
    })
  }

  return transactions
}

export function parsePastedRows(text, institution) {
  // Route Chase CC blob format to dedicated parser
  if (institution === 'chase_sapphire' || institution === 'chase_cc') {
    return parseChaseCC(text)
  }
  // Also auto-detect: if text has no newlines and lots of date tokens, it's CC blob format
  const lines = text.trim().split('\n').filter(l => l.trim())
  const dateMatches = (text.match(/\d{1,2}\/\d{2}\s{2,}/g) || []).length
  if (lines.length <= 2 && dateMatches > 3) {
    return parseChaseCC(text)
  }
  const transactions = []

  for (const line of lines) {
    // Tab-separated first, fall back to 2+ spaces, then single space
    let cols
    if (line.includes('\t')) {
      cols = line.split('\t').map(c => c.trim()).filter(Boolean)
    } else if (/\s{2,}/.test(line)) {
      cols = line.split(/\s{2,}/).map(c => c.trim()).filter(Boolean)
    } else {
      cols = line.split(/\s+/).map(c => c.trim()).filter(Boolean)
    }

    if (cols.length < 2) continue

    // Find date column (check first 3 cols)
    let dateInfo = null
    let dateIdx = -1
    for (let i = 0; i < Math.min(cols.length, 3); i++) {
      const d = detectDate(cols[i])
      if (d) { dateInfo = d; dateIdx = i; break }
    }
    if (!dateInfo) continue

    // Find all money-like columns (exclude date, exclude long ref numbers)
    const amountCols = []
    for (let i = 0; i < cols.length; i++) {
      if (i === dateIdx) continue
      if (isLikelyRefNumber(cols[i])) continue
      const val = parseAmount(cols[i])
      if (val !== null && Math.abs(val) > 0) {
        amountCols.push({ val, idx: i })
      }
    }

    if (amountCols.length === 0) continue

    const chosen = pickTransactionAmount(amountCols)
    if (!chosen) continue

    // Description: everything that isn't the date, the chosen amount, or the balance
    // Exclude the last amount col (balance) and the chosen amount col
    const excludeIdxs = new Set([dateIdx, chosen.idx])
    // If there are 2+ amounts and we picked second-to-last, also exclude last (balance)
    if (amountCols.length >= 2) {
      excludeIdxs.add(amountCols[amountCols.length - 1].idx)
    }

    const description = cols
      .filter((col, i) => {
        if (excludeIdxs.has(i)) return false
        if (isLikelyRefNumber(col)) return false
        return true
      })
      .join(' ')
      .replace(/\b(PPD|CCD|Web|ACH)\s+ID:\s*/gi, '')  // strip ID labels
      .replace(/\s+/g, ' ')
      .trim()

    if (!description) continue

    const amount = chosen.val
    transactions.push({
      date: normalizeDate(dateInfo.raw, dateInfo.fmt),
      description,
      amount: Math.abs(amount),
      type: amount < 0 ? 'expense' : 'income',
      source: 'paste',
      institution: institution || 'unknown',
      raw: line
    })
  }

  return transactions
}