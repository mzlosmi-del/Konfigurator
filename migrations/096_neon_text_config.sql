-- Live neon text preview — opt-in config for 'text' characteristics.
--
-- Strictly additive. A new nullable JSONB column on characteristics holds the
-- neon-preview settings. NULL (the default for every existing row) means the
-- feature is OFF: the characteristic renders exactly as it does today. Only a
-- 'text' characteristic whose neon_config.enabled is true shows the glowing
-- live preview in the widget.
--
-- The typed string's character count already drives price through the existing
-- 'text' channel (it is mirrored into the numeric input — see migration 089
-- text_color_characteristic and the widget's handleTextInput), so NO pricing,
-- inquiry, or PDF changes are needed. neon_config is a presentation layer only.
--
-- Shape (validated in the app, not the DB):
--   {
--     "enabled":        boolean,
--     "label_slot":     string  | null,   -- optional custom-label text slot
--     "maxLength":      number  | null,   -- UI cap (default 30); numeric_max stays the priced bound
--     "fonts":          string[],         -- subset of the bundled font keys; first = default
--     "colorCharId":    string  | null,   -- sibling colour/swatch characteristic that drives the glow
--     "glowColorMap":   { [value_id]: hex },  -- optional per-value glow override
--     "defaultGlowHex": string  | null    -- fallback glow colour
--   }
--
-- RLS: inherited from the existing characteristics table policies — no new
-- policy needed (same table, same tenant_id gate via auth_tenant_id()).

ALTER TABLE public.characteristics
  ADD COLUMN neon_config jsonb;   -- nullable, default NULL = feature off
