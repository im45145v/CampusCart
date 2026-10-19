import { Menu, MessageSquare, Search, ShoppingBag, UserRound, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { useCart } from '@/lib/cartContext'
import { useChat } from '@/lib/chat'
import { cn } from '@/lib/utils'
import { Notifications } from './Notifications'
import { Button } from './ui/button'
import type { ReactNode } from 'react'

const link = 'inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-white/90 transition-colors duration-200 hover:bg-white/10 aria-[current=page]:bg-white/15 aria-[current=page]:text-white'
const iconBtn = 'relative inline-flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors duration-200 hover:bg-white/10'

function SearchForm({ id, q, setQ, className }: { id: string; q: string; setQ: (v: string) => void; className?: string }) {
  const loc = useLocation()
  const nav = useNavigate()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    if (loc.pathname === '/browse') {
      const n = new URLSearchParams(loc.search)
      if (term) n.set('q', term)
      else n.delete('q')
      nav({ pathname: '/browse', search: n.toString() })
    } else {
      nav(term ? `/browse?q=${encodeURIComponent(term)}` : '/browse')
    }
  }
  return (
    <form onSubmit={submit} role="search" className={cn('relative min-w-0', className)}>
      <label htmlFor={id} className="sr-only">Search stalls and listings</label>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-taupe" aria-hidden />
      <input
        id={id}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search food, print, borrow…"
        className="h-11 w-full rounded-full border border-line bg-ivory pr-4 pl-9 text-sm text-ink placeholder:text-taupe/70 transition-[border-color,box-shadow] duration-200 focus-visible:border-terracotta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/25"
      />
    </form>
  )
}

export function Layout() {
  const { user, logout } = useAuth()
  const { count } = useCart()
  const { unread, status } = useChat()
  const loc = useLocation()
  const nav = useNavigate()
  const routeKey = `${loc.pathname}?${loc.search}`
  const [menuRoute, setMenuRoute] = useState(routeKey)
  const [menu, setMenu] = useState(false)
  const [draft, setDraft] = useState('')
  if (menuRoute !== routeKey) {
    setMenuRoute(routeKey)
    setMenu(false)
  }
  const onBrowse = loc.pathname === '/browse'
  const q = onBrowse ? (new URLSearchParams(loc.search).get('q') ?? '') : draft
  const setQ = (value: string) => {
    if (!onBrowse) {
      setDraft(value)
      return
    }
    const n = new URLSearchParams(loc.search)
    if (value) n.set('q', value)
    else n.delete('q')
    nav({ pathname: '/browse', search: n.toString() }, { replace: true })
  }
  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menu])

  const first = user?.name.split(' ')[0]
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:shadow-md">Skip to content</a>
      <header className="sticky top-0 z-40 bg-forest text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
          <Link to="/" className="mr-1 shrink-0 font-heading text-lg font-extrabold tracking-tight text-white">
            Uni<span className="text-gold">Cart</span>
          </Link>
          <SearchForm id="nav-search" q={q} setQ={setQ} className="mx-2 hidden max-w-md flex-1 md:block" />
          <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
            <NavLink to="/browse" className={link}>Browse</NavLink>
            {user?.roles.includes('seller') && <NavLink to="/seller" className={link}>Seller studio</NavLink>}
            {user?.roles.includes('admin') && <NavLink to="/admin" className={link}>Admin</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-0.5 md:ml-1">
            <NavLink to="/cart" className={iconBtn} aria-label={`Cart, ${count} items`}>
              <ShoppingBag className="h-5 w-5" aria-hidden />
              {count > 0 && <span key={count} className="absolute top-1 right-0.5 flex h-5 min-w-5 animate-pop items-center justify-center rounded-full bg-gold px-1 text-[11px] font-bold text-forest">{count}</span>}
            </NavLink>
            {user ? (
              <>
                <Notifications />
                <NavLink to="/inbox" className={iconBtn} aria-label={`Messages, ${unread} unread${status === 'offline' ? ', offline' : ''}`}>
                  <MessageSquare className="h-5 w-5" aria-hidden />
                  {unread > 0 && <span className="absolute top-1 right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta px-1 text-[11px] font-bold text-on-primary">{unread}</span>}
                </NavLink>
                <NavLink to="/account" className={cn(link, 'hidden px-2 sm:inline-flex')}><UserRound className="h-4 w-4" aria-hidden /> <span className="max-w-24 truncate">{first}</span></NavLink>
                <Button variant="ghost" size="sm" className="hidden text-white hover:bg-white/10 hover:text-white md:inline-flex" onClick={logout}>Log out</Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden text-white hover:bg-white/10 hover:text-white sm:inline-flex">
                  <Link to="/register">Sign up</Link>
                </Button>
                <Button asChild size="sm"><Link to="/login">Log in</Link></Button>
              </>
            )}
            <button type="button" className={`${iconBtn} md:hidden`} aria-expanded={menu} aria-controls="mobile-nav" aria-label={menu ? 'Close menu' : 'Open menu'} onClick={() => setMenu((v) => !v)}>
              {menu ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-3 md:hidden">
          <SearchForm id="nav-search-mobile" q={q} setQ={setQ} />
        </div>
        {menu && (
          <nav id="mobile-nav" aria-label="Mobile" className="animate-rise border-t border-white/15 px-4 py-2 md:hidden">
            <div className="flex flex-col">
              <NavLink to="/browse" className={link}>Browse</NavLink>
              {user?.roles.includes('seller') && <NavLink to="/seller" className={link}>Seller studio</NavLink>}
              {user?.roles.includes('admin') && <NavLink to="/admin" className={link}>Admin</NavLink>}
              {user && <NavLink to="/account" className={link}><UserRound className="h-4 w-4" aria-hidden /> {user.name}</NavLink>}
              {user ? <button type="button" className={cn(link, 'text-left')} onClick={logout}>Log out</button> : (
                <>
                  <NavLink to="/register" className={link}>Sign up</NavLink>
                  <NavLink to="/login" className={link}>Log in</NavLink>
                </>
              )}
            </div>
          </nav>
        )}
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 outline-none sm:py-8">
        <Outlet />
      </main>
      <footer className="mt-4 border-t border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p><span className="font-semibold text-ink">UniCart</span> <span className="text-taupe">· Student stalls, print jobs, and gear you can borrow.</span></p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1">
            <Link className="inline-flex min-h-11 items-center text-taupe underline-offset-2 hover:text-ink hover:underline" to="/help">Help</Link>
            <Link className="inline-flex min-h-11 items-center text-taupe underline-offset-2 hover:text-ink hover:underline" to="/payments">Payments</Link>
            <Link className="inline-flex min-h-11 items-center text-taupe underline-offset-2 hover:text-ink hover:underline" to="/terms">Terms</Link>
            <Link className="inline-flex min-h-11 items-center text-taupe underline-offset-2 hover:text-ink hover:underline" to="/privacy">Privacy</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

export function RequireAuth({ role, children }: { role?: 'seller' | 'admin'; children: ReactNode }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <p role="status" className="py-12 text-center text-taupe">Loading…</p>
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (role && !user.roles.includes(role)) return <Navigate to="/" replace />
  return <>{children}</>
}
