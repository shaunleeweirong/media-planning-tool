'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plan } from '@/types/database'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { PlanActions } from './plan-actions'

type PlansListProps = {
  plans: Plan[]
}

export function PlansList({ plans }: PlansListProps) {
  const [search, setSearch] = useState('')

  const filteredPlans = plans.filter(
    (plan) =>
      plan.name.toLowerCase().includes(search.toLowerCase()) ||
      plan.client_name?.toLowerCase().includes(search.toLowerCase())
  )

  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No plans yet. Create your first media plan!</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by plan name or client..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <div className="border rounded-lg">
        <table className="w-full">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium">Plan Name</th>
              <th className="text-left p-4 font-medium">Client</th>
              <th className="text-left p-4 font-medium">Dates</th>
              <th className="text-left p-4 font-medium">Budget</th>
              <th className="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlans.map((plan) => (
              <tr key={plan.id} className="border-b last:border-0">
                <td className="p-4">
                  <Link href={`/plans/${plan.id}`} className="hover:underline font-medium">
                    {plan.name}
                  </Link>
                </td>
                <td className="p-4 text-muted-foreground">{plan.client_name || '-'}</td>
                <td className="p-4 text-muted-foreground">
                  {new Date(plan.start_date).toLocaleDateString()} -{' '}
                  {new Date(plan.end_date).toLocaleDateString()}
                </td>
                <td className="p-4">${plan.total_budget.toLocaleString()}</td>
                <td className="p-4 text-right">
                  <PlanActions plan={plan} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
