import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

export function useFetch<T>(path: string | null, params?: Record<string, string | number | boolean | undefined>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(path !== null)
  const key = path === null ? null : path + JSON.stringify(params ?? {})

  const load = useCallback(async (quiet = false) => {
    if (path === null) return
    if (!quiet) setLoading(true)
    if (!quiet) setError(null)
    try {
      setData(await api<T>(path, { params }))
    } catch (e) {
      if (!quiet) setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      if (!quiet) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    void load()
  }, [load])

  const reload = useCallback(() => load(false), [load])
  const reloadQuiet = useCallback(() => load(true), [load])
  return { data, error, loading, reload, reloadQuiet, setData }
}
