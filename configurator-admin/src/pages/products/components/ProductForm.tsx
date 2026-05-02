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
  name_en?: string
  name_sr?: string
  description?: string
  description_en?: string
  description_sr?: string
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
    name_en:          z.string().max(300).optional().or(z.literal('')),
    name_sr:          z.string().max(300).optional().or(z.literal('')),
    description:      z.string().optional(),
    description_en:   z.string().optional(),
    description_sr:   z.string().optional(),
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

      {/* Name translations */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label={t('Name (EN)')} htmlFor="name_en" error={errors.name_en?.message}>
          <Input
            id="name_en"
            placeholder={t('English name')}
            {...register('name_en')}
          />
        </FormField>
        <FormField label={t('Name (SR)')} htmlFor="name_sr" error={errors.name_sr?.message}>
          <Input
            id="name_sr"
            placeholder={t('Serbian name')}
            {...register('name_sr')}
          />
        </FormField>
      </div>

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

      {/* Description translations */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label={t('Description (EN)')} htmlFor="description_en">
          <Textarea
            id="description_en"
            placeholder={t('English description')}
            rows={2}
            {...register('description_en')}
          />
        </FormField>
        <FormField label={t('Description (SR)')} htmlFor="description_sr">
          <Textarea
            id="description_sr"
            placeholder={t('Serbian description')}
            rows={2}
            {...register('description_sr')}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

// Build a name_i18n / description_i18n map from form values, skipping empty strings
export function buildI18nMap(en?: string, sr?: string): Record<string, string> {
  const map: Record<string, string> = {}
  if (en?.trim()) map['en'] = en.trim()
  if (sr?.trim()) map['sr'] = sr.trim()
  return map
}

export function productToFormValues(p: Product): ProductFormValues {
  const ni = p.name_i18n as Record<string, string> | null ?? {}
  const di = p.description_i18n as Record<string, string> | null ?? {}
  return {
    name:            p.name,
    name_en:         ni['en'] ?? '',
    name_sr:         ni['sr'] ?? '',
    description:     p.description ?? '',
    description_en:  di['en'] ?? '',
    description_sr:  di['sr'] ?? '',
    base_price:      p.base_price,
    currency:        p.currency,
    sku:             p.sku ?? '',
    unit_of_measure: p.unit_of_measure ?? '',
  }
}
