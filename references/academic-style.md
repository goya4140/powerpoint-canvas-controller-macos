# Academic Figure Style

“CCF-A style” is not a formal visual standard. Use the recurring conventions of major AI conference papers: restrained, legible, structured, and publication-oriented.

## Composition

- Use a single dominant reading direction.
- Keep standard modules compact and give the claimed contribution more area.
- Group by hierarchy, modality, or processing stage rather than decoration.
- Use whitespace to separate semantic groups.
- Avoid unnecessary shadows, gradients, faux 3D, gloss, and ornamental icons.

## Typography

- Prefer a widely available sans-serif font such as Arial, Aptos, or Helvetica.
- Use one font family and at most three weights.
- Keep labels concise; move explanations into captions when possible.
- Test the figure at its final paper width. Text that is readable on a full slide may fail in a two-column PDF.
- Preserve mathematical notation exactly as provided by the user.

## Color

- Use neutral structure plus two to four low-saturation semantic colors.
- Assign colors consistently to roles such as input, representation, novel module, supervision, and output.
- Do not use color as the only carrier of meaning; combine it with labels, outlines, or patterns.
- Check grayscale separation and sufficient text/background contrast.

Suggested base palette:

| Role | Fill | Stroke |
| --- | --- | --- |
| neutral | `#F3F5F7` | `#68727D` |
| representation | `#DDEBF7` | `#3979A8` |
| proposed module | `#DDF2EA` | `#2E8064` |
| auxiliary signal | `#FCE8DC` | `#B7683A` |
| output | `#EEE7F7` | `#72539A` |

## Lines and shapes

- Keep outer strokes visually consistent.
- Use solid arrows for the main data path and dashed arrows for optional, auxiliary, or supervisory paths.
- Limit corner-radius variation.
- Avoid crossing connectors. Reroute, reorder, or split the diagram when crossings remain ambiguous.
- Use repeated geometry only for repeated semantics.
- Treat semantic color as structure: neutral context, blue representation/model, green proposed module, orange auxiliary/tool signal, purple output, and red risk or rejection.
- Keep Level 1 free of decorative icons. A later asset replacement must inherit the node's role and contrast behavior.

## Paper checks

- Render a double-column candidate around 170–180 mm wide and a single-column candidate around 80–90 mm wide when applicable.
- Inspect grayscale when the palette carries important distinctions.
- Confirm that thin strokes survive PDF export and page scaling.
