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
