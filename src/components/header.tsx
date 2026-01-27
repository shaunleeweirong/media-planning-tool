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
