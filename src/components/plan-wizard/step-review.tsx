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

const INPUT_LABELS: Record<string, { label: string; format: (v: number) => string }> = {
  cpm: { label: 'CPM', format: (v) => `$${v}` },
  cpc: { label: 'CPC', format: (v) => `$${v}` },
  cpv: { label: 'CPV', format: (v) => `$${v}` },
  cpe: { label: 'CPE', format: (v) => `$${v}` },
  ctr: { label: 'CTR', format: (v) => `${v}%` },
  vtr: { label: 'VTR', format: (v) => `${v}%` },
  frequency: { label: 'Frequency', format: (v) => `${v}` },
  conversion_rate: { label: 'Conv. Rate', format: (v) => `${v}%` },
  form_completion_rate: { label: 'Form Rate', format: (v) => `${v}%` },
  engagement_rate: { label: 'Eng. Rate', format: (v) => `${v}%` },
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
                    .map(([k, v]) => {
                      const config = INPUT_LABELS[k]
                      return config ? `${config.label}: ${config.format(v)}` : `${k}: ${v}`
                    })
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
                        <th className="text-right p-3">Cost/Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((channel, i) => {
                        const m = channel.metrics[scenario]

                        let result = '-'
                        if (m.conversions > 0) result = `${formatNumber(m.conversions)} conv`
                        else if (m.leads > 0) result = `${formatNumber(m.leads)} leads`
                        else if (m.engagements > 0) result = `${formatNumber(m.engagements)} eng`

                        return (
                          <tr key={i} className="border-b last:border-0">
                            <td className="p-3">{getChannelLabel(channel)}</td>
                            <td className="text-right p-3">${channel.budget.toLocaleString()}</td>
                            <td className="text-right p-3">{m.impressions > 0 ? formatNumber(m.impressions) : '-'}</td>
                            <td className="text-right p-3">{m.clicks > 0 ? formatNumber(m.clicks) : '-'}</td>
                            <td className="text-right p-3">{m.reach > 0 ? formatNumber(m.reach) : '-'}</td>
                            <td className="text-right p-3">{m.views > 0 ? formatNumber(m.views) : '-'}</td>
                            <td className="text-right p-3">{result}</td>
                            <td className="text-right p-3">
                              {(() => {
                                let resultCount = 0
                                if (m.conversions > 0) resultCount = m.conversions
                                else if (m.leads > 0) resultCount = m.leads
                                else if (m.engagements > 0) resultCount = m.engagements

                                if (resultCount > 0) {
                                  return `$${(channel.budget / resultCount).toFixed(2)}`
                                }
                                return '-'
                              })()}
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
