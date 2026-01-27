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
