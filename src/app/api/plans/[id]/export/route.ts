import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { PlanWithChannels } from '@/types/database'
import { calculatePlanMetrics, calculatePacingMetrics } from '@/lib/calculations'

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: plan } = await supabase
    .from('plans')
    .select('*, plan_channels(*)')
    .eq('id', id)
    .single()

  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
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
  const pacingResults = calculatePacingMetrics(formData)

  // Create workbook
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Media Plan Generator'
  workbook.created = new Date()

  // ===== TAB 1: SUMMARY =====
  const summarySheet = workbook.addWorksheet('Summary')

  // Header
  summarySheet.mergeCells('A1:G1')
  summarySheet.getCell('A1').value = `MEDIA PLAN: ${typedPlan.name}`
  summarySheet.getCell('A1').font = { bold: true, size: 16 }

  summarySheet.getCell('A2').value = `Client: ${typedPlan.client_name || '-'}`
  summarySheet.getCell('C2').value = `Flight: ${typedPlan.start_date} to ${typedPlan.end_date}`
  summarySheet.getCell('E2').value = `Total Budget: $${typedPlan.total_budget.toLocaleString()}`
  summarySheet.getCell('A3').value = `Generated: ${new Date().toLocaleDateString()}`

  // Assumptions
  let row = 5
  summarySheet.getCell(`A${row}`).value = 'ASSUMPTIONS'
  summarySheet.getCell(`A${row}`).font = { bold: true }
  row++

  summarySheet.getRow(row).values = ['Channel', 'Objective', 'Budget', 'CPM', 'CPC', 'CPV', 'CTR', 'VTR', 'Frequency', 'Conv Rate', 'Form Rate', 'Eng Rate']
  summarySheet.getRow(row).font = { bold: true }
  summarySheet.getRow(row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }
  row++

  results.forEach((ch) => {
    let channelLabel = CHANNEL_LABELS[ch.channel_type]
    if (ch.platform) channelLabel += ` - ${PLATFORM_LABELS[ch.platform]}`

    summarySheet.getRow(row).values = [
      channelLabel,
      ch.objective ? OBJECTIVE_LABELS[ch.objective] : '-',
      ch.budget,
      ch.inputs.cpm || '-',
      ch.inputs.cpc || '-',
      ch.inputs.cpv || '-',
      ch.inputs.ctr ? `${ch.inputs.ctr}%` : '-',
      ch.inputs.vtr ? `${ch.inputs.vtr}%` : '-',
      ch.inputs.frequency || '-',
      ch.inputs.conversion_rate ? `${ch.inputs.conversion_rate}%` : '-',
      ch.inputs.form_completion_rate ? `${ch.inputs.form_completion_rate}%` : '-',
      ch.inputs.engagement_rate ? `${ch.inputs.engagement_rate}%` : '-',
    ]
    row++
  })

  // Results for each scenario
  const scenarios = [
    { key: 'moderate', label: 'MODERATE SCENARIO (Baseline)' },
    { key: 'aggressive', label: 'AGGRESSIVE SCENARIO (+20%)' },
    { key: 'conservative', label: 'CONSERVATIVE SCENARIO (-10%)' },
  ] as const

  scenarios.forEach((scenario) => {
    row += 2
    summarySheet.getCell(`A${row}`).value = scenario.label
    summarySheet.getCell(`A${row}`).font = { bold: true }
    row++

    summarySheet.getRow(row).values = ['Channel', 'Objective', 'Budget', 'Impressions', 'Clicks', 'Reach', 'Views', 'Result', 'Cost/Result']
    summarySheet.getRow(row).font = { bold: true }
    summarySheet.getRow(row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }
    row++

    results.forEach((ch) => {
      let channelLabel = CHANNEL_LABELS[ch.channel_type]
      if (ch.platform) channelLabel += ` - ${PLATFORM_LABELS[ch.platform]}`

      const m = ch.metrics[scenario.key]
      let result = '-'
      let resultCount = 0

      // Determine result based on objective
      switch (ch.objective) {
        case 'video_views':
          if (m.views > 0) {
            result = `${m.views} views`
            resultCount = m.views
          }
          break
        case 'website_visits':
          if (m.clicks > 0) {
            result = `${m.clicks} clicks`
            resultCount = m.clicks
          }
          break
        case 'engagements':
          if (m.engagements > 0) {
            result = `${m.engagements} engagements`
            resultCount = m.engagements
          }
          break
        case 'website_conversions':
          if (m.conversions > 0) {
            result = `${m.conversions} conversions`
            resultCount = m.conversions
          }
          break
        case 'lead_generation':
          if (m.leads > 0) {
            result = `${m.leads} leads`
            resultCount = m.leads
          }
          break
        case 'awareness':
          if (m.reach > 0) {
            result = `${m.reach} reach`
            resultCount = m.reach
          }
          break
        default:
          // For non-social channels, infer from channel type
          if (ch.channel_type === 'video' && m.views > 0) {
            result = `${m.views} views`
            resultCount = m.views
          } else if (ch.channel_type === 'search' && m.clicks > 0) {
            result = `${m.clicks} clicks`
            resultCount = m.clicks
          } else if ((ch.channel_type === 'display' || ch.channel_type === 'programmatic') && m.reach > 0) {
            result = `${m.reach} reach`
            resultCount = m.reach
          }
      }

      const costPerResult = resultCount > 0 ? `$${(ch.budget / resultCount).toFixed(2)}` : '-'

      summarySheet.getRow(row).values = [
        channelLabel,
        ch.objective ? OBJECTIVE_LABELS[ch.objective] : '-',
        ch.budget,
        m.impressions || '-',
        m.clicks || '-',
        m.reach || '-',
        m.views || '-',
        result,
        costPerResult,
      ]
      row++
    })
  })

  // Auto-fit columns
  summarySheet.columns.forEach((col) => {
    col.width = 15
  })

  // ===== TAB 2: DETAILED BREAKDOWN =====
  const detailSheet = workbook.addWorksheet('Detailed Breakdown')

  // Header
  detailSheet.mergeCells('A1:H1')
  detailSheet.getCell('A1').value = `MEDIA PLAN: ${typedPlan.name}`
  detailSheet.getCell('A1').font = { bold: true, size: 16 }

  detailSheet.getCell('A2').value = `Client: ${typedPlan.client_name || '-'}`
  detailSheet.getCell('C2').value = `Flight: ${typedPlan.start_date} to ${typedPlan.end_date}`
  detailSheet.getCell('E2').value = `Total Budget: $${typedPlan.total_budget.toLocaleString()}`

  // Pacing weights
  row = 4
  detailSheet.getCell(`A${row}`).value = 'PACING WEIGHTS'
  detailSheet.getCell(`A${row}`).font = { bold: true }
  row++

  const periods = Object.entries(typedPlan.pacing_weights).sort(([a], [b]) => {
    const numA = parseInt(a.split('_')[1])
    const numB = parseInt(b.split('_')[1])
    return numA - numB
  })

  detailSheet.getRow(row).values = periods.map(([p]) => p.replace('_', ' ').toUpperCase())
  row++
  detailSheet.getRow(row).values = periods.map(([, w]) => `${w}%`)

  // Detailed breakdown for each scenario
  scenarios.forEach((scenario) => {
    row += 3
    detailSheet.getCell(`A${row}`).value = scenario.label
    detailSheet.getCell(`A${row}`).font = { bold: true }
    row++

    detailSheet.getRow(row).values = ['Channel', 'Period', 'Budget', 'Impressions', 'Clicks', 'Reach', 'Views', 'Result', 'Cost/Result']
    detailSheet.getRow(row).font = { bold: true }
    detailSheet.getRow(row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }
    row++

    pacingResults.forEach((period) => {
      period.channels.forEach((ch) => {
        let channelLabel = CHANNEL_LABELS[ch.channel_type]
        if (ch.platform) channelLabel += ` - ${PLATFORM_LABELS[ch.platform]}`

        const m = ch.metrics[scenario.key]
        let result = '-'
        let resultCount = 0
        if (m.conversions > 0) {
          result = `${m.conversions} conv`
          resultCount = m.conversions
        } else if (m.leads > 0) {
          result = `${m.leads} leads`
          resultCount = m.leads
        } else if (m.engagements > 0) {
          result = `${m.engagements} eng`
          resultCount = m.engagements
        }

        const costPerResult = resultCount > 0 ? `$${(ch.budget / resultCount).toFixed(2)}` : '-'

        detailSheet.getRow(row).values = [
          channelLabel,
          period.period.replace('_', ' ').toUpperCase(),
          Math.round(ch.budget),
          m.impressions || '-',
          m.clicks || '-',
          m.reach || '-',
          m.views || '-',
          result,
          costPerResult,
        ]
        row++
      })
    })

    // Totals
    row++
    detailSheet.getCell(`A${row}`).value = 'TOTALS'
    detailSheet.getCell(`A${row}`).font = { bold: true }
    row++

    results.forEach((ch) => {
      let channelLabel = CHANNEL_LABELS[ch.channel_type]
      if (ch.platform) channelLabel += ` - ${PLATFORM_LABELS[ch.platform]}`

      const m = ch.metrics[scenario.key]
      let result = '-'
      let resultCount = 0
      if (m.conversions > 0) {
        result = `${m.conversions} conv`
        resultCount = m.conversions
      } else if (m.leads > 0) {
        result = `${m.leads} leads`
        resultCount = m.leads
      } else if (m.engagements > 0) {
        result = `${m.engagements} eng`
        resultCount = m.engagements
      }

      const costPerResult = resultCount > 0 ? `$${(ch.budget / resultCount).toFixed(2)}` : '-'

      detailSheet.getRow(row).values = [
        channelLabel,
        'TOTAL',
        ch.budget,
        m.impressions || '-',
        m.clicks || '-',
        m.reach || '-',
        m.views || '-',
        result,
        costPerResult,
      ]
      detailSheet.getRow(row).font = { bold: true }
      row++
    })
  })

  // Auto-fit columns
  detailSheet.columns.forEach((col) => {
    col.width = 15
  })

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()

  // Return as download
  const filename = `${typedPlan.name.replace(/[^a-z0-9]/gi, '_')}_media_plan.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
