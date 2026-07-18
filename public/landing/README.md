Drop landing-page screenshot images in this folder. Expected filenames (already referenced by
code comments in the components below — once a file exists here, replace the placeholder `<div>`
in that file with a real `<Image>` pointing at it):

- `page-thumb-1.jpg`, `page-thumb-2.jpg`, `page-thumb-3.jpg` — three cropped thumbnails (~160×120px)
  of real, **redacted** sample document pages. Used by `components/landing/WorkspacePreviewCard.tsx`.
- `ocr-extraction-preview.png` — one screenshot (~600×360px) demonstrating OCR extraction (e.g. a
  photographed/scanned page next to its extracted text, or an annotated workspace OCR-review
  screenshot). Used by `app/page.tsx`'s inline OCR card.

See the screenshot checklist in the conversation/PR description for exact capture instructions
(state, viewport, redaction requirements) for each one.
