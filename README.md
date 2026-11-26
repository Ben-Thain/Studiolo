# templates-pack (Studiolo originals, v1)

Copy into the repo as described in prompt 06b: `templates-pack/<id>/template.json` → `src/templates/<id>/template.json`,
`*.webp` and `thumb-*.webp` → `public/templates/<id>/`. Ids: blank, still, plinth, linen, gouache, folio.
Content uses `assetKey` (file name without extension) instead of `assetId`, `{{site.name}}` in the header brand text,
local ids (`p_01`, `s_05`, `e_06`) that the create path replaces with uuids, and `sample: true` on sample text and images.
`layouts` is keyed by element id, then `desktop` / `mobile`. Photos: see CREDITS.md (Pexels License).
