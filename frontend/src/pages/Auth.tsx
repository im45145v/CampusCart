import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Notice } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth'

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mode === 'login') await login(email, password)
      else await register(name, email, password)
      nav((loc.state as { from?: string } | null)?.from ?? '/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-extrabold">{mode === 'login' ? 'Log in' : 'Create your account'}</h1>
      <form onSubmit={submit} className="space-y-4">
        {mode === 'register' && <Field label="Name"><Input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>}
        <Field label="Email"><Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
        <Field label="Password" hint={mode === 'register' ? 'At least 8 characters' : undefined}>
          <Input required type="password" minLength={mode === 'register' ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </Field>
        {error && <Notice tone="bad">{error}</Notice>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}</Button>
      </form>
      <p className="text-sm text-taupe">
        {mode === 'login' ? <>New here? <Link className="text-terracotta underline" to="/register">Create an account</Link></> : <>Already registered? <Link className="text-terracotta underline" to="/login">Log in</Link></>}
      </p>
    </Card>
  )
}
