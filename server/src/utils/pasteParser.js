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
