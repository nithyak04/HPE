import { useCallback, useEffect, useState } from 'react'

// All progress lives under one localStorage key, namespaced by module id so
// each module's completion is tracked independently but survives in one place.
const STORAGE_KEY = 'hpe-onboarding-progress-v1'

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // localStorage unavailable (private mode / quota) - fail silently, progress just won't persist
  }
}

// Notify other hook instances in the same tab when the store changes, since
// the native "storage" event only fires across tabs, not within one.
const listeners = new Set()
function emitChange() {
  listeners.forEach((fn) => fn())
}

export function useModuleProgress(moduleId, totalSections) {
  const [store, setStore] = useState(readStore)

  useEffect(() => {
    const onStorage = () => setStore(readStore())
    listeners.add(onStorage)
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(onStorage)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const completedIds = store[moduleId] || {}
  const completedCount = Object.keys(completedIds).length

  const markComplete = useCallback(
    (sectionId) => {
      setStore((prev) => {
        const moduleDone = prev[moduleId] || {}
        if (moduleDone[sectionId]) return prev
        const next = {
          ...prev,
          [moduleId]: { ...moduleDone, [sectionId]: true },
        }
        writeStore(next)
        emitChange()
        return next
      })
    },
    [moduleId]
  )

  const isComplete = useCallback((sectionId) => Boolean(completedIds[sectionId]), [completedIds])

  return {
    completedCount,
    total: totalSections,
    percent: totalSections ? Math.round((completedCount / totalSections) * 100) : 0,
    markComplete,
    isComplete,
  }
}

// Used on the landing page to summarize progress across every module without
// mounting each module's own hook.
export function useAllModulesProgress(modules) {
  const [store, setStore] = useState(readStore)

  useEffect(() => {
    const onStorage = () => setStore(readStore())
    listeners.add(onStorage)
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(onStorage)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return modules.map((mod) => {
    const done = store[mod.id] || {}
    const completedCount = Object.keys(done).length
    const total = mod.sections.length
    return {
      id: mod.id,
      completedCount,
      total,
      percent: total ? Math.round((completedCount / total) * 100) : 0,
      isModuleComplete: total > 0 && completedCount >= total,
    }
  })
}
