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
