-- Add tenant-level custom message shown in the widget after inquiry submission
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS post_inquiry_message text;
