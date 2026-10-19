import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Notice } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth'

export default function AuthPage() {
  const { user, login, register } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const signingUp = loc.pathname === '/register'
  const dest = (loc.state as { from?: string } | null)?.from ?? '/'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user) nav(dest, { replace: true })
  }, [dest, nav, user])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (signingUp) await register(name.trim(), email.trim(), password)
      else await login(email.trim(), password)
      nav(dest, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : signingUp ? 'Could not create the account' : 'Could not sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 pt-2">
      <p className="text-center font-heading text-lg font-extrabold tracking-tight">Uni<span className="text-terracotta">Cart</span></p>
      <Card className="space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold">{signingUp ? 'Create an account' : 'Sign in'}</h1>
          <p className="mt-1 text-sm text-taupe">
            {signingUp
              ? 'Name, email, and a password. You can order and open a stall after this.'
              : 'Use the email and password for your account.'}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {signingUp && (
            <Field label="Name" hint="Shown on your orders and messages">
              <Input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
            </Field>
          )}
          <Field label="Email">
            <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Password" hint={signingUp ? 'At least 8 characters' : undefined}>
            <Input
              required
              type="password"
              minLength={signingUp ? 8 : undefined}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={signingUp ? 'new-password' : 'current-password'}
            />
          </Field>
          {error && <Notice tone="bad">{error}</Notice>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Please wait…' : signingUp ? 'Create account' : 'Sign in'}
          </Button>
        </form>
        <p className="text-sm text-taupe">
          {signingUp ? (
            <>
              Already have an account?{' '}
              <Link className="text-terracotta underline" to="/login" state={loc.state}>Sign in</Link>
            </>
          ) : (
            <>
              New here?{' '}
              <Link className="text-terracotta underline" to="/register" state={loc.state}>Create an account</Link>
            </>
          )}
        </p>
      </Card>
    </div>
  )
}
