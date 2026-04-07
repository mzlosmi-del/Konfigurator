import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { FormField } from '@/components/ui/form-field'
import type { Product } from '@/types/database'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'HRK', 'RSD']

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(300),
  description: z.string().optional(),
  base_price: z.coerce.number().min(0, 'Price must be 0 or more'),
  currency: z.string().length(3),
})

export type ProductFormValues = z.infer<typeof schema>

interface ProductFormProps {
  defaultValues?: Partial<ProductFormValues>
  onSubmit: (values: ProductFormValues) => Promise<void>
  submitLabel?: string
  onCancel?: () => void
}

export function ProductForm({
  defaultValues,
  onSubmit,
  submitLabel = 'Save product',
  onCancel,
}: ProductFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency: 'EUR',
      base_price: 0,
      ...defaultValues,
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <FormField label="Product name" htmlFor="name" error={errors.name?.message} required>
        <Input
          id="name"
          placeholder="e.g. Solid Wood Dining Table"
          {...register('name')}
        />
      </FormField>

      <FormField
        label="Description"
        htmlFor="description"
        error={errors.description?.message}
        hint="Shown to customers in the configurator"
      >
        <Textarea
          id="description"
          placeholder="Brief product description..."
          rows={3}
          {...register('description')}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Base price"
          htmlFor="base_price"
          error={errors.base_price?.message}
          hint="Before any option modifiers"
          required
        >
          <Input
            id="base_price"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register('base_price')}
          />
        </FormField>

        <FormField label="Currency" htmlFor="currency" error={errors.currency?.message} required>
          <Select id="currency" {...register('currency')}>
            {CURRENCIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

// Helper to map a Product row back to form values
export function productToFormValues(p: Product): ProductFormValues {
  return {
    name: p.name,
    description: p.description ?? '',
    base_price: p.base_price,
    currency: p.currency,
  }
}
