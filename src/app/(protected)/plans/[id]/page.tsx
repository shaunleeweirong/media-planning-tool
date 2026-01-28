import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PlanWithChannels } from '@/types/database'
import { calculatePlanMetrics } from '@/lib/calculations'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

export default async function PlanViewPage({ params }: { params: Promise<{ id: string }> }) {
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

  const typedPlan = plan as PlanWithChannels

  const formData = {
    name: typedPlan.name,
    client_name: typedPlan.client_name || '',
    total_budget: typedPlan.total_budget,
    start_date: typedPlan.start_date,
    end_date: typedPlan.end_date,
    pacing_weights: typedPlan.pacing_weights,
    channels: typedPlan.plan_channels.map((ch) => ({
      channel_type: ch.channel_type,
      platform: ch.platform,
      objective: ch.objective,
      budget: ch.budget,
      inputs: ch.inputs,
    })),
  }

  const results = calculatePlanMetrics(formData)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{typedPlan.name}</h1>
          {typedPlan.client_name && (
            <p className="text-muted-foreground">{typedPlan.client_name}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/plans/${id}/edit`}>Edit</Link>
          </Button>
          <Button asChild>
            <a href={`/api/plans/${id}/export`} download>
              Download Excel
            </a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Flight Dates</dt>
              <dd className="font-medium">
                {new Date(typedPlan.start_date).toLocaleDateString()} -{' '}
                {new Date(typedPlan.end_date).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total Budget</dt>
              <dd className="font-medium">${typedPlan.total_budget.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Channels</dt>
              <dd className="font-medium">{typedPlan.plan_channels.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium">
                {new Date(typedPlan.created_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

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
                        let channelLabel = CHANNEL_LABELS[channel.channel_type]
                        if (channel.platform) {
                          channelLabel += ` - ${PLATFORM_LABELS[channel.platform]}`
                        }
                        if (channel.objective) {
                          channelLabel += ` (${OBJECTIVE_LABELS[channel.objective]})`
                        }

                        // Determine result based on objective
                        let result = '-'
                        let resultCount = 0

                        switch (channel.objective) {
                          case 'video_views':
                            if (m.views > 0) {
                              result = `${formatNumber(m.views)} views`
                              resultCount = m.views
                            }
                            break
                          case 'website_visits':
                            if (m.clicks > 0) {
                              result = `${formatNumber(m.clicks)} clicks`
                              resultCount = m.clicks
                            }
                            break
                          case 'engagements':
                            if (m.engagements > 0) {
                              result = `${formatNumber(m.engagements)} eng`
                              resultCount = m.engagements
                            }
                            break
                          case 'website_conversions':
                            if (m.conversions > 0) {
                              result = `${formatNumber(m.conversions)} conv`
                              resultCount = m.conversions
                            }
                            break
                          case 'lead_generation':
                            if (m.leads > 0) {
                              result = `${formatNumber(m.leads)} leads`
                              resultCount = m.leads
                            }
                            break
                          case 'awareness':
                            if (m.reach > 0) {
                              result = `${formatNumber(m.reach)} reach`
                              resultCount = m.reach
                            }
                            break
                          default:
                            // For non-social channels, infer from channel type
                            if (channel.channel_type === 'video' && m.views > 0) {
                              result = `${formatNumber(m.views)} views`
                              resultCount = m.views
                            } else if (channel.channel_type === 'search' && m.clicks > 0) {
                              result = `${formatNumber(m.clicks)} clicks`
                              resultCount = m.clicks
                            } else if ((channel.channel_type === 'display' || channel.channel_type === 'programmatic') && m.reach > 0) {
                              result = `${formatNumber(m.reach)} reach`
                              resultCount = m.reach
                            }
                        }

                        return (
                          <tr key={i} className="border-b last:border-0">
                            <td className="p-3">{channelLabel}</td>
                            <td className="text-right p-3">${channel.budget.toLocaleString()}</td>
                            <td className="text-right p-3">{m.impressions > 0 ? formatNumber(m.impressions) : '-'}</td>
                            <td className="text-right p-3">{m.clicks > 0 ? formatNumber(m.clicks) : '-'}</td>
                            <td className="text-right p-3">{m.reach > 0 ? formatNumber(m.reach) : '-'}</td>
                            <td className="text-right p-3">{m.views > 0 ? formatNumber(m.views) : '-'}</td>
                            <td className="text-right p-3">{result}</td>
                            <td className="text-right p-3">
                              {resultCount > 0 ? `$${(channel.budget / resultCount).toFixed(2)}` : '-'}
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
