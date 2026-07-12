import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Stand-in for pages not yet designed (KB, escalations, SLA admin, audit). */
export default function PlaceholderPage({ title }: { title: string }) {
  const { user } = useAuth()
  return (
    <div className="p-xl space-y-md">
      <h2 className="text-headline-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-body-md text-on-surface-variant">
        Signed in as {user?.name} ({user?.role}). This page's design is queued — the API layer for it is already wired.
      </p>
      <Link to="/" className="inline-flex items-center gap-xs text-primary text-body-sm hover:underline">
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_back</span>
        Back to dashboard
      </Link>
    </div>
  )
}
