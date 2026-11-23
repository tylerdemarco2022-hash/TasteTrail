import { useState } from 'react'

const SCREENS = [
  { title: 'Discover food worth remembering.' },
  { title: 'Rate the dish.' },
  { title: 'Save what you love.' }
]

export default function Onboarding({ onDone }) {
  const [index, setIndex] = useState(0)
  const last = index === SCREENS.length - 1

  function finish(view) {
    try { localStorage.setItem('tastetrails-intro-seen', '1') } catch { /* ignore */ }
    onDone(view)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--paper)] px-6 text-[var(--ink)]" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <div className="flex justify-end">
        <button type="button" className="btn btn-quiet" onClick={() => finish('login')}>Skip</button>
      </div>
      <div
        className="flex flex-1 items-center"
        onTouchStart={(event) => { event.currentTarget.dataset.x = String(event.changedTouches[0].clientX) }}
        onTouchEnd={(event) => {
          const start = Number(event.currentTarget.dataset.x || 0)
          const delta = event.changedTouches[0].clientX - start
          if (delta < -40 && !last) setIndex((value) => value + 1)
          if (delta > 40 && index > 0) setIndex((value) => value - 1)
        }}
      >
        <h1 className="font-display text-5xl leading-[1.05]">{SCREENS[index].title}</h1>
      </div>
      <div className="mb-6 flex gap-2" aria-label="Intro progress">
        {SCREENS.map((screen, dot) => (
          <button key={screen.title} type="button" aria-label={`Screen ${dot + 1}`} onClick={() => setIndex(dot)} className={`h-2 w-8 rounded-full ${dot === index ? 'bg-[var(--brand)]' : 'bg-[var(--line)]'}`} />
        ))}
      </div>
      {last ? (
        <div className="space-y-3">
          <button type="button" className="btn btn-primary w-full" onClick={() => finish('signup')}>Create account</button>
          <button type="button" className="btn btn-quiet w-full" onClick={() => finish('login')}>Sign in</button>
        </div>
      ) : (
        <button type="button" className="btn btn-primary w-full" onClick={() => setIndex((value) => value + 1)} aria-label="Next">Next</button>
      )}
    </div>
  )
}
