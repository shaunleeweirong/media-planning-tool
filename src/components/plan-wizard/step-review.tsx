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
