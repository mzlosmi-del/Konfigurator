import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { FormField } from '@/components/ui/form-field'
import type { Product } from '@/types/database'
import { t } from '@/i18n'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'HRK', 'RSD']

export type ProductFormValues = {
  name: string
  description?: string
  base_price: number
  currency: string
  sku?: string
  unit_of_measure?: string
}

interface ProductFormProps {
  defaultValues?: Partial<ProductFormValues>
  onSubmit: (values: ProductFormValues) => Promise<void>
  submitLabel?: string
  onCancel?: () => void
}

export function ProductForm({
  defaultValues,
  onSubmit,
  submitLabel,
  onCancel,
}: ProductFormProps) {
  const schema = z.object({
    name:             z.string().min(1, t('Name is required')).max(300),
    description:      z.string().optional(),
    base_price:       z.coerce.number().min(0, t('Price must be 0 or more')),
    currency:         z.string().length(3),
    sku:              z.string().max(100).optional().or(z.literal('')),
    unit_of_measure:  z.string().max(50).optional().or(z.literal('')),
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency:   'EUR',
      base_price: 0,
      ...defaultValues,
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <FormField label={t('Product name')} htmlFor="name" error={errors.name?.message} required>
        <Input
          id="name"
          placeholder={t('e.g. Solid Wood Dining Table')}
          {...register('name')}
        />
      </FormField>

      <FormField
        label={t('Description')}
        htmlFor="description"
        error={errors.description?.message}
        hint={t('Shown to customers in the configurator')}
      >
        <Textarea
          id="description"
          placeholder={t('Brief product description...')}
          rows={3}
          {...register('description')}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label={t('SKU / Code')}
          htmlFor="sku"
          error={errors.sku?.message}
          hint={t('Optional unique product identifier')}
        >
          <Input
            id="sku"
            placeholder="e.g. PROD-001"
            {...register('sku')}
          />
        </FormField>

        <FormField
          label={t('Unit of Measure')}
          htmlFor="unit_of_measure"
          error={errors.unit_of_measure?.message}
          hint={t('e.g. pcs, m², kg, m')}
        >
          <Input
            id="unit_of_measure"
            placeholder="pcs"
            {...register('unit_of_measure')}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label={t('Base price')}
          htmlFor="base_price"
          error={errors.base_price?.message}
          hint={t('Before any option modifiers')}
          required
        >
          <Input
            id="base_price"
            type="number"
            step="0.01"
            min="0"
            placeholder={t('0.00')}
            {...register('base_price')}
          />
        </FormField>

        <FormField label={t('Currency')} htmlFor="currency" error={errors.currency?.message} required>
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
            {t('Cancel')}
          </Button>
        )}
        <Button type="submit" loading={isSubmitting}>
          {submitLabel ?? t('Save product')}
        </Button>
      </div>
    </form>
  )
}

export function productToFormValues(p: Product): ProductFormValues {
  return {
    name:            p.name,
    description:     p.description ?? '',
    base_price:      p.base_price,
    currency:        p.currency,
    sku:             p.sku ?? '',
    unit_of_measure: p.unit_of_measure ?? '',
  }
}
