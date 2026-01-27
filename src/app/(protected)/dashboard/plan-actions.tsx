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
