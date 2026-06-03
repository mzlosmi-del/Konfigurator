-- Optional min/max bounds for numeric characteristics.
--
-- A characteristic with display_type = 'number' renders a free-form numeric
-- input in the widget. These two nullable columns let an admin constrain the
-- allowed range. Each bound is independently optional (set one, both, or
-- neither). When both are present, min must not exceed max — enforced by the
-- CHECK below. The widget enforces the bounds client-side (HTML min/max + an
-- inline error that blocks inquiry submission).

ALTER TABLE public.characteristics
  ADD COLUMN numeric_min numeric(12,2),
  ADD COLUMN numeric_max numeric(12,2);

ALTER TABLE public.characteristics
  ADD CONSTRAINT characteristics_numeric_bounds_chk
  CHECK (numeric_min IS NULL OR numeric_max IS NULL OR numeric_min <= numeric_max);
