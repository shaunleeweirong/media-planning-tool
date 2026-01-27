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
