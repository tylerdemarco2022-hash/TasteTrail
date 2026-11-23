import { Compass, Search, Plus, UserRound } from 'lucide-react'

const TABS = [
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'rate', label: 'Rate', icon: Plus },
  { id: 'profile', label: 'Profile', icon: UserRound }
]

export default function BottomTabs({ active, onTabClick }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-lg">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const on = active === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              aria-label={tab.label}
              aria-current={on ? 'page' : undefined}
              onClick={() => onTabClick?.(tab.id)}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${on ? 'text-[var(--brand)]' : 'text-[var(--mute)]'}`}
            >
              <Icon className="h-5 w-5" strokeWidth={on ? 2.4 : 1.8} />
              {tab.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
