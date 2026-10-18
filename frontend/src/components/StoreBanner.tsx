import type { ReactNode } from 'react'
import { DEFAULT_THEME } from '@/lib/theme'
import type { Store } from '@/lib/types'

type BannerStore = Pick<Store, 'name' | 'logo_url' | 'banner_url' | 'tagline' | 'theme'>

export function StoreAvatar({ store, className = 'h-20 w-20 text-3xl' }: { store: Pick<Store, 'name' | 'logo_url'>; className?: string }) {
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-ivory font-heading font-extrabold text-forest/50 shadow ${className}`}>
      {store.logo_url ? <img src={store.logo_url} alt={`${store.name} logo`} referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : store.name.slice(0, 1).toUpperCase()}
    </div>
  )
}

export function StoreBanner({ store, children, height = 'h-40 sm:h-56' }: { store: BannerStore; children?: ReactNode; height?: string }) {
  const t = { ...DEFAULT_THEME, ...store.theme }
  return (
    <section aria-label={`${store.name} header`} className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className={`relative w-full ${height}`} style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.primary})` }}>
        {store.banner_url && <img src={store.banner_url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
      </div>
      <div className="flex flex-wrap items-end gap-4 px-5 pb-5">
        <div className="-mt-10"><StoreAvatar store={store} /></div>
        <div className="min-w-0 flex-1 pt-3">
          <h1 className="text-2xl font-extrabold">{store.name}</h1>
          {store.tagline && <p className="text-taupe">{store.tagline}</p>}
        </div>
        {children}
      </div>
    </section>
  )
}
