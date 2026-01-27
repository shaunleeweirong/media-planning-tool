import { PlanWizard } from '@/components/plan-wizard/plan-wizard'

export default function NewPlanPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Create New Plan</h1>
      <PlanWizard />
    </div>
  )
}
