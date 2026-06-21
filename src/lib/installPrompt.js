// Captures Android Chrome's install prompt as early as possible so an
// "Install app" button can trigger it on demand. iOS has no such event —
// there the UI shows manual "Add to Home Screen" instructions instead.

let deferred = null
const listeners = new Set()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e
    listeners.forEach(l => l())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach(l => l())
  })
}

export function canInstall() {
  return Boolean(deferred)
}

export function onInstallChange(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export async function promptInstall() {
  if (!deferred) return false
  deferred.prompt()
  const choice = await deferred.userChoice
  if (choice.outcome === 'accepted') deferred = null
  return choice.outcome === 'accepted'
}
