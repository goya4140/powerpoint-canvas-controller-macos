# Reference recreation benchmark

This directory contains the source-controlled inputs for the 1 → 1 academic-figure recreation benchmark.

- `manifest.json` defines the ordered benchmark set.
- `cases/*.json` contains one editable scene specification per reference figure.
- Source images, generated previews, comparisons, and the combined PPTX are written under `docs/benchmark/`.

Run:

```bash
npm run validate:reference
npm run build:reference
npm run check:reference
```

Every case must include a published-paper URL, Figure number, reference crop, reconstruction rationale, 1200 × 600 canvas, and stable element names.

The benchmark currently covers 10 figures from ICLR, NeurIPS, ACL, ICML, CVPR, and EMNLP 2024.
