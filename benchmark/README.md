# Semantic-sketch archive (not strict 1 → 1)

The cases in `cases/` are retained as examples of semantic decomposition. They rewrite, omit, and normalize visible content, so they do **not** count as 1 → 1 recreations.

Strict accepted cases live in `strict/` and must pass `npm run qa:strict`.

- `manifest.json` defines the ordered benchmark set.
- `cases/*.json` contains one editable scene specification per reference figure.
- Source images, generated previews, comparisons, and the combined PPTX are written under `docs/benchmark/`.

Run:

```bash
npm run validate:reference
npm run build:reference
npm run check:reference
```

Every legacy sketch includes a published-paper URL, Figure number, reference crop, reconstruction rationale, 1200 × 600 canvas, and stable element names.

The archive contains 10 semantic sketches from ICLR, NeurIPS, ACL, ICML, CVPR, and EMNLP 2024. They remain excluded from the strict pass count until independently rebuilt and accepted by the strict gate.
