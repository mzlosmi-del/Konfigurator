# Storage orphan cleanup for visualization assets

**Date:** 2026-05-26
**Status:** Approved

## Problem

Uploading a 3D object (or image/render) through the admin panel writes to two
places:

- the `product-assets` Supabase Storage bucket, at
  `{tenantId}/{productId}/{timestamp}.{ext}` (`uploadAssetFile` in
  `configurator-admin/src/lib/assets.ts`), and
- a `visualization_assets` DB row holding the public URL (`createAsset`).

Removing the asset (`deleteAsset`) deletes **only the DB row**. The storage file
is never removed, so it is orphaned in the bucket indefinitely. The same leak
occurs on product deletion (`deleteProduct`): the DB cascades the
`visualization_assets` rows, but storage files are a separate system and survive.

There is no cleanup trigger, edge function, or storage lifecycle policy anywhere
in the migrations. By contrast, quotation attachments
(`configurator-admin/src/lib/quotationAttachments.ts`) already call
`supabase.storage.from(BUCKET).remove([path]).catch(() => {})` on delete — the
leak is specific to `visualization_assets`.

## Goal

When a visualization asset, or a whole product, is removed, also delete the
underlying file(s) from the `product-assets` bucket — but only files we actually
host, and never blocking the delete on a storage error.

## Design

### `configurator-admin/src/lib/assets.ts`

**New helper `storagePathForAssetUrl(url: string): string | null`**

Returns the bucket-relative storage path (`{tenantId}/{productId}/{file}`) only
if `url` is a Supabase public URL into our `product-assets` bucket; returns
`null` for external / pasted URLs and URLs for any other bucket.

Detection: Supabase public URLs contain the segment
`/storage/v1/object/public/product-assets/`. Split on that marker and take the
remainder as the path. No match → `null` (leave the file alone). This honours
the existing confirm-dialog caveat that externally hosted files are not deleted.

**`deleteAsset(id)` — changed flow**

1. Fetch the row's `url` (`select('url').eq('id', id)`).
2. Delete the DB row.
3. If `storagePathForAssetUrl(url)` is non-null, call
   `supabase.storage.from('product-assets').remove([path]).catch(() => {})`.

Order is DB row first, then storage, so a storage failure can never leave a
dangling DB row pointing at a deleted file. Worst case is the orphan we already
tolerate today (best-effort, never block).

### `configurator-admin/src/lib/products.ts`

**`deleteProduct(id)` — changed flow**

1. Fetch the product's `visualization_assets` urls.
2. Map through `storagePathForAssetUrl`, filter out nulls.
3. If any paths remain, `supabase.storage.from('product-assets').remove(paths).catch(() => {})`
   (single batched call).
4. Delete the product row (DB cascades the asset rows).

Best-effort: storage errors are swallowed and never block the delete.

## Failure mode

Best-effort, matching the existing `quotationAttachments` pattern
(`.remove().catch(() => {})`). A leaked file is harmless; a blocked delete is
annoying. Worst case equals today's behaviour.

## Tests

Add unit tests to `configurator-admin/src/__tests__/assets.test.ts` for
`storagePathForAssetUrl`:

- a real `product-assets` public URL → correct bucket-relative path
- an external URL → `null`
- a public URL for a different bucket → `null`

## Out of scope / not changing

- Upload path (`uploadAssetFile`, `createAsset`) — unchanged.
- Confirm-dialog copy in `VisualizationPanel.tsx` — left as-is (user decision).
- No migration needed: migration 025's `product-assets: tenant manage` RLS
  policy is `FOR ALL`, so `remove` is already permitted on the tenant's folder.
