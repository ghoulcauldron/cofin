// AccountsPage.jsx
export function AccountsPage() {
  return (
    <div style={{ padding:'24px 20px', maxWidth:700, margin:'0 auto' }}>
      <div style={{ fontFamily:'var(--serif)', fontSize:26, letterSpacing:'-0.5px', marginBottom:4 }}>Accounts</div>
      <div style={{ fontSize:13, color:'var(--muted)', marginBottom:28 }}>Manage your linked accounts</div>
      <div className="card" style={{ padding:'48px 24px', textAlign:'center', color:'var(--muted)' }}>
        <div style={{ fontSize:32, marginBottom:12 }}>🏦</div>
        <div style={{ fontSize:15, marginBottom:8 }}>Add your first account</div>
        <div style={{ fontSize:13, marginBottom:24 }}>Checking, savings, credit cards — everything in one place</div>
        <button className="btn btn-primary">+ Add account</button>
      </div>
    </div>
  )
}

// BudgetsPage.jsx
export function BudgetsPage() {
  return (
    <div style={{ padding:'24px 20px', maxWidth:700, margin:'0 auto' }}>
      <div style={{ fontFamily:'var(--serif)', fontSize:26, letterSpacing:'-0.5px', marginBottom:4 }}>Budgets</div>
      <div style={{ fontSize:13, color:'var(--muted)', marginBottom:28 }}>Monthly category limits and actuals</div>
      <div className="card" style={{ padding:'48px 24px', textAlign:'center', color:'var(--muted)' }}>
        <div style={{ fontSize:32, marginBottom:12 }}>◎</div>
        <div style={{ fontSize:15, marginBottom:8 }}>Set your first budget</div>
        <div style={{ fontSize:13, marginBottom:24 }}>Import some transactions first, then we'll suggest categories to budget</div>
        <button className="btn btn-primary">+ Create budget</button>
      </div>
    </div>
  )
}

// GoalsPage.jsx
export function GoalsPage() {
  return (
    <div style={{ padding:'24px 20px', maxWidth:700, margin:'0 auto' }}>
      <div style={{ fontFamily:'var(--serif)', fontSize:26, letterSpacing:'-0.5px', marginBottom:4 }}>Goals</div>
      <div style={{ fontSize:13, color:'var(--muted)', marginBottom:28 }}>Saving targets and progress tracking</div>
      <div className="card" style={{ padding:'48px 24px', textAlign:'center', color:'var(--muted)' }}>
        <div style={{ fontSize:32, marginBottom:12 }}>◈</div>
        <div style={{ fontSize:15, marginBottom:8 }}>Create your first goal</div>
        <div style={{ fontSize:13, marginBottom:24 }}>Emergency fund, vacation, home down payment — track it all here</div>
        <button className="btn btn-primary">+ Add goal</button>
      </div>
    </div>
  )
}
