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
