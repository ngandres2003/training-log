import { ChevronRight } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { PageHeader } from '../../app/PageHeader'
import { AccountSection } from './AccountSection'
import { DataTools } from './DataTools'
import { InviteSection } from './InviteSection'
import { deleteAllMyData } from './delete-all'
import { Section } from './Section'
import { SettingsForm } from './SettingsForm'
import { signOut } from './sign-out'
import { SyncDetail } from './SyncDetail'

const LINKS = [
  { to: '/perfil/ejercicios', label: 'Biblioteca de ejercicios' },
  { to: '/rutinas/archivadas', label: 'Rutinas archivadas' },
]

export interface ProfileProps {
  /** Defaults to the real sign-out; injectable for tests. */
  onSignOut?: () => Promise<void>
  /** Defaults to the real delete-all; injectable for tests. */
  onDeleteAll?: () => Promise<void>
}

/** V12 · Perfil y ajustes. */
export function Profile({
  onSignOut = () => signOut(),
  onDeleteAll = () => deleteAllMyData(),
}: ProfileProps) {
  const { hash } = useLocation()

  // The global sync indicator links to `/perfil#sync`.
  useEffect(() => {
    if (hash === '#sync') document.getElementById('sync')?.scrollIntoView?.()
  }, [hash])

  return (
    <>
      <PageHeader title="Perfil" />
      <div className="flex flex-col gap-4 pb-6">
        <AccountSection onSignOut={onSignOut} />
        <InviteSection />
        <SyncDetail />
        <SettingsForm />
        <DataTools onDeleteAll={onDeleteAll} />
        <Section title="Accesos">
          <ul className="flex flex-col">
            {LINKS.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="flex min-h-12 items-center justify-between gap-2 text-arena"
                >
                  {l.label}
                  <ChevronRight aria-hidden="true" className="size-5 text-polvo" />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  )
}

export default Profile
