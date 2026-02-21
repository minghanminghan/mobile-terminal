import { useState, type SubmitEvent, useEffect } from 'react'
import type { Credentials } from '../lib/relayClient'
import { addProfile, updateProfile, saveCredentials, type Profile } from '../lib/profiles'

interface Props {
  onConnect: (credentials: Credentials) => void
  onCancel: () => void  // New prompt to go back
  initialValues?: Partial<Profile>
  error?: string
}

export default function ConnectionForm({ onConnect, onCancel, initialValues, error }: Props) {
  const [name, setName] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('22')
  const [username, setUsername] = useState('')
  const [authType, setAuthType] = useState<'password' | 'key'>('password')
  const [password, setPassword] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [shell, setShell] = useState<'bash' | 'wsl'>('bash')
  const [projectPath, setProjectPath] = useState('')
  const [saveProfile, setSaveProfile] = useState(true)

  // Load initial values if provided (e.g. editing)
  useEffect(() => {
    if (initialValues) {
      setName(initialValues.name ?? '')
      setHost(initialValues.host ?? '')
      setPort(initialValues.port?.toString() ?? '22')
      setUsername(initialValues.username ?? '')
      setAuthType(initialValues.authType ?? 'password')
      // Only set shell if it's explicitly provided, otherwise default to bash
      if (initialValues.shell) {
        setShell(initialValues.shell)
      }
      setProjectPath(initialValues.projectPath ?? '')
      // Load stored credentials if available (passed in via initialValues from App.tsx which merged them)
      if ('password' in initialValues && (initialValues as any).password) {
        setPassword((initialValues as any).password)
      }
      if ('privateKey' in initialValues && (initialValues as any).privateKey) {
        setPrivateKey((initialValues as any).privateKey)
      }
    }
  }, [initialValues])

  useEffect(() => {
    // If we're not editing an existing profile (no ID), but we DO have a projectPath from initialValues
    // Ensure we set it. This handles the case where we navigate directly back from the Terminal screen
    // and want to keep our temporary projectPath.
    if (!initialValues?.id && initialValues?.projectPath) {
      setProjectPath(initialValues.projectPath)
    }
  }, [initialValues])


  function handleSubmit(e: SubmitEvent) {
    e.preventDefault()

    const portNum = parseInt(port, 10)

    if (saveProfile) {
      // Save or update profile
      const profileData: Omit<Profile, 'id'> = {
        name: name || `${username}@${host}`, // Default name if empty
        host,
        port: portNum,
        username,
        authType,
        shell,
        projectPath: projectPath.trim() || undefined,
      }

      let profileId = initialValues?.id
      if (profileId) {
        updateProfile(profileId, profileData)
      } else {
        const newProfile = addProfile(profileData)
        profileId = newProfile.id
      }

      // Save sensitive data to session storage
      saveCredentials(profileId, password, privateKey)
    }

    onConnect({
      host,
      port: portNum,
      username,
      ...(authType === 'password' ? { password } : { privateKey }),
      shell,
      projectPath: projectPath.trim() || undefined,
    })
  }

  return (
    <div className="flex items-center justify-center w-screen h-screen bg-black">
      <div className="w-full max-w-md p-8 border border-zinc-800 rounded-lg bg-zinc-950">
        <h1 className="text-white text-lg font-semibold mb-6 tracking-tight">
          {initialValues?.id ? 'Edit Connection' : 'New Connection'}
        </h1>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-950 border border-red-800 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Profile Name */}
          <div>
            <label className="block text-zinc-400 text-xs mb-1.5 uppercase tracking-wider">Profile Name (Optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Server"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-zinc-400 text-xs mb-1.5 uppercase tracking-wider">Host</label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.1"
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              />
            </div>
            <div className="w-20">
              <label className="block text-zinc-400 text-xs mb-1.5 uppercase tracking-wider">Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 text-xs mb-1.5 uppercase tracking-wider">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ubuntu"
              required
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
            />
          </div>

          <div>
            <label className="block text-zinc-400 text-xs mb-1.5 uppercase tracking-wider">Project Path (Optional)</label>
            <input
              type="text"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              placeholder="/var/www/my-app"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
            />
          </div>

          <div>
            <label className="block text-zinc-400 text-xs mb-1.5 uppercase tracking-wider">Auth</label>
            <div className="flex rounded overflow-hidden border border-zinc-700 mb-3">
              <button
                type="button"
                onClick={() => setAuthType('password')}
                className={`flex-1 py-1.5 text-sm transition-colors cursor-pointer ${authType === 'password'
                  ? 'bg-zinc-700 text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-300'
                  }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => setAuthType('key')}
                className={`flex-1 py-1.5 text-sm transition-colors cursor-pointer ${authType === 'key'
                  ? 'bg-zinc-700 text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-300'
                  }`}
              >
                Private Key
              </button>
            </div>

            {authType === 'password' ? (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required={!initialValues?.id} // Only required if creating new, not if editing/updating (unless we want to force re-entry)
                // Actually, for editing, we might not want to change the password if it's already in session.
                // But simplified: user enters password whenever they open this form.
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
              />
            ) : (
              <textarea
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="-----BEGIN RSA PRIVATE KEY-----"
                required={!initialValues?.id}
                rows={5}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-zinc-500 placeholder-zinc-600 resize-none"
              />
            )}
          </div>



          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-zinc-400 text-xs mb-1.5 uppercase tracking-wider">Target Host</label>
              <div className="flex rounded overflow-hidden border border-zinc-700">
                <button
                  type="button"
                  onClick={() => setShell('bash')}
                  className={`flex-1 py-1.5 text-xs transition-colors cursor-pointer ${shell === 'bash'
                    ? 'bg-zinc-700 text-white'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-300'
                    }`}
                >
                  Linux/Mac
                </button>
                <button
                  type="button"
                  onClick={() => setShell('wsl')}
                  className={`flex-1 py-1.5 text-xs transition-colors cursor-pointer ${shell === 'wsl'
                    ? 'bg-zinc-700 text-white'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-300'
                    }`}
                >
                  Windows (requires WSL)
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="saveProfile"
              checked={saveProfile}
              onChange={(e) => setSaveProfile(e.target.checked)}
              className="rounded bg-zinc-900 border-zinc-700"
            />
            <label htmlFor="saveProfile" className="text-zinc-400 text-sm select-none">Save Connection Profile</label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 bg-transparent border border-zinc-700 text-zinc-300 text-sm font-medium rounded hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-white text-black text-sm font-medium rounded hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
