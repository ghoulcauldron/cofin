import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/supabase.js'

// Module-level cache — categories fetched once per session
let _cache = null
let _promise = null

export function useCategories() {
  const [categories, setCategories] = useState(_cache || [])
  const [loading, setLoading] = useState(!_cache)
  const [error, setError] = useState('')

  useEffect(() => {
    if (_cache) { setCategories(_cache); setLoading(false); return }
    if (!_promise) {
      _promise = api.get('/categories').then(data => { _cache = data; return data })
    }
    _promise
      .then(data => { setCategories(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const addCategory = useCallback(async (name, type = 'expense') => {
    const cat = await api.post('/categories', { name, type })
    _cache = [...(_cache || []), cat]
    setCategories([..._cache])
    return cat
  }, [])

  const deleteCategory = useCallback(async (id) => {
    await api.delete(`/categories/${id}`)
    _cache = (_cache || []).filter(c => c.id !== id)
    setCategories([..._cache])
  }, [])

  const refetch = useCallback(async () => {
    _cache = null; _promise = null; setLoading(true)
    try {
      const data = await api.get('/categories')
      _cache = data; setCategories(data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  return {
    categories,
    names: categories.map(c => c.name),
    loading,
    error,
    addCategory,
    deleteCategory,
    refetch
  }
}