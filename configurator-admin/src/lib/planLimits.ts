export const PLAN_LIMITS = {
  free:    { products: 3  },
  starter: { products: 20 },
  pro:     { products: -1 }, // -1 = unlimited
} as const

export type Plan = keyof typeof PLAN_LIMITS

export function productLimit(plan: string): number {
  return (PLAN_LIMITS[plan as Plan] ?? PLAN_LIMITS.free).products
}

export function atProductLimit(plan: string, count: number): boolean {
  const limit = productLimit(plan)
  return limit >= 0 && count >= limit
}

export function planLabel(plan: string): string {
  const labels: Record<string, string> = {
    free:    'Free',
    starter: 'Starter',
    pro:     'Pro',
  }
  return labels[plan] ?? plan
}
