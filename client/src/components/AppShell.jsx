import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuthStore, useThemeStore } from '../stores/auth.js'

const NAV = [
  { to: '/',            label: 'Home',     icon: '⊙' },
  { to: '/transactions',label: 'Txns',     icon: '⇅' },
  { to: '/import',      label: 'Import',   icon: '⬆' },
  { to: '/split',       label: 'Split',    icon: '⚖' },
  { to: '/budgets',     label: 'Budgets',  icon: '◎' },
]

const SIDEBAR_NAV = [
  { section: 'Overview', items: [
    { to: '/',             label: 'Dashboard',     dot: 'accent' },
    { to: '/accounts',     label: 'Accounts',      dot: 'accent3' },
    { to: '/transactions', label: 'Transactions',  dot: 'muted' },
  ]},
  { section: 'Joint', items: [
    { to: '/split',        label: 'Split tracker', dot: 'accent2' },
  ]},
  { section: 'Plan', items: [
    { to: '/budgets',      label: 'Budgets',       dot: 'accent' },
    { to: '/goals',        label: 'Goals',         dot: 'accent2' },
  ]},
  { section: 'Import', items: [
    { to: '/import',       label: 'Import data',   dot: 'accent' },
  ]},
]

const DOT_COLORS = {
  accent:  'var(--accent)',
  accent2: 'var(--accent2)',
  accent3: 'var(--accent3)',
  muted:   'var(--subtle)',
}

export default function AppShell() {
  const { user, signOut } = useAuthStore()
  const { theme, toggle } = useThemeStore()
  const name = user?.user_metadata?.name || user?.email?.split('@')[0] || 'you'
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)

  return (
    <div className="app-shell">
      {/* ── Sidebar (desktop) ── */}
      <nav className="sidebar" style={{ padding: '24px 0' }}>
        {/* Logo */}
        <div style={{ padding: '0 20px 28px' }}>
          <div style={{ fontFamily:'var(--serif)', fontSize:22, color:'var(--accent)', letterSpacing:'-0.5px' }}>cofin</div>
          <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'2px', textTransform:'uppercase', marginTop:2 }}>your money, together</div>
        </div>

        {/* Nav sections */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {SIDEBAR_NAV.map(({ section, items }) => (
            <div key={section} style={{ padding:'0 12px', marginBottom:16 }}>
              <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase', padding:'0 8px', marginBottom:6 }}>{section}</div>
              {items.map(({ to, label, dot }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  style={({ isActive }) => ({
                    display:'flex', alignItems:'center', gap:10,
                    padding:'9px 12px', borderRadius:10,
                    color: isActive ? 'var(--text)' : 'var(--muted)',
                    background: isActive ? 'var(--bg4)' : 'transparent',
                    fontSize:13, marginBottom:2,
                    transition:'all 0.15s',
                    textDecoration:'none',
                  })}
                >
                  <span style={{ width:6, height:6, borderRadius:'50%', background:DOT_COLORS[dot], flexShrink:0 }} />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding:'0 12px', marginTop:'auto' }}>
          {/* Theme toggle */}
          <button onClick={toggle} style={{ width:'100%', background:'transparent', border:'none', textAlign:'left', padding:'8px 12px', color:'var(--muted)', fontSize:12, cursor:'pointer', marginBottom:8 }}>
            {theme === 'dark' ? '☀ light mode' : '● dark mode'}
          </button>
          {/* User row */}
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, background:'var(--bg3)' }}>
            <div style={{ width:30, height:30, borderRadius:'50%', background:'rgba(200,184,154,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:500, color:'var(--accent)', flexShrink:0 }}>
              {initials}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
              <div style={{ fontSize:10, color:'var(--muted)' }}>joint workspace</div>
            </div>
            <button onClick={signOut} style={{ background:'none', border:'none', color:'var(--subtle)', fontSize:11, cursor:'pointer', flexShrink:0 }}>out</button>
          </div>
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* ── Bottom nav (mobile) ── */}
      <nav className="bottom-nav">
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              flex:1, display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center', gap:3,
              fontSize:10, fontWeight:500,
              color: isActive ? 'var(--accent)' : 'var(--subtle)',
              textDecoration:'none',
              transition:'color 0.15s',
            })}
          >
            <span style={{ fontSize:20 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
