// Parses tab-separated or space-delimited rows copied from bank websites

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

export function parsePastedRows(text, institution) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  const transactions = []

  for (const line of lines) {
    // Tab-separated first, fall back to 2+ spaces
    const cols = line.includes('\t')
      ? line.split('\t').map(c => c.trim()).filter(Boolean)
      : line.split(/\s{2,}/).map(c => c.trim()).filter(Boolean)

    if (cols.length < 2) continue

    // Find date column
    let dateInfo = null
    let dateIdx = -1
    for (let i = 0; i < Math.min(cols.length, 3); i++) {
      const d = detectDate(cols[i])
      if (d) { dateInfo = d; dateIdx = i; break }
    }
    if (!dateInfo) continue

    // Find amount column (rightmost money-like value)
    let amount = null
    let amountIdx = -1
    for (let i = cols.length - 1; i >= 0; i--) {
      const val = parseAmount(cols[i])
      if (val !== null) { amount = val; amountIdx = i; break }
    }
    if (amount === null) continue

    // Description: everything that isn't date or amount col
    const description = cols
      .filter((_, i) => i !== dateIdx && i !== amountIdx)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!description) continue

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
a// Parses tab-separated or space-delimited rows copied from bank websites
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

export function parsePastedRows(text, institution) {
  const lines = text.trim().split('\n').filter(l => l.trim())
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