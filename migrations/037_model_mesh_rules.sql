-- Add mesh_rules column to visualization_assets for 3D model mesh mapping
ALTER TABLE public.visualization_assets
  ADD COLUMN IF NOT EXISTS mesh_rules jsonb NOT NULL DEFAULT '[]';
