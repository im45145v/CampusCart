import { MessageSquare, ShoppingBag, Store as StoreIcon, UserRound } from 'lucide-react'
import { Notifications } from './Notifications'
import { Link, NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { useCart } from '@/lib/cartContext'
import { useChat } from '@/lib/chat'
import { Button } from './ui/button'
import type { ReactNode } from 'react'

const nav = 'rounded-md px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/10 aria-[current=page]:bg-white/15 aria-[current=page]:text-white'

export function Layout() {
  const { user, logout } = useAuth()
  const { count } = useCart()
  const { unread, status } = useChat()
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-forest text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <Link to="/" className="mr-4 font-heading text-xl font-extrabold tracking-tight text-white">
            Campus<span className="text-[#f0a58b]">Cart</span>
          </Link>
          <nav aria-label="Main" className="flex flex-1 flex-wrap items-center gap-1">
            <NavLink to="/browse" className={nav}>Browse</NavLink>
            {user?.roles.includes('seller') && <NavLink to="/seller" className={nav}>Seller Studio</NavLink>}
            {user?.roles.includes('admin') && <NavLink to="/admin" className={nav}>Admin</NavLink>}
          </nav>
          <NavLink to="/cart" className={nav} aria-label={`Cart, ${count} items`}>
            <ShoppingBag className="inline h-4 w-4" aria-hidden /> {count > 0 && <span>{count}</span>}
          </NavLink>
          {user ? (
            <>
              <Notifications />
              <NavLink to="/inbox" className={nav} aria-label={`Messages, ${unread} unread${status === 'offline' ? ', offline' : ''}`}>
                <MessageSquare className="inline h-4 w-4" aria-hidden />
                {unread > 0 && <span className="ml-1 rounded-full bg-terracotta px-1.5 text-xs">{unread}</span>}
              </NavLink>
              <NavLink to="/account" className={nav}><UserRound className="inline h-4 w-4" aria-hidden /> {user.name.split(' ')[0]}</NavLink>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={logout}>Log out</Button>
            </>
          ) : (
            <Button asChild size="sm"><Link to="/login">Log in</Link></Button>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-line py-6 text-center text-sm text-taupe">
        <StoreIcon className="mr-1 inline h-4 w-4" aria-hidden />
        CampusCart: campus store and lending desk. Wallet credits are an on-campus ledger. Pay on pickup is confirmed by the seller.
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
