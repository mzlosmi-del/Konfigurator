-- Migration 036: Sample texts for template products
-- Adds one 'product' (marketing) and one 'specification' text per template.
-- Also adds the missing RLS policy so authenticated users can read system-workspace texts,
-- and needs clone-template updated separately to copy texts on clone.

-- ── 1. RLS: authenticated reads for system-workspace product_texts ─────────────

CREATE POLICY "product_texts_read_system" ON public.product_texts
  FOR SELECT TO authenticated
  USING (
    product_id IN (
      SELECT id FROM public.products
      WHERE tenant_id = '00000000-0000-0000-0000-000000000000'
    )
  );

-- ── 2. Seed texts ──────────────────────────────────────────────────────────────

DO $$
DECLARE
  sys_tid uuid := '00000000-0000-0000-0000-000000000000';
  pid     uuid;
BEGIN

  -- ── Custom Desk ──────────────────────────────────────────────────────────────
  SELECT id INTO pid FROM public.products WHERE tenant_id = sys_tid AND name = 'Custom Desk';
  INSERT INTO public.product_texts (tenant_id, product_id, label, content, text_type, language, sort_order) VALUES
    (sys_tid, pid, 'Description', 'Our custom desk is built to your exact specifications. Choose from three sizes, premium materials including solid oak and walnut, and select the perfect leg style to complement your workspace. Each piece is crafted to order and delivered ready to use.', 'product', 'en', 0),
    (sys_tid, pid, 'Specifications', E'Available widths: 120 cm / 150 cm / 180 cm\nMaterials: MDF, solid oak, solid walnut\nLeg options: wood or powder-coated metal\nSurface finish: matt lacquer\nDelivery: 3–4 weeks', 'specification', 'en', 1);

  -- ── Bookshelf ────────────────────────────────────────────────────────────────
  SELECT id INTO pid FROM public.products WHERE tenant_id = sys_tid AND name = 'Bookshelf';
  INSERT INTO public.product_texts (tenant_id, product_id, label, content, text_type, language, sort_order) VALUES
    (sys_tid, pid, 'Description', 'A versatile bookshelf that adapts to your space. Configure the width, height and material to create the perfect storage solution for any room — from a compact study shelf to a full-height library wall.', 'product', 'en', 0),
    (sys_tid, pid, 'Specifications', E'Widths: 60 cm / 80 cm / 120 cm\nHeights: 100 cm / 150 cm / 200 cm\nMaterials: pine, MDF, solid oak\nShelf load rating: 25 kg per shelf\nFlat-pack delivery, easy self-assembly', 'specification', 'en', 1);

  -- ── Office Chair ─────────────────────────────────────────────────────────────
  SELECT id INTO pid FROM public.products WHERE tenant_id = sys_tid AND name = 'Office Chair';
  INSERT INTO public.product_texts (tenant_id, product_id, label, content, text_type, language, sort_order) VALUES
    (sys_tid, pid, 'Description', 'Ergonomic seating designed for long working days. Choose your armrest configuration, base type and upholstery to create a chair that supports your body and suits your style. Available in mesh, fabric and genuine leather.', 'product', 'en', 0),
    (sys_tid, pid, 'Specifications', E'Seat height: 42–54 cm (pneumatic)\nLumbar support: adjustable\nArmrests: none / fixed / height-adjustable\nBase: nylon 5-star or polished aluminium\nUpholstery: breathable mesh, fabric or genuine leather\nWeight capacity: 120 kg', 'specification', 'en', 1);

  -- ── Dining Table ─────────────────────────────────────────────────────────────
  SELECT id INTO pid FROM public.products WHERE tenant_id = sys_tid AND name = 'Dining Table';
  INSERT INTO public.product_texts (tenant_id, product_id, label, content, text_type, language, sort_order) VALUES
    (sys_tid, pid, 'Description', 'A dining table crafted to bring your family together. Select the shape, seating capacity and surface material that suits your home — from a cosy 4-person round table to a generous 8-person rectangular centrepiece.', 'product', 'en', 0),
    (sys_tid, pid, 'Specifications', E'Shapes: round / rectangular / oval\nCapacities: 4 / 6 / 8 persons\nSurfaces: MDF, solid oak, solid walnut, tempered glass top\nTable height: 75 cm\nSolid wood legs standard\nLead time: 3–5 weeks', 'specification', 'en', 1);

  -- ── Single Window ────────────────────────────────────────────────────────────
  SELECT id INTO pid FROM public.products WHERE tenant_id = sys_tid AND name = 'Single Window';
  INSERT INTO public.product_texts (tenant_id, product_id, label, content, text_type, language, sort_order) VALUES
    (sys_tid, pid, 'Description', 'A precision-engineered window unit that balances thermal performance with clean aesthetics. Configure the width, height, opening mechanism and glazing level to suit any room orientation and climate.', 'product', 'en', 0),
    (sys_tid, pid, 'Specifications', E'Widths: 60 cm / 90 cm / 120 cm\nHeights: 100 cm / 120 cm / 150 cm\nOpening: fixed / casement / tilt-turn\nGlazing: single / double / triple\nFrame: white PVCU, other colours on request\nU-value: from 0.8 W/m²K (triple glazing)\nInstallation not included', 'specification', 'en', 1);

  -- ── Sliding Door ─────────────────────────────────────────────────────────────
  SELECT id INTO pid FROM public.products WHERE tenant_id = sys_tid AND name = 'Sliding Door';
  INSERT INTO public.product_texts (tenant_id, product_id, label, content, text_type, language, sort_order) VALUES
    (sys_tid, pid, 'Description', 'Bring the outdoors in with our floor-to-ceiling sliding glass door. Configure the width, height and frame material to create a seamless connection between interior and exterior spaces, with smooth soft-close hardware included.', 'product', 'en', 0),
    (sys_tid, pid, 'Specifications', E'Widths: 120 cm / 150 cm / 180 cm\nHeights: 200 cm / 210 cm / 220 cm\nFrame: PVC / aluminium / wood\nGlazing: double tempered safety glass\nHardware: concealed soft-close roller system\nU-value: from 1.1 W/m²K\nSill and installation not included', 'specification', 'en', 1);

  -- ── Bay Window ───────────────────────────────────────────────────────────────
  SELECT id INTO pid FROM public.products WHERE tenant_id = sys_tid AND name = 'Bay Window';
  INSERT INTO public.product_texts (tenant_id, product_id, label, content, text_type, language, sort_order) VALUES
    (sys_tid, pid, 'Description', 'A classic bay window that adds architectural character and floods your room with natural light. Choose from Victorian, Edwardian or modern styles and select your glazing level for the best thermal comfort.', 'product', 'en', 0),
    (sys_tid, pid, 'Specifications', E'Total widths: 120 cm / 150 cm / 180 cm (three-panel configuration)\nStyles: Victorian (45° side panels) / Edwardian (30°) / Modern (flat)\nGlazing: double or triple\nFrame: white PVCU as standard; custom RAL colours available\nIncludes matching bay roof and full flashings\nLead time: 4–6 weeks', 'specification', 'en', 1);

  -- ── Skylight ─────────────────────────────────────────────────────────────────
  SELECT id INTO pid FROM public.products WHERE tenant_id = sys_tid AND name = 'Skylight';
  INSERT INTO public.product_texts (tenant_id, product_id, label, content, text_type, language, sort_order) VALUES
    (sys_tid, pid, 'Description', 'Flood your space with natural daylight from above. Our roof skylight comes in three sizes and can be specified as a fixed unit or with electric venting so you can introduce fresh air at the touch of a button.', 'product', 'en', 0),
    (sys_tid, pid, 'Specifications', E'Sizes: 60×60 cm / 90×90 cm / 120×120 cm\nOpening: fixed or electric venting (24 V motor, remote included)\nGlazing: toughened laminated low-E glass\nRain sensor: included on venting models (auto-close)\nDrainage kerb: 150 mm upstand\n10-year frame warranty, 5-year motor warranty', 'specification', 'en', 1);

END $$;
