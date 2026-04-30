-- Extra fields for quotations and tenant company profile
-- Quotation: subject title, payment terms, separate delivery address, customer VAT number
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS title               text,
  ADD COLUMN IF NOT EXISTS payment_terms       text,
  ADD COLUMN IF NOT EXISTS delivery_address    text,
  ADD COLUMN IF NOT EXISTS customer_vat_number text;

-- Tenant: own VAT / tax ID and company registration number (appear on PDF invoices)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS vat_number          text,
  ADD COLUMN IF NOT EXISTS company_reg_number  text;
