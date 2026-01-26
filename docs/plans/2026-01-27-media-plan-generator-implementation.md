# Media Plan Generator - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web app where marketers create and download Excel media plans with 3 forecast scenarios.

**Architecture:** Next.js App Router with Supabase for auth/database. Server components for data fetching, client components for forms. Excel generated server-side with ExcelJS.

**Tech Stack:** Next.js 14, Supabase, Tailwind CSS, shadcn/ui, ExcelJS, Vercel

---

## Phase 1: Project Setup

### Task 1.1: Initialize Git Repository

**Step 1:** Initialize git
```bash
git init
```

**Step 2:** Create .gitignore
```
# dependencies
node_modules
.pnpm-store

# next.js
.next/
out/

# env
.env
.env*.local

# vercel
.vercel

# misc
.DS_Store
*.pem
```

**Step 3:** Initial commit
```bash
git add .
git commit -m "chore: initial commit with design docs"
```

---

### Task 1.2: Create Next.js App

**Step 1:** Create Next.js project
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```
Select: Yes to all defaults

**Step 2:** Commit
```bash
git add .
git commit -m "chore: scaffold Next.js 14 app"
```

---

### Task 1.3: Install shadcn/ui

**Step 1:** Initialize shadcn/ui
```bash
npx shadcn@latest init
```
Select: Default style, Slate color, CSS variables: Yes

**Step 2:** Add core components
```bash
npx shadcn@latest add button input label card form table tabs select dialog dropdown-menu toast
```

**Step 3:** Commit
```bash
git add .
git commit -m "chore: add shadcn/ui with core components"
```

---

### Task 1.4: Set Up Supabase

**Step 1:** Install Supabase packages
```bash
npm install @supabase/supabase-js @supabase/ssr
```

**Step 2:** Create `.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Step 3:** Create Supabase client utility

**Create:** `src/lib/supabase/client.ts`
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Create:** `src/lib/supabase/server.ts`
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Handle server component cookie setting
          }
        },
      },
    }
  )
}
```

**Create:** `src/lib/supabase/middleware.ts`
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect dashboard routes
  if (
    !user &&
    (request.nextUrl.pathname.startsWith('/dashboard') ||
      request.nextUrl.pathname.startsWith('/plans'))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect logged-in users away from auth pages
  if (
    user &&
    (request.nextUrl.pathname === '/login' ||
      request.nextUrl.pathname === '/signup')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

**Create:** `src/middleware.ts`
```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Step 4:** Commit
```bash
git add .
git commit -m "chore: configure Supabase client and middleware"
```

---

## Phase 2: Database Setup

### Task 2.1: Create Database Tables in Supabase

Run this SQL in Supabase SQL Editor:

```sql
-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create plans table
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  client_name TEXT,
  total_budget DECIMAL NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  pacing_weights JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create plan_channels table
CREATE TABLE plan_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  channel_type TEXT NOT NULL,
  platform TEXT,
  objective TEXT,
  budget DECIMAL NOT NULL,
  inputs JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_channels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for plans
CREATE POLICY "Users can view own plans"
  ON plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own plans"
  ON plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plans"
  ON plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own plans"
  ON plans FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for plan_channels
CREATE POLICY "Users can view own plan channels"
  ON plan_channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plans
      WHERE plans.id = plan_channels.plan_id
      AND plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create plan channels for own plans"
  ON plan_channels FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plans
      WHERE plans.id = plan_channels.plan_id
      AND plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own plan channels"
  ON plan_channels FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM plans
      WHERE plans.id = plan_channels.plan_id
      AND plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own plan channels"
  ON plan_channels FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM plans
      WHERE plans.id = plan_channels.plan_id
      AND plans.user_id = auth.uid()
    )
  );

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for plans updated_at
CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

### Task 2.2: Create TypeScript Types

**Create:** `src/types/database.ts`
```typescript
export type Profile = {
  id: string
  first_name: string
  last_name: string
  created_at: string
}

export type Plan = {
  id: string
  user_id: string
  name: string
  client_name: string | null
  total_budget: number
  start_date: string
  end_date: string
  pacing_weights: Record<string, number>
  created_at: string
  updated_at: string
}

export type ChannelType = 'search' | 'social' | 'display' | 'video' | 'programmatic'

export type SocialPlatform = 'meta' | 'tiktok' | 'linkedin' | 'twitter' | 'pinterest' | 'snapchat'

export type SocialObjective =
  | 'awareness'
  | 'video_views'
  | 'website_visits'
  | 'engagements'
  | 'website_conversions'
  | 'lead_generation'

export type ChannelInputs = {
  cpm?: number
  cpc?: number
  cpv?: number
  cpe?: number
  ctr?: number
  frequency?: number
  conversion_rate?: number
  form_completion_rate?: number
}

export type PlanChannel = {
  id: string
  plan_id: string
  channel_type: ChannelType
  platform: SocialPlatform | null
  objective: SocialObjective | null
  budget: number
  inputs: ChannelInputs
  created_at: string
}

export type PlanWithChannels = Plan & {
  plan_channels: PlanChannel[]
}
```

**Step:** Commit
```bash
git add .
git commit -m "feat: add database types"
```

---

## Phase 3: Authentication

### Task 3.1: Create Auth Actions

**Create:** `src/lib/actions/auth.ts`
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        first_name: formData.get('firstName') as string,
        last_name: formData.get('lastName') as string,
      },
    },
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()

  const password = formData.get('password') as string

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}
```

**Step:** Commit
```bash
git add .
git commit -m "feat: add auth server actions"
```

---

### Task 3.2: Create Landing Page

**Modify:** `src/app/page.tsx`
```typescript
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-bold">Media Plan Generator</h1>
        <p className="text-xl text-muted-foreground">
          Create professional media plans with budget allocation, pacing, and
          forecasts. Download as Excel in seconds.
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/signup">Get Started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Login</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
```

**Step:** Commit
```bash
git add .
git commit -m "feat: add landing page"
```

---

### Task 3.3: Create Signup Page

**Create:** `src/app/signup/page.tsx`
```typescript
import Link from 'next/link'
import { SignUpForm } from './signup-form'

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Create an account</h1>
          <p className="text-muted-foreground">Enter your details to get started</p>
        </div>
        <SignUpForm />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="underline">
            Login
          </Link>
        </p>
      </div>
    </main>
  )
}
```

**Create:** `src/app/signup/signup-form.tsx`
```typescript
'use client'

import { useState } from 'react'
import { signUp } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export function SignUpForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await signUp(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" name="firstName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" name="lastName" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required minLength={6} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

**Step:** Commit
```bash
git add .
git commit -m "feat: add signup page"
```

---

### Task 3.4: Create Login Page

**Create:** `src/app/login/page.tsx`
```typescript
import Link from 'next/link'
import { LoginForm } from './login-form'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground">Enter your credentials to continue</p>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  )
}
```

**Create:** `src/app/login/login-form.tsx`
```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signIn } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await signIn(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-sm underline">
                Forgot password?
              </Link>
            </div>
            <Input id="password" name="password" type="password" required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

**Step:** Commit
```bash
git add .
git commit -m "feat: add login page"
```

---

### Task 3.5: Create Password Reset Pages

**Create:** `src/app/forgot-password/page.tsx`
```typescript
import Link from 'next/link'
import { ForgotPasswordForm } from './forgot-password-form'

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Reset password</h1>
          <p className="text-muted-foreground">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>
        <ForgotPasswordForm />
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="underline">
            Back to login
          </Link>
        </p>
      </div>
    </main>
  )
}
```

**Create:** `src/app/forgot-password/forgot-password-form.tsx`
```typescript
'use client'

import { useState } from 'react'
import { resetPassword } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await resetPassword(formData)
    if (result?.error) {
      setError(result.error)
    } else if (result?.success) {
      setSuccess(true)
    }
    setLoading(false)
  }

  if (success) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-sm">
            Check your email for a password reset link.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

**Create:** `src/app/reset-password/page.tsx`
```typescript
import { ResetPasswordForm } from './reset-password-form'

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Set new password</h1>
          <p className="text-muted-foreground">Enter your new password below</p>
        </div>
        <ResetPasswordForm />
      </div>
    </main>
  )
}
```

**Create:** `src/app/reset-password/reset-password-form.tsx`
```typescript
'use client'

import { useState } from 'react'
import { updatePassword } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export function ResetPasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await updatePassword(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input id="password" name="password" type="password" required minLength={6} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Updating...' : 'Update password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

**Step:** Commit
```bash
git add .
git commit -m "feat: add password reset pages"
```

---

## Phase 4: Dashboard

### Task 4.1: Create Dashboard Layout

**Create:** `src/app/(protected)/layout.tsx`
```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/header'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} profile={profile} />
      <main className="flex-1 container py-8">{children}</main>
    </div>
  )
}
```

**Create:** `src/components/header.tsx`
```typescript
'use client'

import Link from 'next/link'
import { User } from '@supabase/supabase-js'
import { Profile } from '@/types/database'
import { signOut } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type HeaderProps = {
  user: User
  profile: Profile | null
}

export function Header({ profile }: HeaderProps) {
  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : 'User'

  return (
    <header className="border-b">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/dashboard" className="font-bold text-xl">
          Media Plan Generator
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost">{displayName}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <form action={signOut}>
                <button type="submit" className="w-full text-left">
                  Logout
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
```

**Step:** Commit
```bash
git add .
git commit -m "feat: add protected layout with header"
```

---

### Task 4.2: Create Dashboard Page

**Create:** `src/app/(protected)/dashboard/page.tsx`
```typescript
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { PlansList } from './plans-list'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: plans } = await supabase
    .from('plans')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Media Plans</h1>
        <Button asChild>
          <Link href="/plans/new">+ New Plan</Link>
        </Button>
      </div>
      <PlansList plans={plans || []} />
    </div>
  )
}
```

**Create:** `src/app/(protected)/dashboard/plans-list.tsx`
```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plan } from '@/types/database'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { PlanActions } from './plan-actions'

type PlansListProps = {
  plans: Plan[]
}

export function PlansList({ plans }: PlansListProps) {
  const [search, setSearch] = useState('')

  const filteredPlans = plans.filter(
    (plan) =>
      plan.name.toLowerCase().includes(search.toLowerCase()) ||
      plan.client_name?.toLowerCase().includes(search.toLowerCase())
  )

  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No plans yet. Create your first media plan!</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by plan name or client..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <div className="border rounded-lg">
        <table className="w-full">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium">Plan Name</th>
              <th className="text-left p-4 font-medium">Client</th>
              <th className="text-left p-4 font-medium">Dates</th>
              <th className="text-left p-4 font-medium">Budget</th>
              <th className="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlans.map((plan) => (
              <tr key={plan.id} className="border-b last:border-0">
                <td className="p-4">
                  <Link href={`/plans/${plan.id}`} className="hover:underline font-medium">
                    {plan.name}
                  </Link>
                </td>
                <td className="p-4 text-muted-foreground">{plan.client_name || '-'}</td>
                <td className="p-4 text-muted-foreground">
                  {new Date(plan.start_date).toLocaleDateString()} -{' '}
                  {new Date(plan.end_date).toLocaleDateString()}
                </td>
                <td className="p-4">${plan.total_budget.toLocaleString()}</td>
                <td className="p-4 text-right">
                  <PlanActions plan={plan} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**Create:** `src/app/(protected)/dashboard/plan-actions.tsx`
```typescript
'use client'

import { useRouter } from 'next/navigation'
import { Plan } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type PlanActionsProps = {
  plan: Plan
}

export function PlanActions({ plan }: PlanActionsProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleDuplicate() {
    const { data: original } = await supabase
      .from('plans')
      .select('*, plan_channels(*)')
      .eq('id', plan.id)
      .single()

    if (!original) return

    const { data: newPlan } = await supabase
      .from('plans')
      .insert({
        user_id: original.user_id,
        name: `${original.name} (Copy)`,
        client_name: original.client_name,
        total_budget: original.total_budget,
        start_date: original.start_date,
        end_date: original.end_date,
        pacing_weights: original.pacing_weights,
      })
      .select()
      .single()

    if (newPlan && original.plan_channels.length > 0) {
      await supabase.from('plan_channels').insert(
        original.plan_channels.map((ch: any) => ({
          plan_id: newPlan.id,
          channel_type: ch.channel_type,
          platform: ch.platform,
          objective: ch.objective,
          budget: ch.budget,
          inputs: ch.inputs,
        }))
      )
    }

    router.refresh()
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this plan?')) return
    await supabase.from('plans').delete().eq('id', plan.id)
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          •••
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/plans/${plan.id}`)}>
          View
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/plans/${plan.id}/edit`)}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDuplicate}>Duplicate</DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open(`/api/plans/${plan.id}/export`, '_blank')}>
          Download Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDelete} className="text-destructive">
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Step:** Commit
```bash
git add .
git commit -m "feat: add dashboard with plans list"
```

---

## Phase 5: Plan Creation Wizard

### Task 5.1: Create Plan Form Components

**Create:** `src/lib/actions/plans.ts`
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PlanChannel } from '@/types/database'

export type PlanFormData = {
  name: string
  client_name: string
  total_budget: number
  start_date: string
  end_date: string
  pacing_weights: Record<string, number>
  channels: Omit<PlanChannel, 'id' | 'plan_id' | 'created_at'>[]
}

export async function createPlan(data: PlanFormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: plan, error: planError } = await supabase
    .from('plans')
    .insert({
      user_id: user.id,
      name: data.name,
      client_name: data.client_name || null,
      total_budget: data.total_budget,
      start_date: data.start_date,
      end_date: data.end_date,
      pacing_weights: data.pacing_weights,
    })
    .select()
    .single()

  if (planError) {
    return { error: planError.message }
  }

  if (data.channels.length > 0) {
    const { error: channelsError } = await supabase.from('plan_channels').insert(
      data.channels.map((ch) => ({
        plan_id: plan.id,
        channel_type: ch.channel_type,
        platform: ch.platform,
        objective: ch.objective,
        budget: ch.budget,
        inputs: ch.inputs,
      }))
    )

    if (channelsError) {
      return { error: channelsError.message }
    }
  }

  redirect(`/plans/${plan.id}`)
}

export async function updatePlan(planId: string, data: PlanFormData) {
  const supabase = await createClient()

  const { error: planError } = await supabase
    .from('plans')
    .update({
      name: data.name,
      client_name: data.client_name || null,
      total_budget: data.total_budget,
      start_date: data.start_date,
      end_date: data.end_date,
      pacing_weights: data.pacing_weights,
    })
    .eq('id', planId)

  if (planError) {
    return { error: planError.message }
  }

  // Delete existing channels and recreate
  await supabase.from('plan_channels').delete().eq('plan_id', planId)

  if (data.channels.length > 0) {
    const { error: channelsError } = await supabase.from('plan_channels').insert(
      data.channels.map((ch) => ({
        plan_id: planId,
        channel_type: ch.channel_type,
        platform: ch.platform,
        objective: ch.objective,
        budget: ch.budget,
        inputs: ch.inputs,
      }))
    )

    if (channelsError) {
      return { error: channelsError.message }
    }
  }

  redirect(`/plans/${planId}`)
}
```

**Step:** Commit
```bash
git add .
git commit -m "feat: add plan server actions"
```

---

### Task 5.2: Create New Plan Page

**Create:** `src/app/(protected)/plans/new/page.tsx`
```typescript
import { PlanWizard } from '@/components/plan-wizard/plan-wizard'

export default function NewPlanPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Create New Plan</h1>
      <PlanWizard />
    </div>
  )
}
```

**Create:** `src/components/plan-wizard/plan-wizard.tsx`
```typescript
'use client'

import { useState } from 'react'
import { PlanFormData, createPlan, updatePlan } from '@/lib/actions/plans'
import { PlanWithChannels, PlanChannel } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StepDetails } from './step-details'
import { StepPacing } from './step-pacing'
import { StepChannels } from './step-channels'
import { StepReview } from './step-review'

type PlanWizardProps = {
  existingPlan?: PlanWithChannels
}

const STEPS = ['Details', 'Pacing', 'Channels', 'Review']

export function PlanWizard({ existingPlan }: PlanWizardProps) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<PlanFormData>({
    name: existingPlan?.name || '',
    client_name: existingPlan?.client_name || '',
    total_budget: existingPlan?.total_budget || 0,
    start_date: existingPlan?.start_date || '',
    end_date: existingPlan?.end_date || '',
    pacing_weights: existingPlan?.pacing_weights || {},
    channels: existingPlan?.plan_channels.map((ch) => ({
      channel_type: ch.channel_type,
      platform: ch.platform,
      objective: ch.objective,
      budget: ch.budget,
      inputs: ch.inputs,
    })) || [],
  })

  function updateFormData(updates: Partial<PlanFormData>) {
    setFormData((prev) => ({ ...prev, ...updates }))
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    const result = existingPlan
      ? await updatePlan(existingPlan.id, formData)
      : await createPlan(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex-1 h-2 rounded ${
              i <= step ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 0 && (
            <StepDetails formData={formData} updateFormData={updateFormData} />
          )}
          {step === 1 && (
            <StepPacing formData={formData} updateFormData={updateFormData} />
          )}
          {step === 2 && (
            <StepChannels formData={formData} updateFormData={updateFormData} />
          )}
          {step === 3 && <StepReview formData={formData} />}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : existingPlan ? 'Update Plan' : 'Create Plan'}
          </Button>
        )}
      </div>
    </div>
  )
}
```

**Step:** Commit
```bash
git add .
git commit -m "feat: add plan wizard shell"
```

---

### Task 5.3: Create Step Components

**Create:** `src/components/plan-wizard/step-details.tsx`
```typescript
'use client'

import { PlanFormData } from '@/lib/actions/plans'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type StepDetailsProps = {
  formData: PlanFormData
  updateFormData: (updates: Partial<PlanFormData>) => void
}

export function StepDetails({ formData, updateFormData }: StepDetailsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Plan Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => updateFormData({ name: e.target.value })}
          placeholder="e.g., Q1 Brand Campaign"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="client_name">Client Name</Label>
        <Input
          id="client_name"
          value={formData.client_name}
          onChange={(e) => updateFormData({ client_name: e.target.value })}
          placeholder="e.g., Acme Corp"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="total_budget">Total Budget ($) *</Label>
        <Input
          id="total_budget"
          type="number"
          min={0}
          value={formData.total_budget || ''}
          onChange={(e) => updateFormData({ total_budget: parseFloat(e.target.value) || 0 })}
          placeholder="e.g., 50000"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_date">Start Date *</Label>
          <Input
            id="start_date"
            type="date"
            value={formData.start_date}
            onChange={(e) => updateFormData({ start_date: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">End Date *</Label>
          <Input
            id="end_date"
            type="date"
            value={formData.end_date}
            onChange={(e) => updateFormData({ end_date: e.target.value })}
            required
          />
        </div>
      </div>
    </div>
  )
}
```

**Create:** `src/components/plan-wizard/step-pacing.tsx`
```typescript
'use client'

import { useEffect } from 'react'
import { PlanFormData } from '@/lib/actions/plans'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type StepPacingProps = {
  formData: PlanFormData
  updateFormData: (updates: Partial<PlanFormData>) => void
}

function getWeeksBetween(start: string, end: string): string[] {
  if (!start || !end) return []

  const weeks: string[] = []
  const startDate = new Date(start)
  const endDate = new Date(end)

  let current = new Date(startDate)
  let weekNum = 1

  while (current <= endDate) {
    weeks.push(`week_${weekNum}`)
    current.setDate(current.getDate() + 7)
    weekNum++
  }

  return weeks
}

export function StepPacing({ formData, updateFormData }: StepPacingProps) {
  const weeks = getWeeksBetween(formData.start_date, formData.end_date)

  useEffect(() => {
    // Initialize pacing weights if not set
    if (weeks.length > 0 && Object.keys(formData.pacing_weights).length === 0) {
      const evenWeight = Math.floor(100 / weeks.length)
      const remainder = 100 - evenWeight * weeks.length

      const weights: Record<string, number> = {}
      weeks.forEach((week, i) => {
        weights[week] = evenWeight + (i === weeks.length - 1 ? remainder : 0)
      })

      updateFormData({ pacing_weights: weights })
    }
  }, [weeks.length])

  const total = Object.values(formData.pacing_weights).reduce((sum, w) => sum + w, 0)

  function handleWeightChange(week: string, value: number) {
    updateFormData({
      pacing_weights: {
        ...formData.pacing_weights,
        [week]: value,
      },
    })
  }

  if (weeks.length === 0) {
    return (
      <p className="text-muted-foreground">
        Please set campaign dates first to configure pacing.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter the percentage of budget to allocate to each week. Total must equal 100%.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {weeks.map((week, i) => (
          <div key={week} className="space-y-2">
            <Label htmlFor={week}>Week {i + 1} (%)</Label>
            <Input
              id={week}
              type="number"
              min={0}
              max={100}
              value={formData.pacing_weights[week] || 0}
              onChange={(e) => handleWeightChange(week, parseFloat(e.target.value) || 0)}
            />
          </div>
        ))}
      </div>
      <p className={`text-sm ${total === 100 ? 'text-green-600' : 'text-destructive'}`}>
        Total: {total}% {total !== 100 && '(must equal 100%)'}
      </p>
    </div>
  )
}
```

**Create:** `src/components/plan-wizard/step-channels.tsx`
```typescript
'use client'

import { PlanFormData } from '@/lib/actions/plans'
import { ChannelType, SocialPlatform, SocialObjective, ChannelInputs } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type StepChannelsProps = {
  formData: PlanFormData
  updateFormData: (updates: Partial<PlanFormData>) => void
}

const CHANNEL_TYPES: { value: ChannelType; label: string }[] = [
  { value: 'search', label: 'Search' },
  { value: 'display', label: 'Display' },
  { value: 'video', label: 'Video (YouTube/OLV)' },
  { value: 'programmatic', label: 'Programmatic' },
  { value: 'social', label: 'Social Media' },
]

const SOCIAL_PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: 'meta', label: 'Meta (Facebook/Instagram)' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'Twitter/X' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'snapchat', label: 'Snapchat' },
]

const SOCIAL_OBJECTIVES: { value: SocialObjective; label: string }[] = [
  { value: 'awareness', label: 'Awareness/Reach' },
  { value: 'video_views', label: 'Video Views' },
  { value: 'website_visits', label: 'Website Visits' },
  { value: 'engagements', label: 'Engagements' },
  { value: 'website_conversions', label: 'Website Conversions' },
  { value: 'lead_generation', label: 'Lead Generation' },
]

type Channel = PlanFormData['channels'][0]

export function StepChannels({ formData, updateFormData }: StepChannelsProps) {
  function addChannel(type: ChannelType) {
    const newChannel: Channel = {
      channel_type: type,
      platform: null,
      objective: null,
      budget: 0,
      inputs: {},
    }
    updateFormData({ channels: [...formData.channels, newChannel] })
  }

  function updateChannel(index: number, updates: Partial<Channel>) {
    const updated = [...formData.channels]
    updated[index] = { ...updated[index], ...updates }
    updateFormData({ channels: updated })
  }

  function removeChannel(index: number) {
    updateFormData({ channels: formData.channels.filter((_, i) => i !== index) })
  }

  function getInputFields(channel: Channel): { key: keyof ChannelInputs; label: string }[] {
    if (channel.channel_type === 'search') {
      return [
        { key: 'cpc', label: 'CPC ($)' },
        { key: 'ctr', label: 'CTR (%)' },
      ]
    }
    if (channel.channel_type === 'display' || channel.channel_type === 'programmatic') {
      return [
        { key: 'cpm', label: 'CPM ($)' },
        { key: 'ctr', label: 'CTR (%)' },
        { key: 'frequency', label: 'Frequency' },
      ]
    }
    if (channel.channel_type === 'video') {
      return [{ key: 'cpv', label: 'CPV ($)' }]
    }
    if (channel.channel_type === 'social') {
      switch (channel.objective) {
        case 'awareness':
          return [
            { key: 'cpm', label: 'CPM ($)' },
            { key: 'frequency', label: 'Frequency' },
          ]
        case 'video_views':
          return [{ key: 'cpv', label: 'CPV ($)' }]
        case 'website_visits':
          return [
            { key: 'cpc', label: 'CPC ($)' },
            { key: 'ctr', label: 'CTR (%)' },
          ]
        case 'engagements':
          return [{ key: 'cpe', label: 'CPE ($)' }]
        case 'website_conversions':
          return [
            { key: 'cpc', label: 'CPC ($)' },
            { key: 'ctr', label: 'CTR (%)' },
            { key: 'conversion_rate', label: 'Conversion Rate (%)' },
          ]
        case 'lead_generation':
          return [
            { key: 'cpc', label: 'CPC ($)' },
            { key: 'ctr', label: 'CTR (%)' },
            { key: 'form_completion_rate', label: 'Form Completion Rate (%)' },
          ]
        default:
          return []
      }
    }
    return []
  }

  const allocatedBudget = formData.channels.reduce((sum, ch) => sum + ch.budget, 0)
  const remainingBudget = formData.total_budget - allocatedBudget

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {CHANNEL_TYPES.map((type) => (
          <Button
            key={type.value}
            variant="outline"
            size="sm"
            onClick={() => addChannel(type.value)}
          >
            + {type.label}
          </Button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Budget: ${allocatedBudget.toLocaleString()} / ${formData.total_budget.toLocaleString()} allocated
        {remainingBudget !== 0 && (
          <span className={remainingBudget > 0 ? 'text-yellow-600' : 'text-destructive'}>
            {' '}(${Math.abs(remainingBudget).toLocaleString()} {remainingBudget > 0 ? 'remaining' : 'over'})
          </span>
        )}
      </p>

      {formData.channels.map((channel, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-lg">
              {CHANNEL_TYPES.find((t) => t.value === channel.channel_type)?.label}
              {channel.platform && ` - ${SOCIAL_PLATFORMS.find((p) => p.value === channel.platform)?.label}`}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => removeChannel(index)}>
              Remove
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {channel.channel_type === 'social' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select
                    value={channel.platform || ''}
                    onValueChange={(v) => updateChannel(index, { platform: v as SocialPlatform, objective: null, inputs: {} })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {SOCIAL_PLATFORMS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Objective</Label>
                  <Select
                    value={channel.objective || ''}
                    onValueChange={(v) => updateChannel(index, { objective: v as SocialObjective, inputs: {} })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select objective" />
                    </SelectTrigger>
                    <SelectContent>
                      {SOCIAL_OBJECTIVES.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Budget ($)</Label>
              <Input
                type="number"
                min={0}
                value={channel.budget || ''}
                onChange={(e) => updateChannel(index, { budget: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {getInputFields(channel).map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label>{field.label}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={channel.inputs[field.key] || ''}
                    onChange={(e) =>
                      updateChannel(index, {
                        inputs: { ...channel.inputs, [field.key]: parseFloat(e.target.value) || 0 },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {formData.channels.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          Add channels using the buttons above
        </p>
      )}
    </div>
  )
}
```

**Step:** Commit
```bash
git add .
git commit -m "feat: add plan wizard step components (details, pacing, channels)"
```

---

### Task 5.4: Create Calculations and Review Step

**Create:** `src/lib/calculations.ts`
```typescript
import { PlanFormData } from '@/lib/actions/plans'
import { ChannelType, SocialObjective } from '@/types/database'

export type ChannelMetrics = {
  impressions: number
  clicks: number
  reach: number
  views: number
  engagements: number
  conversions: number
  leads: number
}

export type ScenarioMetrics = {
  aggressive: ChannelMetrics
  moderate: ChannelMetrics
  conservative: ChannelMetrics
}

export type ChannelResult = {
  channel_type: ChannelType
  platform: string | null
  objective: SocialObjective | null
  budget: number
  inputs: Record<string, number>
  metrics: ScenarioMetrics
}

export type PacingResult = {
  period: string
  weight: number
  channels: {
    channel_type: ChannelType
    platform: string | null
    budget: number
    metrics: ScenarioMetrics
  }[]
}

function calculateBaseMetrics(
  channelType: ChannelType,
  objective: SocialObjective | null,
  budget: number,
  inputs: Record<string, number>
): ChannelMetrics {
  const metrics: ChannelMetrics = {
    impressions: 0,
    clicks: 0,
    reach: 0,
    views: 0,
    engagements: 0,
    conversions: 0,
    leads: 0,
  }

  if (channelType === 'search') {
    const cpc = inputs.cpc || 0
    const ctr = (inputs.ctr || 0) / 100
    if (cpc > 0) {
      metrics.clicks = budget / cpc
      if (ctr > 0) {
        metrics.impressions = metrics.clicks / ctr
      }
    }
  }

  if (channelType === 'display' || channelType === 'programmatic') {
    const cpm = inputs.cpm || 0
    const ctr = (inputs.ctr || 0) / 100
    const frequency = inputs.frequency || 1
    if (cpm > 0) {
      metrics.impressions = (budget / cpm) * 1000
      metrics.clicks = metrics.impressions * ctr
      metrics.reach = metrics.impressions / frequency
    }
  }

  if (channelType === 'video') {
    const cpv = inputs.cpv || 0
    if (cpv > 0) {
      metrics.views = budget / cpv
    }
  }

  if (channelType === 'social') {
    switch (objective) {
      case 'awareness': {
        const cpm = inputs.cpm || 0
        const frequency = inputs.frequency || 1
        if (cpm > 0) {
          metrics.impressions = (budget / cpm) * 1000
          metrics.reach = metrics.impressions / frequency
        }
        break
      }
      case 'video_views': {
        const cpv = inputs.cpv || 0
        if (cpv > 0) {
          metrics.views = budget / cpv
        }
        break
      }
      case 'website_visits': {
        const cpc = inputs.cpc || 0
        const ctr = (inputs.ctr || 0) / 100
        if (cpc > 0) {
          metrics.clicks = budget / cpc
          if (ctr > 0) {
            metrics.impressions = metrics.clicks / ctr
          }
        }
        break
      }
      case 'engagements': {
        const cpe = inputs.cpe || 0
        if (cpe > 0) {
          metrics.engagements = budget / cpe
        }
        break
      }
      case 'website_conversions': {
        const cpc = inputs.cpc || 0
        const ctr = (inputs.ctr || 0) / 100
        const convRate = (inputs.conversion_rate || 0) / 100
        if (cpc > 0) {
          metrics.clicks = budget / cpc
          if (ctr > 0) {
            metrics.impressions = metrics.clicks / ctr
          }
          metrics.conversions = metrics.clicks * convRate
        }
        break
      }
      case 'lead_generation': {
        const cpc = inputs.cpc || 0
        const ctr = (inputs.ctr || 0) / 100
        const formRate = (inputs.form_completion_rate || 0) / 100
        if (cpc > 0) {
          metrics.clicks = budget / cpc
          if (ctr > 0) {
            metrics.impressions = metrics.clicks / ctr
          }
          metrics.leads = metrics.clicks * formRate
        }
        break
      }
    }
  }

  return metrics
}

function applyScenario(metrics: ChannelMetrics, multiplier: number): ChannelMetrics {
  return {
    impressions: Math.round(metrics.impressions * multiplier),
    clicks: Math.round(metrics.clicks * multiplier),
    reach: Math.round(metrics.reach * multiplier),
    views: Math.round(metrics.views * multiplier),
    engagements: Math.round(metrics.engagements * multiplier),
    conversions: Math.round(metrics.conversions * multiplier),
    leads: Math.round(metrics.leads * multiplier),
  }
}

export function calculatePlanMetrics(formData: PlanFormData): ChannelResult[] {
  return formData.channels.map((channel) => {
    const baseMetrics = calculateBaseMetrics(
      channel.channel_type,
      channel.objective,
      channel.budget,
      channel.inputs
    )

    return {
      channel_type: channel.channel_type,
      platform: channel.platform,
      objective: channel.objective,
      budget: channel.budget,
      inputs: channel.inputs,
      metrics: {
        aggressive: applyScenario(baseMetrics, 1.2),
        moderate: applyScenario(baseMetrics, 1.0),
        conservative: applyScenario(baseMetrics, 0.9),
      },
    }
  })
}

export function calculatePacingMetrics(formData: PlanFormData): PacingResult[] {
  const channelResults = calculatePlanMetrics(formData)
  const periods = Object.entries(formData.pacing_weights).sort(([a], [b]) => {
    const numA = parseInt(a.split('_')[1])
    const numB = parseInt(b.split('_')[1])
    return numA - numB
  })

  return periods.map(([period, weight]) => ({
    period,
    weight,
    channels: channelResults.map((ch) => ({
      channel_type: ch.channel_type,
      platform: ch.platform,
      budget: ch.budget * (weight / 100),
      metrics: {
        aggressive: applyScenario(ch.metrics.aggressive, weight / 100),
        moderate: applyScenario(ch.metrics.moderate, weight / 100),
        conservative: applyScenario(ch.metrics.conservative, weight / 100),
      },
    })),
  }))
}
```

**Create:** `src/components/plan-wizard/step-review.tsx`
```typescript
'use client'

import { PlanFormData } from '@/lib/actions/plans'
import { calculatePlanMetrics, ChannelResult } from '@/lib/calculations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type StepReviewProps = {
  formData: PlanFormData
}

const CHANNEL_LABELS: Record<string, string> = {
  search: 'Search',
  display: 'Display',
  video: 'Video',
  programmatic: 'Programmatic',
  social: 'Social',
}

const PLATFORM_LABELS: Record<string, string> = {
  meta: 'Meta',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  twitter: 'Twitter/X',
  pinterest: 'Pinterest',
  snapchat: 'Snapchat',
}

const OBJECTIVE_LABELS: Record<string, string> = {
  awareness: 'Awareness',
  video_views: 'Video Views',
  website_visits: 'Website Visits',
  engagements: 'Engagements',
  website_conversions: 'Conversions',
  lead_generation: 'Lead Gen',
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

function getChannelLabel(channel: ChannelResult): string {
  let label = CHANNEL_LABELS[channel.channel_type] || channel.channel_type
  if (channel.platform) {
    label += ` - ${PLATFORM_LABELS[channel.platform] || channel.platform}`
  }
  if (channel.objective) {
    label += ` (${OBJECTIVE_LABELS[channel.objective] || channel.objective})`
  }
  return label
}

function getRelevantMetrics(channel: ChannelResult): { label: string; key: string }[] {
  const base = [{ label: 'Impressions', key: 'impressions' }]

  if (channel.channel_type === 'search' ||
      channel.objective === 'website_visits' ||
      channel.objective === 'website_conversions' ||
      channel.objective === 'lead_generation') {
    base.push({ label: 'Clicks', key: 'clicks' })
  }

  if (channel.channel_type === 'display' ||
      channel.channel_type === 'programmatic' ||
      channel.objective === 'awareness') {
    base.push({ label: 'Reach', key: 'reach' })
  }

  if (channel.channel_type === 'video' || channel.objective === 'video_views') {
    return [{ label: 'Views', key: 'views' }]
  }

  if (channel.objective === 'engagements') {
    return [{ label: 'Engagements', key: 'engagements' }]
  }

  if (channel.objective === 'website_conversions') {
    base.push({ label: 'Conversions', key: 'conversions' })
  }

  if (channel.objective === 'lead_generation') {
    base.push({ label: 'Leads', key: 'leads' })
  }

  return base
}

export function StepReview({ formData }: StepReviewProps) {
  const results = calculatePlanMetrics(formData)

  return (
    <div className="space-y-6">
      {/* Plan Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Plan Name</dt>
              <dd className="font-medium">{formData.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Client</dt>
              <dd className="font-medium">{formData.client_name || '-'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Flight Dates</dt>
              <dd className="font-medium">
                {formData.start_date} to {formData.end_date}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total Budget</dt>
              <dd className="font-medium">${formData.total_budget.toLocaleString()}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Assumptions */}
      <Card>
        <CardHeader>
          <CardTitle>Assumptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {results.map((channel, i) => (
              <div key={i} className="text-sm">
                <p className="font-medium">{getChannelLabel(channel)}</p>
                <p className="text-muted-foreground">
                  Budget: ${channel.budget.toLocaleString()} |{' '}
                  {Object.entries(channel.inputs)
                    .filter(([, v]) => v > 0)
                    .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
                    .join(' | ')}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Results by Scenario */}
      <Card>
        <CardHeader>
          <CardTitle>Forecasted Results</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="moderate">
            <TabsList>
              <TabsTrigger value="aggressive">Aggressive (+20%)</TabsTrigger>
              <TabsTrigger value="moderate">Moderate</TabsTrigger>
              <TabsTrigger value="conservative">Conservative (-10%)</TabsTrigger>
            </TabsList>
            {(['aggressive', 'moderate', 'conservative'] as const).map((scenario) => (
              <TabsContent key={scenario} value={scenario}>
                <div className="border rounded-lg mt-4">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="text-left p-3">Channel</th>
                        <th className="text-right p-3">Budget</th>
                        <th className="text-right p-3">Key Metrics</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((channel, i) => {
                        const metrics = getRelevantMetrics(channel)
                        return (
                          <tr key={i} className="border-b last:border-0">
                            <td className="p-3">{getChannelLabel(channel)}</td>
                            <td className="text-right p-3">${channel.budget.toLocaleString()}</td>
                            <td className="text-right p-3">
                              {metrics.map((m) => (
                                <span key={m.key} className="ml-4">
                                  {m.label}: {formatNumber((channel.metrics[scenario] as any)[m.key])}
                                </span>
                              ))}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step:** Commit
```bash
git add .
git commit -m "feat: add calculations and review step"
```

---

## Phase 6: Plan View & Edit

### Task 6.1: Create Plan View Page

**Create:** `src/app/(protected)/plans/[id]/page.tsx`
```typescript
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PlanWithChannels } from '@/types/database'
import { calculatePlanMetrics } from '@/lib/calculations'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const CHANNEL_LABELS: Record<string, string> = {
  search: 'Search',
  display: 'Display',
  video: 'Video',
  programmatic: 'Programmatic',
  social: 'Social',
}

const PLATFORM_LABELS: Record<string, string> = {
  meta: 'Meta',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  twitter: 'Twitter/X',
  pinterest: 'Pinterest',
  snapchat: 'Snapchat',
}

const OBJECTIVE_LABELS: Record<string, string> = {
  awareness: 'Awareness',
  video_views: 'Video Views',
  website_visits: 'Website Visits',
  engagements: 'Engagements',
  website_conversions: 'Conversions',
  lead_generation: 'Lead Gen',
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

export default async function PlanViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: plan } = await supabase
    .from('plans')
    .select('*, plan_channels(*)')
    .eq('id', id)
    .single()

  if (!plan) {
    notFound()
  }

  const typedPlan = plan as PlanWithChannels

  const formData = {
    name: typedPlan.name,
    client_name: typedPlan.client_name || '',
    total_budget: typedPlan.total_budget,
    start_date: typedPlan.start_date,
    end_date: typedPlan.end_date,
    pacing_weights: typedPlan.pacing_weights,
    channels: typedPlan.plan_channels.map((ch) => ({
      channel_type: ch.channel_type,
      platform: ch.platform,
      objective: ch.objective,
      budget: ch.budget,
      inputs: ch.inputs,
    })),
  }

  const results = calculatePlanMetrics(formData)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{typedPlan.name}</h1>
          {typedPlan.client_name && (
            <p className="text-muted-foreground">{typedPlan.client_name}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/plans/${id}/edit`}>Edit</Link>
          </Button>
          <Button asChild>
            <a href={`/api/plans/${id}/export`} download>
              Download Excel
            </a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Flight Dates</dt>
              <dd className="font-medium">
                {new Date(typedPlan.start_date).toLocaleDateString()} -{' '}
                {new Date(typedPlan.end_date).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total Budget</dt>
              <dd className="font-medium">${typedPlan.total_budget.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Channels</dt>
              <dd className="font-medium">{typedPlan.plan_channels.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium">
                {new Date(typedPlan.created_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Forecasted Results</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="moderate">
            <TabsList>
              <TabsTrigger value="aggressive">Aggressive (+20%)</TabsTrigger>
              <TabsTrigger value="moderate">Moderate</TabsTrigger>
              <TabsTrigger value="conservative">Conservative (-10%)</TabsTrigger>
            </TabsList>
            {(['aggressive', 'moderate', 'conservative'] as const).map((scenario) => (
              <TabsContent key={scenario} value={scenario}>
                <div className="border rounded-lg mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="text-left p-3">Channel</th>
                        <th className="text-right p-3">Budget</th>
                        <th className="text-right p-3">Impressions</th>
                        <th className="text-right p-3">Clicks</th>
                        <th className="text-right p-3">Reach</th>
                        <th className="text-right p-3">Views</th>
                        <th className="text-right p-3">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((channel, i) => {
                        const m = channel.metrics[scenario]
                        let channelLabel = CHANNEL_LABELS[channel.channel_type]
                        if (channel.platform) {
                          channelLabel += ` - ${PLATFORM_LABELS[channel.platform]}`
                        }
                        if (channel.objective) {
                          channelLabel += ` (${OBJECTIVE_LABELS[channel.objective]})`
                        }

                        let result = '-'
                        if (m.conversions > 0) result = `${formatNumber(m.conversions)} conv`
                        else if (m.leads > 0) result = `${formatNumber(m.leads)} leads`
                        else if (m.engagements > 0) result = `${formatNumber(m.engagements)} eng`

                        return (
                          <tr key={i} className="border-b last:border-0">
                            <td className="p-3">{channelLabel}</td>
                            <td className="text-right p-3">${channel.budget.toLocaleString()}</td>
                            <td className="text-right p-3">{m.impressions > 0 ? formatNumber(m.impressions) : '-'}</td>
                            <td className="text-right p-3">{m.clicks > 0 ? formatNumber(m.clicks) : '-'}</td>
                            <td className="text-right p-3">{m.reach > 0 ? formatNumber(m.reach) : '-'}</td>
                            <td className="text-right p-3">{m.views > 0 ? formatNumber(m.views) : '-'}</td>
                            <td className="text-right p-3">{result}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step:** Commit
```bash
git add .
git commit -m "feat: add plan view page"
```

---

### Task 6.2: Create Plan Edit Page

**Create:** `src/app/(protected)/plans/[id]/edit/page.tsx`
```typescript
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PlanWithChannels } from '@/types/database'
import { PlanWizard } from '@/components/plan-wizard/plan-wizard'

export default async function PlanEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: plan } = await supabase
    .from('plans')
    .select('*, plan_channels(*)')
    .eq('id', id)
    .single()

  if (!plan) {
    notFound()
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Edit Plan</h1>
      <PlanWizard existingPlan={plan as PlanWithChannels} />
    </div>
  )
}
```

**Step:** Commit
```bash
git add .
git commit -m "feat: add plan edit page"
```

---

## Phase 7: Excel Export

### Task 7.1: Install ExcelJS and Create Export API

**Step 1:** Install ExcelJS
```bash
npm install exceljs
```

**Create:** `src/app/api/plans/[id]/export/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { PlanWithChannels } from '@/types/database'
import { calculatePlanMetrics, calculatePacingMetrics } from '@/lib/calculations'

const CHANNEL_LABELS: Record<string, string> = {
  search: 'Search',
  display: 'Display',
  video: 'Video',
  programmatic: 'Programmatic',
  social: 'Social',
}

const PLATFORM_LABELS: Record<string, string> = {
  meta: 'Meta',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  twitter: 'Twitter/X',
  pinterest: 'Pinterest',
  snapchat: 'Snapchat',
}

const OBJECTIVE_LABELS: Record<string, string> = {
  awareness: 'Awareness',
  video_views: 'Video Views',
  website_visits: 'Website Visits',
  engagements: 'Engagements',
  website_conversions: 'Conversions',
  lead_generation: 'Lead Gen',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: plan } = await supabase
    .from('plans')
    .select('*, plan_channels(*)')
    .eq('id', id)
    .single()

  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  const typedPlan = plan as PlanWithChannels

  const formData = {
    name: typedPlan.name,
    client_name: typedPlan.client_name || '',
    total_budget: typedPlan.total_budget,
    start_date: typedPlan.start_date,
    end_date: typedPlan.end_date,
    pacing_weights: typedPlan.pacing_weights,
    channels: typedPlan.plan_channels.map((ch) => ({
      channel_type: ch.channel_type,
      platform: ch.platform,
      objective: ch.objective,
      budget: ch.budget,
      inputs: ch.inputs,
    })),
  }

  const results = calculatePlanMetrics(formData)
  const pacingResults = calculatePacingMetrics(formData)

  // Create workbook
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Media Plan Generator'
  workbook.created = new Date()

  // ===== TAB 1: SUMMARY =====
  const summarySheet = workbook.addWorksheet('Summary')

  // Header
  summarySheet.mergeCells('A1:G1')
  summarySheet.getCell('A1').value = `MEDIA PLAN: ${typedPlan.name}`
  summarySheet.getCell('A1').font = { bold: true, size: 16 }

  summarySheet.getCell('A2').value = `Client: ${typedPlan.client_name || '-'}`
  summarySheet.getCell('C2').value = `Flight: ${typedPlan.start_date} to ${typedPlan.end_date}`
  summarySheet.getCell('E2').value = `Total Budget: $${typedPlan.total_budget.toLocaleString()}`
  summarySheet.getCell('A3').value = `Generated: ${new Date().toLocaleDateString()}`

  // Assumptions
  let row = 5
  summarySheet.getCell(`A${row}`).value = 'ASSUMPTIONS'
  summarySheet.getCell(`A${row}`).font = { bold: true }
  row++

  summarySheet.getRow(row).values = ['Channel', 'Objective', 'Budget', 'CPM', 'CPC', 'CPV', 'CTR', 'Frequency', 'Conv Rate', 'Form Rate']
  summarySheet.getRow(row).font = { bold: true }
  summarySheet.getRow(row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }
  row++

  results.forEach((ch) => {
    let channelLabel = CHANNEL_LABELS[ch.channel_type]
    if (ch.platform) channelLabel += ` - ${PLATFORM_LABELS[ch.platform]}`

    summarySheet.getRow(row).values = [
      channelLabel,
      ch.objective ? OBJECTIVE_LABELS[ch.objective] : '-',
      ch.budget,
      ch.inputs.cpm || '-',
      ch.inputs.cpc || '-',
      ch.inputs.cpv || '-',
      ch.inputs.ctr ? `${ch.inputs.ctr}%` : '-',
      ch.inputs.frequency || '-',
      ch.inputs.conversion_rate ? `${ch.inputs.conversion_rate}%` : '-',
      ch.inputs.form_completion_rate ? `${ch.inputs.form_completion_rate}%` : '-',
    ]
    row++
  })

  // Results for each scenario
  const scenarios = [
    { key: 'moderate', label: 'MODERATE SCENARIO (Baseline)' },
    { key: 'aggressive', label: 'AGGRESSIVE SCENARIO (+20%)' },
    { key: 'conservative', label: 'CONSERVATIVE SCENARIO (-10%)' },
  ] as const

  scenarios.forEach((scenario) => {
    row += 2
    summarySheet.getCell(`A${row}`).value = scenario.label
    summarySheet.getCell(`A${row}`).font = { bold: true }
    row++

    summarySheet.getRow(row).values = ['Channel', 'Objective', 'Budget', 'Impressions', 'Clicks', 'Reach', 'Views', 'Result']
    summarySheet.getRow(row).font = { bold: true }
    summarySheet.getRow(row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }
    row++

    results.forEach((ch) => {
      let channelLabel = CHANNEL_LABELS[ch.channel_type]
      if (ch.platform) channelLabel += ` - ${PLATFORM_LABELS[ch.platform]}`

      const m = ch.metrics[scenario.key]
      let result = '-'
      if (m.conversions > 0) result = `${m.conversions} conversions`
      else if (m.leads > 0) result = `${m.leads} leads`
      else if (m.engagements > 0) result = `${m.engagements} engagements`

      summarySheet.getRow(row).values = [
        channelLabel,
        ch.objective ? OBJECTIVE_LABELS[ch.objective] : '-',
        ch.budget,
        m.impressions || '-',
        m.clicks || '-',
        m.reach || '-',
        m.views || '-',
        result,
      ]
      row++
    })
  })

  // Auto-fit columns
  summarySheet.columns.forEach((col) => {
    col.width = 15
  })

  // ===== TAB 2: DETAILED BREAKDOWN =====
  const detailSheet = workbook.addWorksheet('Detailed Breakdown')

  // Header
  detailSheet.mergeCells('A1:H1')
  detailSheet.getCell('A1').value = `MEDIA PLAN: ${typedPlan.name}`
  detailSheet.getCell('A1').font = { bold: true, size: 16 }

  detailSheet.getCell('A2').value = `Client: ${typedPlan.client_name || '-'}`
  detailSheet.getCell('C2').value = `Flight: ${typedPlan.start_date} to ${typedPlan.end_date}`
  detailSheet.getCell('E2').value = `Total Budget: $${typedPlan.total_budget.toLocaleString()}`

  // Pacing weights
  row = 4
  detailSheet.getCell(`A${row}`).value = 'PACING WEIGHTS'
  detailSheet.getCell(`A${row}`).font = { bold: true }
  row++

  const periods = Object.entries(typedPlan.pacing_weights).sort(([a], [b]) => {
    const numA = parseInt(a.split('_')[1])
    const numB = parseInt(b.split('_')[1])
    return numA - numB
  })

  detailSheet.getRow(row).values = periods.map(([p]) => p.replace('_', ' ').toUpperCase())
  row++
  detailSheet.getRow(row).values = periods.map(([, w]) => `${w}%`)

  // Detailed breakdown for each scenario
  scenarios.forEach((scenario) => {
    row += 3
    detailSheet.getCell(`A${row}`).value = scenario.label
    detailSheet.getCell(`A${row}`).font = { bold: true }
    row++

    detailSheet.getRow(row).values = ['Channel', 'Period', 'Budget', 'Impressions', 'Clicks', 'Reach', 'Views', 'Result']
    detailSheet.getRow(row).font = { bold: true }
    detailSheet.getRow(row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }
    row++

    pacingResults.forEach((period) => {
      period.channels.forEach((ch, chIndex) => {
        let channelLabel = CHANNEL_LABELS[ch.channel_type]
        if (ch.platform) channelLabel += ` - ${PLATFORM_LABELS[ch.platform]}`

        const m = ch.metrics[scenario.key]
        const originalCh = results[chIndex]
        let result = '-'
        if (m.conversions > 0) result = `${m.conversions} conv`
        else if (m.leads > 0) result = `${m.leads} leads`
        else if (m.engagements > 0) result = `${m.engagements} eng`

        detailSheet.getRow(row).values = [
          channelLabel,
          period.period.replace('_', ' ').toUpperCase(),
          Math.round(ch.budget),
          m.impressions || '-',
          m.clicks || '-',
          m.reach || '-',
          m.views || '-',
          result,
        ]
        row++
      })
    })

    // Totals
    row++
    detailSheet.getCell(`A${row}`).value = 'TOTALS'
    detailSheet.getCell(`A${row}`).font = { bold: true }
    row++

    results.forEach((ch) => {
      let channelLabel = CHANNEL_LABELS[ch.channel_type]
      if (ch.platform) channelLabel += ` - ${PLATFORM_LABELS[ch.platform]}`

      const m = ch.metrics[scenario.key]
      let result = '-'
      if (m.conversions > 0) result = `${m.conversions} conv`
      else if (m.leads > 0) result = `${m.leads} leads`
      else if (m.engagements > 0) result = `${m.engagements} eng`

      detailSheet.getRow(row).values = [
        channelLabel,
        'TOTAL',
        ch.budget,
        m.impressions || '-',
        m.clicks || '-',
        m.reach || '-',
        m.views || '-',
        result,
      ]
      detailSheet.getRow(row).font = { bold: true }
      row++
    })
  })

  // Auto-fit columns
  detailSheet.columns.forEach((col) => {
    col.width = 15
  })

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()

  // Return as download
  const filename = `${typedPlan.name.replace(/[^a-z0-9]/gi, '_')}_media_plan.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
```

**Step 2:** Commit
```bash
git add .
git commit -m "feat: add Excel export API"
```

---

## Phase 8: Final Touches

### Task 8.1: Add Environment Variable for Site URL

**Update:** `.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Task 8.2: Update Supabase Email Settings

In Supabase Dashboard:
1. Go to Authentication > URL Configuration
2. Set Site URL to your production URL
3. Add localhost:3000 to Redirect URLs for development

### Task 8.3: Test the Application

```bash
npm run dev
```

Test flow:
1. Sign up with email/password
2. Create a new plan
3. Add channels with inputs
4. Review calculations
5. Save plan
6. View plan
7. Download Excel
8. Edit plan
9. Duplicate plan
10. Delete plan

### Task 8.4: Deploy to Vercel

```bash
npx vercel
```

Add environment variables in Vercel dashboard:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_SITE_URL (your Vercel URL)

---

## Summary

**Phases:**
1. Project Setup (git, Next.js, shadcn/ui, Supabase)
2. Database Setup (tables, RLS, triggers)
3. Authentication (signup, login, password reset)
4. Dashboard (layout, plans list, actions)
5. Plan Creation (wizard with 4 steps)
6. Plan View & Edit
7. Excel Export
8. Final Touches (env vars, deploy)

**Total files to create:** ~25
**Estimated tasks:** ~20 commits
