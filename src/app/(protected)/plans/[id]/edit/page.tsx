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
