// Flexible CSV parser — handles most bank CSV exports
// Detects column positions by header name matching

function col(row, headers, ...names) {
  for (const name of names) {
    const idx = headers.findIndex(h => h.includes(name))
    if (idx !== -1) return row[idx]?.replace(/"/g, '').trim() || ''
  }
  return ''
}

function splitCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue }
    current += ch
  }
  result.push(current)
  return result
}

export async function parseCsv(text, institution) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z ]/g, '').trim())
  const transactions = []

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const row = splitCsvLine(line)

    const dateRaw = col(row, headers, 'date', 'transaction date', 'posting date', 'trans date')
    const description = col(row, headers, 'description', 'merchant', 'payee', 'name', 'memo')

    if (!dateRaw || !description) continue

    // Handle debit/credit in separate columns (common in bank exports)
    let amount = 0
    let type = 'expense'
    const debitRaw = col(row, headers, 'debit', 'withdrawals', 'withdrawal')
    const creditRaw = col(row, headers, 'credit', 'deposits', 'deposit')
    const amountRaw = col(row, headers, 'amount', 'transaction amount')

    if (debitRaw || creditRaw) {
      const debit = parseFloat(debitRaw?.replace(/[$,]/g, '') || '0') || 0
      const credit = parseFloat(creditRaw?.replace(/[$,]/g, '') || '0') || 0
      if (credit > 0) { amount = credit; type = 'income' }
      else { amount = debit; type = 'expense' }
    } else if (amountRaw) {
      const raw = parseFloat(amountRaw.replace(/[$,]/g, '')) || 0
      amount = Math.abs(raw)
      type = raw >= 0 ? 'income' : 'expense'
    }

    if (amount === 0) continue

    transactions.push({
      date: dateRaw,
      description,
      amount,
      type,
      category: col(row, headers, 'category', 'type') || 'Uncategorized',
      source: 'csv',
      institution: institution || 'unknown'
    })
  }

  return transactions
}
