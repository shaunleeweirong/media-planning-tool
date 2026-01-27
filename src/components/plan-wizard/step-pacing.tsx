'use client'

import { useEffect } from 'react'
import { PlanFormData } from '@/lib/actions/plans'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type StepPacingProps = {
  formData: PlanFormData
  updateFormData: (updates: Partial<PlanFormData>) => void
}

function getWeeksBetween(start: string, end: string): string[] {
  if (!start || !end) return []

  const weeks: string[] = []
  const startDate = new Date(start)
  const endDate = new Date(end)

  let current = new Date(startDate)
  let weekNum = 1

  while (current <= endDate) {
    weeks.push(`week_${weekNum}`)
    current.setDate(current.getDate() + 7)
    weekNum++
  }

  return weeks
}

export function StepPacing({ formData, updateFormData }: StepPacingProps) {
  const weeks = getWeeksBetween(formData.start_date, formData.end_date)

  useEffect(() => {
    // Initialize pacing weights if not set
    if (weeks.length > 0 && Object.keys(formData.pacing_weights).length === 0) {
      const evenWeight = Math.floor(100 / weeks.length)
      const remainder = 100 - evenWeight * weeks.length

      const weights: Record<string, number> = {}
      weeks.forEach((week, i) => {
        weights[week] = evenWeight + (i === weeks.length - 1 ? remainder : 0)
      })

      updateFormData({ pacing_weights: weights })
    }
  }, [weeks.length])

  const total = Object.values(formData.pacing_weights).reduce((sum, w) => sum + w, 0)

  function handleWeightChange(week: string, value: number) {
    updateFormData({
      pacing_weights: {
        ...formData.pacing_weights,
        [week]: value,
      },
    })
  }

  if (weeks.length === 0) {
    return (
      <p className="text-muted-foreground">
        Please set campaign dates first to configure pacing.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter the percentage of budget to allocate to each week. Total must equal 100%.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {weeks.map((week, i) => (
          <div key={week} className="space-y-2">
            <Label htmlFor={week}>Week {i + 1} (%)</Label>
            <Input
              id={week}
              type="number"
              min={0}
              max={100}
              value={formData.pacing_weights[week] || 0}
              onChange={(e) => handleWeightChange(week, parseFloat(e.target.value) || 0)}
            />
          </div>
        ))}
      </div>
      <p className={`text-sm ${total === 100 ? 'text-green-600' : 'text-destructive'}`}>
        Total: {total}% {total !== 100 && '(must equal 100%)'}
      </p>
    </div>
  )
}
