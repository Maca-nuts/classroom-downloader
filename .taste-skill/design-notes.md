# Classroom Downloader UI refinement

## Direction

- Product: Students save Google Classroom course attachments as a filtered ZIP archive.
- Character: Calm, exact, practical.
- World: Course handouts filed together at a study desk; retain the existing sage-neutral ground, green mark and Geist/Noto Sans JP typography.
- Moments: The ZIP filename and nested course/assignment/file structure form the main preview; actual download counts and progress carry the result.
- Signature: The folder-and-download mark and the nested archive structure connect the product name to its output.

Question: Which course materials will this ZIP contain?

The before screen has light slop. Preserve its features, section order, layout, palette and type. Use the achromatic-ledger reference for quiet chrome and regular-weight counts (seed 608430041); its newly dealt no-sidebar shell is not applied because this is a refinement of an existing app.

## Audit

- Most supporting text is 11–12px (49% under 13px in the before inspection); enlarge it to 13px.
- Spacing includes isolated 5/7/9/10/22/26/30/38/42px values; use a consistent 4px rhythm, retaining 2px optical details where useful.
- Three separate settings cards fragment the single course/filter/archive task; retain their order inside one sheet with section separators.
- The archive structure lacks a clear shared frame; group the filename and tree as one preview.
- The disabled download action relies on opacity; give disabled controls an explicit neutral surface and readable text.
- Long disconnected-state select copy is truncated on mobile; shorten it and keep the instruction in the visible status region.
- Captions have trailing sentence punctuation and repeated instructions; shorten them.

No gradients, emoji labels, vanity claims, decorative charts, looping motion or fabricated course data were found. No image generation is needed for this working form.

## Nine passes

1. Spacing: 240px sidebar, 32px desktop canvas gutters, 24px section/panel spacing, 16px related-field gaps and 44px input heights. Optical icon strokes and borders remain small.
2. Color: Retain the sage-neutral ground and green brand mark. Primary action stays near-black. Disabled states are explicit neutral fills with full-opacity text.
3. Icons: Retain the flat brand mark and functional archive/download line drawings. Remove the redundant refresh character from the course action.
4. Copy: Name Google Classroom in the page description, make the connection instruction actionable and shorten empty-state captions. No new features or claims.
5. Type: Keep Geist and Noto Sans JP at 400/500. Remove the unused 700 font request. Supporting text is 13px, fields/body 14px, section titles 16px and the page title 24px (22px on phones). Counts use tabular figures.
6. Layout: Keep the existing sidebar, two columns and section order. Group settings into one sheet; keep preview/results/logs as independently sized right-column panels. Stack in source order on mobile.
7. Details: 12px panel radii, 8px controls and nested archive frame, 4px segmented items. Add a keyboard skip link and retain visible focus states. No empty panel is stretched to fill space.
8. Visuals: Frame the existing archive tree together with its filename on a neutral header strip. The tree illustrates organization, not a fetched attachment inventory. No illustrative assets, prompts or sample data added to production.
9. Motion: Keep only brief explicit background/border/press feedback and reduced-motion support. No entrance animations or loops.

## Verification and critique

- JavaScript syntax check and source lint: pass, lint 0 FAIL / 0 WARN.
- Reused existing browser smoke checks: 16 pass, no runtime exceptions. Includes mocked OAuth, course loading, filters, invalid inputs, actual ZIP contents, partial failure, progress, log clearing, expired authorization and disconnect.
- Google services are mocked for functional verification; no real account authorization or private classroom data is accessed.
- Before inspection: 0 FAIL / 2 WARN at 1440, 768 and 390px.
- Final inspection: 0 FAIL / 1 WARN at the same widths. All six final fold/full-page screenshot sheets were reviewed.
- Remaining warning: the settings sheet and the right rail end 121px apart at tablet width. These are independent form/result columns, not peer cards. Keeping content-height panels avoids adding blank padding to the results, and the footer follows both columns.
- Visual critique: the settings task now reads as one form, archive grouping is explicit, numbers remain honest zeros, phone controls fit without horizontal overflow and every section remains available. The mobile page is intentionally long because all original settings and results stay in reading order. Real OAuth consent was not exercised.

Refinement workflow: [unslop](https://heydamir.design/unslop) by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0; additional browser verification with design-taste-frontend.
