import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Notice } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth'

export default function AuthPage() {
  const { requestEmailCode, verifyEmailCode, login } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const dest = (loc.state as { from?: string } | null)?.from ?? '/'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [needsName, setNeedsName] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const [devCode, setDevCode] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const goHome = () => nav(dest, { replace: true })

  const sendCode = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await requestEmailCode(email, needsName ? name : undefined)
      if (result.needs_name) {
        setNeedsName(true)
        setError('Add your name the first time you use this email.')
        return
      }
      setSentTo(email.trim())
      setDevCode(result.dev_code ?? '')
      setCode('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code')
    } finally {
      setBusy(false)
    }
  }

  const submitCode = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await verifyEmailCode(sentTo, code.trim())
      goHome()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code did not work')
    } finally {
      setBusy(false)
    }
  }

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
      goHome()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">Sign in</h1>
        <p className="mt-1 text-sm text-taupe">
          We email a 6-digit code and a one-time link. A new address also needs your name.
        </p>
      </div>
      {sentTo ? (
        <form onSubmit={submitCode} className="space-y-4">
          <p className="text-sm text-forest">
            Enter the code sent to <span className="font-medium">{sentTo}</span>, or open the link in that email.
          </p>
          <Field label="Sign-in code">
            <Input
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </Field>
          {devCode && <Notice tone="ok">Development code: {devCode}</Notice>}
          {error && <Notice tone="bad">{error}</Notice>}
          <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
            {busy ? 'Please wait…' : 'Sign in'}
          </Button>
          <button
            type="button"
            className="text-sm text-terracotta underline"
            onClick={() => { setSentTo(''); setDevCode(''); setError('') }}
          >
            Use a different email
          </button>
        </form>
      ) : usePassword ? (
        <form onSubmit={submitPassword} className="space-y-4">
          <Field label="Email">
            <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Password">
            <Input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          {error && <Notice tone="bad">{error}</Notice>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Please wait…' : 'Log in'}</Button>
          <button type="button" className="text-sm text-terracotta underline" onClick={() => { setUsePassword(false); setError('') }}>
            Email me a code instead
          </button>
        </form>
      ) : (
        <form onSubmit={sendCode} className="space-y-4">
          <Field label="Email">
            <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          {needsName && (
            <Field label="Name" hint="Shown on your orders and messages">
              <Input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
          )}
          {error && <Notice tone="bad">{error}</Notice>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Please wait…' : 'Email me a code'}
          </Button>
        </form>
      )}
      {!sentTo && !usePassword && (
        <p className="text-sm text-taupe">
          Seeded demo accounts can{' '}
          <button type="button" className="text-terracotta underline" onClick={() => { setUsePassword(true); setError('') }}>
            sign in with a password
          </button>
          .
        </p>
      )}
      <p className="text-sm text-taupe">
        <Link className="text-terracotta underline" to="/help">How sign-in works</Link>
      </p>
    </Card>
  )
}

const magicLinkStarted = new Set<string>()

export function MagicLinkPage() {
  const { verifyMagicLink } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [error, setError] = useState('')
  const shownError = token ? error : 'This sign-in link is missing its token.'

  useEffect(() => {
    if (!token) return
    if (magicLinkStarted.has(token)) return
    magicLinkStarted.add(token)
    verifyMagicLink(token)
      .then(() => nav('/', { replace: true }))
      .catch((err: unknown) => {
        magicLinkStarted.delete(token)
        setError(err instanceof Error ? err.message : 'That sign-in link did not work')
      })
  }, [nav, token, verifyMagicLink])

  return (
    <Card className="mx-auto max-w-md space-y-3">
      <h1 className="text-2xl font-extrabold">Signing you in</h1>
      {shownError ? (
        <>
          <Notice tone="bad">{shownError}</Notice>
          <Button asChild><Link to="/login">Request a new code</Link></Button>
        </>
      ) : (
        <p className="text-sm text-taupe">Checking that sign-in link…</p>
      )}
    </Card>
  )
}
