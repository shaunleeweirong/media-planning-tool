'use client'

import { PlanFormData } from '@/lib/actions/plans'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type StepDetailsProps = {
  formData: PlanFormData
  updateFormData: (updates: Partial<PlanFormData>) => void
}

export function StepDetails({ formData, updateFormData }: StepDetailsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Plan Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => updateFormData({ name: e.target.value })}
          placeholder="e.g., Q1 Brand Campaign"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="client_name">Client Name</Label>
        <Input
          id="client_name"
          value={formData.client_name}
          onChange={(e) => updateFormData({ client_name: e.target.value })}
          placeholder="e.g., Acme Corp"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="total_budget">Total Budget ($) *</Label>
        <Input
          id="total_budget"
          type="number"
          min={0}
          value={formData.total_budget || ''}
          onChange={(e) => updateFormData({ total_budget: parseFloat(e.target.value) || 0 })}
          placeholder="e.g., 50000"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_date">Start Date *</Label>
          <Input
            id="start_date"
            type="date"
            value={formData.start_date}
            onChange={(e) => updateFormData({ start_date: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">End Date *</Label>
          <Input
            id="end_date"
            type="date"
            value={formData.end_date}
            onChange={(e) => updateFormData({ end_date: e.target.value })}
            required
          />
        </div>
      </div>
    </div>
  )
}
