# Design reference images

These are the mockup images the build prompts point to. Each folder is named after the prompt that uses it, for example `docs/refs/08-site-settings/` for prompt 08 (and its parts 08a, 08b and so on). Folders can repeat an image when several prompts use it.

- Use them as design references only. Each prompt says which details are binding and which are sample data.
- Don't edit, rename or optimise these files. They are replaced as a set when the mockups change.
- Don't ship them. Nothing in `src/` or `public/` should import or link to `docs/refs/`.

Name prefixes: `d-` desktop frame (1440×900 @2x), `m-` mobile frame (393×852 @2x), `live-` and `app-` full-page frames, `detail-` older crops for interaction details only, and `_board` or `board-` overviews.
