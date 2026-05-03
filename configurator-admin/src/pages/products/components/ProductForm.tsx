import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { FormField } from '@/components/ui/form-field'
import { I18nEditor } from '@/components/ui/i18n-editor'
import type { Product } from '@/types/database'
import { t } from '@/i18n'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'HRK', 'RSD']

export type ProductFormValues = {
  name: string
  name_i18n: Record<string, string>
  description?: string
  description_i18n: Record<string, string>
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
    name:            z.string().min(1, t('Name is required')).max(300),
    description:     z.string().optional(),
    base_price:      z.coerce.number().min(0, t('Price must be 0 or more')),
    currency:        z.string().length(3),
    sku:             z.string().max(100).optional().or(z.literal('')),
    unit_of_measure: z.string().max(50).optional().or(z.literal('')),
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Omit<ProductFormValues, 'name_i18n' | 'description_i18n'>>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency:   'EUR',
      base_price: 0,
      ...defaultValues,
    },
  })

  const [nameI18n, setNameI18n] = useState<Record<string, string>>(defaultValues?.name_i18n ?? {})
  const [descI18n, setDescI18n] = useState<Record<string, string>>(defaultValues?.description_i18n ?? {})

  async function handleFormSubmit(data: Omit<ProductFormValues, 'name_i18n' | 'description_i18n'>) {
    await onSubmit({ ...data, name_i18n: nameI18n, description_i18n: descI18n })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      <FormField label={t('Product name')} htmlFor="name" error={errors.name?.message} required>
        <Input
          id="name"
          placeholder={t('e.g. Solid Wood Dining Table')}
          {...register('name')}
        />
      </FormField>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">{t('Name translations')}</p>
        <I18nEditor value={nameI18n} onChange={setNameI18n} placeholder={t('Translated name')} />
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

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">{t('Description translations')}</p>
        <I18nEditor value={descI18n} onChange={setDescI18n} multiline placeholder={t('Translated description')} />
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

export function productToFormValues(p: Product): ProductFormValues {
  return {
    name:            p.name,
    name_i18n:       (p.name_i18n as Record<string, string> | null) ?? {},
    description:     p.description ?? '',
    description_i18n: (p.description_i18n as Record<string, string> | null) ?? {},
    base_price:      p.base_price,
    currency:        p.currency,
    sku:             p.sku ?? '',
    unit_of_measure: p.unit_of_measure ?? '',
  }
}
