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

// LinkedIn Strategy data: maps objectives/channels to business context
const OBJECTIVE_STRATEGY: Record<string, {
  businessQuestion: string
  kpis: string[]
  roiMetrics: string[]
  linkedinSolutions: string[]
}> = {
  awareness: {
    businessQuestion: 'How can we increase brand visibility and recognition among our target audience?',
    kpis: ['Impressions', 'Reach', 'Frequency', 'CPM', 'Brand Lift'],
    roiMetrics: ['Cost Per 1,000 Impressions (CPM)', 'Cost Per Reach Point', 'Share of Voice'],
    linkedinSolutions: ['Sponsored Content (Single Image & Carousel)', 'Brand Awareness Campaign Objective', 'LinkedIn Audience Network', 'Programmatic Display via LinkedIn DSP'],
  },
  video_views: {
    businessQuestion: 'How can we engage our audience with compelling video storytelling?',
    kpis: ['Video Views', 'View-Through Rate (VTR)', 'Cost Per View (CPV)', 'Completion Rate'],
    roiMetrics: ['Cost Per Completed View', 'Video Completion Rate', 'Brand Recall Lift'],
    linkedinSolutions: ['LinkedIn Video Ads', 'Sponsored Content (Video)', 'Connected TV (CTV) Ads', 'LinkedIn Live Events'],
  },
  website_visits: {
    businessQuestion: 'How can we drive qualified, high-intent traffic to our website?',
    kpis: ['Clicks', 'Click-Through Rate (CTR)', 'Cost Per Click (CPC)', 'Landing Page Views'],
    roiMetrics: ['Cost Per Landing Page View', 'Bounce Rate', 'Pages Per Session'],
    linkedinSolutions: ['Sponsored Content with Website Clicks Objective', 'Text Ads', 'Dynamic Ads (Spotlight)', 'LinkedIn Audience Network'],
  },
  engagements: {
    businessQuestion: 'How can we drive meaningful interactions and build community around our brand?',
    kpis: ['Engagements', 'Engagement Rate', 'Cost Per Engagement (CPE)', 'Social Actions'],
    roiMetrics: ['Cost Per Engagement', 'Engagement-to-Follower Ratio', 'Content Virality Rate'],
    linkedinSolutions: ['Sponsored Content (Document Ads & Carousel)', 'Event Ads', 'Thought Leader Ads', 'LinkedIn Polls & Newsletters'],
  },
  website_conversions: {
    businessQuestion: 'How can we convert website visitors into measurable business outcomes?',
    kpis: ['Conversions', 'Conversion Rate', 'Cost Per Acquisition (CPA)', 'ROAS'],
    roiMetrics: ['Return on Ad Spend (ROAS)', 'Cost Per Conversion', 'Revenue Per Conversion', 'Customer Acquisition Cost (CAC)'],
    linkedinSolutions: ['Website Conversions Objective', 'LinkedIn Insight Tag & CAPI', 'Matched Audiences (Retargeting)', 'Predictive Audiences'],
  },
  lead_generation: {
    businessQuestion: 'How can we generate high-quality B2B leads at scale?',
    kpis: ['Leads', 'Form Completion Rate', 'Cost Per Lead (CPL)', 'Lead Quality Score'],
    roiMetrics: ['Cost Per Lead', 'Lead-to-MQL Conversion Rate', 'Lead-to-Opportunity Rate', 'Pipeline Value Generated'],
    linkedinSolutions: ['Lead Gen Forms (pre-filled)', 'Sponsored Messaging (Message & Conversation Ads)', 'Document Ads with Lead Gen', 'LinkedIn Sales Navigator Integration'],
  },
}

const CHANNEL_STRATEGY: Record<string, {
  businessQuestion: string
  kpis: string[]
  roiMetrics: string[]
  linkedinSolutions: string[]
}> = {
  search: {
    businessQuestion: 'How can we capture high-intent demand from active searchers?',
    kpis: ['Clicks', 'CTR', 'CPC', 'Impressions', 'Conversion Rate'],
    roiMetrics: ['Cost Per Click', 'Cost Per Conversion', 'Quality Score', 'ROAS'],
    linkedinSolutions: ['LinkedIn Ads Matched Audiences (integrate search intent data)', 'Website Retargeting via LinkedIn Insight Tag', 'Predictive Audiences from CRM data'],
  },
  display: {
    businessQuestion: 'How can we build brand awareness and stay top-of-mind across the web?',
    kpis: ['Impressions', 'Reach', 'CTR', 'Frequency', 'Viewability'],
    roiMetrics: ['Cost Per 1,000 Impressions', 'Cost Per Reach Point', 'View-Through Conversions'],
    linkedinSolutions: ['LinkedIn Audience Network (extend reach beyond feed)', 'Dynamic Ads (Follower & Spotlight)', 'Programmatic Display via LinkedIn DSP'],
  },
  video: {
    businessQuestion: 'How can we engage audiences with rich video content across platforms?',
    kpis: ['Video Views', 'VTR', 'CPV', 'Completion Rate', 'Impressions'],
    roiMetrics: ['Cost Per View', 'Cost Per Completed View', 'Brand Recall Lift'],
    linkedinSolutions: ['LinkedIn Video Ads (in-feed)', 'Connected TV (CTV) via LinkedIn', 'Sponsored Content (Video)', 'LinkedIn Live'],
  },
  programmatic: {
    businessQuestion: 'How can we scale reach across premium inventory with data-driven precision?',
    kpis: ['Impressions', 'Reach', 'CTR', 'Frequency', 'Viewability'],
    roiMetrics: ['Effective CPM (eCPM)', 'Cost Per Reach Point', 'View-Through Conversions'],
    linkedinSolutions: ['LinkedIn Marketing Partner DSPs', 'LinkedIn Audience Network', 'Company & Contact Targeting via LinkedIn data', 'ABM (Account-Based Marketing) integrations'],
  },
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
      audience: ch.audience,
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

  let row = 5

  // Scenarios (each table includes assumption columns inline)
  const scenarios = [
    { key: 'moderate', label: 'MODERATE SCENARIO (Baseline)' },
    { key: 'aggressive', label: 'AGGRESSIVE SCENARIO (+20%)' },
    { key: 'conservative', label: 'CONSERVATIVE SCENARIO (-10%)' },
  ] as const

  scenarios.forEach((scenario, idx) => {
    row += idx === 0 ? 0 : 2
    summarySheet.getCell(`A${row}`).value = scenario.label
    summarySheet.getCell(`A${row}`).font = { bold: true }
    row++

    summarySheet.getRow(row).values = [
      'Channel', 'Objective', 'Audience', 'Budget',
      'Impressions', 'Clicks', 'Reach', 'Views', 'Result', 'Cost/Result',
      'CPM', 'CPC', 'CPV', 'CTR%', 'VTR%', 'Freq', 'Conv%', 'Form%', 'Eng%',
    ]
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
        ch.audience || '-',
        ch.budget,
        m.impressions || '-',
        m.clicks || '-',
        m.reach || '-',
        m.views || '-',
        result,
        costPerResult,
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

  // ===== TAB 3: LINKEDIN STRATEGY =====
  const strategySheet = workbook.addWorksheet('LinkedIn Strategy')

  const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A66C2' } }
  const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
  const SECTION_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } }
  const SECTION_FONT: Partial<ExcelJS.Font> = { bold: true, size: 11, color: { argb: 'FF0A66C2' } }
  const SUBSECTION_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F6F8' } }
  const SUBSECTION_FONT: Partial<ExcelJS.Font> = { bold: true, size: 10 }

  // Title
  strategySheet.mergeCells('A1:F1')
  strategySheet.getCell('A1').value = 'LINKEDIN STRATEGY & RECOMMENDATIONS'
  strategySheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF0A66C2' } }

  strategySheet.mergeCells('A2:F2')
  strategySheet.getCell('A2').value = `Media Plan: ${typedPlan.name} | Client: ${typedPlan.client_name || '-'} | Budget: $${typedPlan.total_budget.toLocaleString()}`
  strategySheet.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } }

  let sRow = 4

  // Per-channel strategy sections
  results.forEach((ch, idx) => {
    let channelLabel = CHANNEL_LABELS[ch.channel_type]
    if (ch.platform) channelLabel += ` - ${PLATFORM_LABELS[ch.platform]}`
    const objectiveLabel = ch.objective ? OBJECTIVE_LABELS[ch.objective] : '-'

    // Determine strategy data: use objective-specific for social, channel-specific otherwise
    const strategy = (ch.objective && OBJECTIVE_STRATEGY[ch.objective])
      ? OBJECTIVE_STRATEGY[ch.objective]
      : CHANNEL_STRATEGY[ch.channel_type]

    if (!strategy) return

    if (idx > 0) sRow++

    // Channel header row
    strategySheet.mergeCells(`A${sRow}:F${sRow}`)
    strategySheet.getCell(`A${sRow}`).value = `${channelLabel}  |  Objective: ${objectiveLabel}  |  Budget: $${ch.budget.toLocaleString()}`
    strategySheet.getCell(`A${sRow}`).font = HEADER_FONT
    strategySheet.getRow(sRow).fill = HEADER_FILL
    strategySheet.getRow(sRow).height = 28
    sRow++

    // -- Campaign Objective --
    strategySheet.mergeCells(`A${sRow}:B${sRow}`)
    strategySheet.getCell(`A${sRow}`).value = 'CAMPAIGN OBJECTIVE'
    strategySheet.getCell(`A${sRow}`).font = SECTION_FONT
    strategySheet.getRow(sRow).fill = SECTION_FILL
    sRow++
    strategySheet.mergeCells(`A${sRow}:F${sRow}`)
    strategySheet.getCell(`A${sRow}`).value = objectiveLabel !== '-'
      ? `Drive ${objectiveLabel.toLowerCase()} for ${typedPlan.client_name || 'the client'} across the ${typedPlan.start_date} to ${typedPlan.end_date} campaign flight.`
      : `Leverage ${channelLabel.toLowerCase()} channel to achieve campaign goals for ${typedPlan.client_name || 'the client'}.`
    strategySheet.getRow(sRow).height = 22
    sRow++

    // -- Key Business Question --
    strategySheet.mergeCells(`A${sRow}:B${sRow}`)
    strategySheet.getCell(`A${sRow}`).value = 'KEY BUSINESS QUESTION'
    strategySheet.getCell(`A${sRow}`).font = SECTION_FONT
    strategySheet.getRow(sRow).fill = SECTION_FILL
    sRow++
    strategySheet.mergeCells(`A${sRow}:F${sRow}`)
    strategySheet.getCell(`A${sRow}`).value = strategy.businessQuestion
    strategySheet.getRow(sRow).height = 22
    sRow++

    // -- Campaign KPIs --
    strategySheet.mergeCells(`A${sRow}:B${sRow}`)
    strategySheet.getCell(`A${sRow}`).value = 'CAMPAIGN KPIs'
    strategySheet.getCell(`A${sRow}`).font = SUBSECTION_FONT
    strategySheet.getRow(sRow).fill = SUBSECTION_FILL
    sRow++
    strategy.kpis.forEach((kpi) => {
      strategySheet.getCell(`A${sRow}`).value = '  •'
      strategySheet.getCell(`B${sRow}`).value = kpi
      sRow++
    })

    // -- ROI Metrics --
    strategySheet.mergeCells(`A${sRow}:B${sRow}`)
    strategySheet.getCell(`A${sRow}`).value = 'ROI METRICS'
    strategySheet.getCell(`A${sRow}`).font = SUBSECTION_FONT
    strategySheet.getRow(sRow).fill = SUBSECTION_FILL
    sRow++
    strategy.roiMetrics.forEach((metric) => {
      strategySheet.getCell(`A${sRow}`).value = '  •'
      strategySheet.getCell(`B${sRow}`).value = metric
      sRow++
    })

    // -- Forecasted Performance (moderate scenario) --
    const mod = ch.metrics.moderate
    strategySheet.mergeCells(`A${sRow}:B${sRow}`)
    strategySheet.getCell(`A${sRow}`).value = 'FORECASTED PERFORMANCE'
    strategySheet.getCell(`A${sRow}`).font = SUBSECTION_FONT
    strategySheet.getRow(sRow).fill = SUBSECTION_FILL
    sRow++

    const forecasts: [string, number][] = []
    if (mod.impressions > 0) forecasts.push(['Impressions', mod.impressions])
    if (mod.reach > 0) forecasts.push(['Reach', mod.reach])
    if (mod.clicks > 0) forecasts.push(['Clicks', mod.clicks])
    if (mod.views > 0) forecasts.push(['Views', mod.views])
    if (mod.engagements > 0) forecasts.push(['Engagements', mod.engagements])
    if (mod.conversions > 0) forecasts.push(['Conversions', mod.conversions])
    if (mod.leads > 0) forecasts.push(['Leads', mod.leads])

    forecasts.forEach(([label, value]) => {
      strategySheet.getCell(`A${sRow}`).value = '  •'
      strategySheet.getCell(`B${sRow}`).value = `${label}: ${value.toLocaleString()}`
      sRow++
    })

    // -- LinkedIn Solutions --
    strategySheet.mergeCells(`A${sRow}:B${sRow}`)
    strategySheet.getCell(`A${sRow}`).value = 'RECOMMENDED LINKEDIN SOLUTIONS'
    strategySheet.getCell(`A${sRow}`).font = SECTION_FONT
    strategySheet.getRow(sRow).fill = SECTION_FILL
    sRow++
    strategy.linkedinSolutions.forEach((solution) => {
      strategySheet.getCell(`A${sRow}`).value = '  ✓'
      strategySheet.getCell(`B${sRow}`).value = solution
      strategySheet.getCell(`B${sRow}`).font = { color: { argb: 'FF0A66C2' } }
      sRow++
    })

    sRow++
  })

  // Column widths for strategy sheet
  strategySheet.getColumn(1).width = 6
  strategySheet.getColumn(2).width = 50
  strategySheet.getColumn(3).width = 20
  strategySheet.getColumn(4).width = 20
  strategySheet.getColumn(5).width = 20
  strategySheet.getColumn(6).width = 20

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
