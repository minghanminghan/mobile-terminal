import { useEffect, useState } from 'react'
import ConnectionForm from './components/ConnectionForm'
import TerminalWorkspace from './components/TerminalWorkspace'
import ProfileList from './components/ProfileList'
import type { Credentials } from './lib/relayClient'
import { getCredentials, type Profile } from './lib/profiles'

type View = 'list' | 'form'

export default function App() {
  const [view, setView] = useState<View>('list')
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  // If editing, this holds the initial values for the form
  const [editingProfile, setEditingProfile] = useState<Profile | undefined>()
  const [error, setError] = useState<string | undefined>()

  // Check for React Native WebView injection on mount
  useEffect(() => {
    const injected = (window as any).__INITIAL_PROFILE__
    if (injected) {
      handleConnect(injected)
    }
  }, [])

  function handleConnect(creds: Credentials) {
    setError(undefined)
    setCredentials(creds)
  }

  function handleDisconnect(reason?: string) {
    setCredentials(null)
    if (reason) setError(reason)
    // Return to list view on disconnect
    setView('list')
  }

  function handleProfileConnect(profile: Profile) {
    // Try to get credentials from session storage
    const creds = getCredentials(profile.id)

    if (creds && (creds.password || creds.privateKey)) {
      // Connect immediately if we have the secret
      handleConnect({
        host: profile.host,
        port: profile.port,
        username: profile.username,
        shell: profile.shell,
        projectPath: profile.projectPath,
        ...creds,
      })
    } else {
      // Otherwise open form to enter password/key
      setEditingProfile(profile)
      setView('form')
    }
  }

  if (credentials) {
    return <TerminalWorkspace credentials={credentials} onDisconnect={handleDisconnect} />
  }



  if (view === 'form') {
    return (
      <ConnectionForm
        onConnect={handleConnect}
        onCancel={() => {
          setView('list')
          setEditingProfile(undefined)
          setError(undefined)
        }}
        initialValues={editingProfile}
        error={error}
      />
    )
  }

  return (
    <ProfileList
      onConnect={handleProfileConnect}
      onEdit={(profile) => {
        const creds = getCredentials(profile.id)
        setEditingProfile({ ...profile, ...creds } as Profile)
        setView('form')
        setError(undefined)
      }}
      onNew={() => {
        setEditingProfile(undefined)
        setView('form')
        setError(undefined)
      }}
    />
  )
}
