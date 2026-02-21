import { useState, useEffect } from 'react'
import { loadProfiles, deleteProfile, type Profile } from '../lib/profiles'

interface Props {
  onConnect: (profile: Profile) => void
  onEdit: (profile: Profile) => void
  onNew: () => void
}

export default function ProfileList({ onConnect, onEdit, onNew }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([])

  useEffect(() => {
    setProfiles(loadProfiles())
  }, [])

  function handleDelete(id: string) {
    if (confirm('Are you sure you want to delete this profile?')) {
      deleteProfile(id)
      setProfiles(loadProfiles())
    }
  }

  return (
    <div className="flex items-center justify-center w-screen h-screen bg-black overflow-y-auto">
      <div className="w-full max-w-2xl p-8 mt-16 max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white tracking-tight">Projects</h2>
          <button
            onClick={onNew}
            className="bg-white text-black px-4 py-2 rounded text-sm font-medium hover:bg-zinc-200 transition-colors"
          >
            New Project
          </button>
        </div>

        {profiles.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-zinc-800 rounded-lg">
            <p className="text-zinc-500 mb-4">No saved projects yet.</p>
            <button
              onClick={onNew}
              className="text-white underline hover:text-zinc-300 transition-colors"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 hover:border-zinc-600 transition-colors group"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-white font-medium truncate pr-2">{profile.name}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEdit(profile)}
                      className="text-zinc-500 hover:text-white p-1"
                      title="Edit"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(profile.id)}
                      className="text-zinc-500 hover:text-red-400 p-1"
                      title="Delete"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="text-zinc-400 text-sm font-mono mb-4 truncate">
                  {profile.username}@{profile.host}:{profile.port}
                  {profile.projectPath && (
                    <span className="block mt-1 text-zinc-500">
                      <span className="mr-1">↳</span>{profile.projectPath}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => onConnect(profile)}
                  className="w-full bg-zinc-800 text-zinc-200 py-2 rounded text-sm font-medium group-hover:bg-zinc-700 hover:text-white transition-colors"
                >
                  Connect
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
