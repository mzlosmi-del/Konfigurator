-- Two new characteristic input types: 'text' and 'color'.
--
-- 'text'  — a multi-line free-text field (e.g. engraving text, custom note).
--           The typed string's character count drives price. It feeds the
--           existing numeric channel, so pricing formulas and rules can
--           reference its length via the existing 'input' node with no engine
--           changes. The numeric_min/numeric_max columns (migration 088) are
--           reused as min/max allowed character length. A built-in
--           price_per_char gives a formula-free per-character charge.
--
-- 'color' — a free-form colour picker; the customer chooses any hex value.
--           Choosing a colour adds the flat color_price_modifier. No
--           characteristic_values rows are needed for either type.

ALTER TABLE public.characteristics
  DROP CONSTRAINT characteristics_display_type_check,
  ADD CONSTRAINT characteristics_display_type_check
    CHECK (display_type IN ('select', 'radio', 'swatch', 'toggle', 'number', 'boolean', 'text', 'color'));

-- text: built-in per-character price (independent of pricing formulas).
ALTER TABLE public.characteristics
  ADD COLUMN price_per_char numeric(12,2) NOT NULL DEFAULT 0;

-- color: flat fee applied when the customer picks a colour.
ALTER TABLE public.characteristics
  ADD COLUMN color_price_modifier numeric(12,2) NOT NULL DEFAULT 0;
