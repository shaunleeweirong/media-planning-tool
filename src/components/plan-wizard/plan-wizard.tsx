'use client'

import { useState } from 'react'
import { PlanFormData, createPlan, updatePlan } from '@/lib/actions/plans'
import { PlanWithChannels, PlanChannel } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StepDetails } from './step-details'
import { StepPacing } from './step-pacing'
import { StepChannels } from './step-channels'
import { StepReview } from './step-review'

type PlanWizardProps = {
  existingPlan?: PlanWithChannels
}

const STEPS = ['Details', 'Pacing', 'Channels', 'Review']

export function PlanWizard({ existingPlan }: PlanWizardProps) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showBudgetWarning, setShowBudgetWarning] = useState(false)

  const [formData, setFormData] = useState<PlanFormData>({
    name: existingPlan?.name || '',
    client_name: existingPlan?.client_name || '',
    total_budget: existingPlan?.total_budget || 0,
    start_date: existingPlan?.start_date || '',
    end_date: existingPlan?.end_date || '',
    pacing_weights: existingPlan?.pacing_weights || {},
    channels: existingPlan?.plan_channels.map((ch) => ({
      channel_type: ch.channel_type,
      platform: ch.platform,
      objective: ch.objective,
      budget: ch.budget,
      inputs: ch.inputs,
    })) || [],
  })

  function updateFormData(updates: Partial<PlanFormData>) {
    setFormData((prev) => ({ ...prev, ...updates }))
  }

  function handleNext() {
    if (step === 1) {
      const total = Object.values(formData.pacing_weights).reduce((sum, w) => sum + w, 0)
      if (total !== 100) {
        setError('Pacing weights must equal 100% before continuing. Current total: ' + total + '%.')
        return
      }
      setError(null)
    }
    if (step === 2) {
      const allocated = formData.channels.reduce((sum, ch) => sum + ch.budget, 0)
      if (allocated !== formData.total_budget) {
        setShowBudgetWarning(true)
        return
      }
    }
    setStep((s) => s + 1)
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    const result = existingPlan
      ? await updatePlan(existingPlan.id, formData)
      : await createPlan(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex-1 h-2 rounded ${
              i <= step ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 0 && (
            <StepDetails formData={formData} updateFormData={updateFormData} />
          )}
          {step === 1 && (
            <StepPacing formData={formData} updateFormData={updateFormData} />
          )}
          {step === 2 && (
            <StepChannels formData={formData} updateFormData={updateFormData} />
          )}
          {step === 3 && <StepReview formData={formData} />}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext}>Next</Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : existingPlan ? 'Update Plan' : 'Create Plan'}
          </Button>
        )}
      </div>

      <Dialog open={showBudgetWarning} onOpenChange={setShowBudgetWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Budget Not Fully Allocated</DialogTitle>
            <DialogDescription>
              {(() => {
                const allocated = formData.channels.reduce((sum, ch) => sum + ch.budget, 0)
                const remaining = formData.total_budget - allocated
                return remaining > 0
                  ? `You still have $${remaining.toLocaleString()} of your $${formData.total_budget.toLocaleString()} budget unallocated.`
                  : `You have exceeded your budget by $${Math.abs(remaining).toLocaleString()}.`
              })()}
              {' '}Are you sure you want to continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBudgetWarning(false)}>
              Go Back
            </Button>
            <Button
              onClick={() => {
                setShowBudgetWarning(false)
                setStep((s) => s + 1)
              }}
            >
              Continue Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
