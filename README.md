# PowerPoint Canvas Controller

[中文说明](README.zh-CN.md) · [MIT License](LICENSE)

PowerPoint Canvas Controller is an open-source Codex plugin and local MCP implementation for
building editable Microsoft PowerPoint slides through PowerPoint's native COM object model. It
draws into the visible desktop application, keeps text/shapes/arrows/pictures editable, and never
uses operating-system mouse or keyboard automation.

> **Platform:** Windows + desktop Microsoft PowerPoint. PowerPoint for the web, WPS Office,
> LibreOffice, macOS, and Linux are not runtime targets because this plugin depends on the
> Windows PowerPoint COM API.

## What it does

| Capability | Details |
| --- | --- |
| Live editing | Create slides and add, update, delete, group, inspect, and screenshot native PowerPoint objects. |
| Editable primitives | Rectangles, rounded rectangles, ellipses, triangles, diamonds, hexagons, parallelograms, clouds, text boxes, lines, attached connectors, and independent pictures. |
| Pacing | `powerpoint_live_draw_sequence` applies one COM edit at a time; the default delay is 100 ms and can be changed per batch. |
| Quality loop | Inspect geometry and text, render a PowerPoint screenshot, detect text overflow and off-slide objects, then refine in place. |
| Deliverables | Save an editable `.pptx`; export a slide as PNG/JPG at an exact pixel width; export the presentation as PDF. |
| Safety | Uses named targets, reuses the active presentation by default, and requires `confirm: true` for clearing a slide or closing a presentation. |
| Runtime | Dependency-free Node.js MCP servers plus a Windows PowerShell bridge; no npm package installation is required. |

## How it works

```text
Codex
  │ MCP over stdio
  ▼
Node.js server (live or file utilities)
  │ temporary request JSON
  ▼
PowerShell bridge
  │ native COM calls
  ▼
Visible desktop Microsoft PowerPoint
```

The bridge edits PowerPoint's object model directly. It does not synthesize XML first, open a
pre-generated file, or inject OS-level input events. Pictures remain separate PowerPoint picture
objects; labels, arrows, panels, and other shapes are not baked into a raster image.

## Requirements

- Windows 10 or Windows 11
- Desktop Microsoft PowerPoint (Microsoft 365 or a supported perpetual desktop release)
- Codex desktop app or Codex CLI with plugin support
- Node.js 18 or newer (Node.js 22+ is recommended)
- Windows PowerShell 5.1 or PowerShell 7+
- Git, if installing from the repository

No npm dependencies are needed. PowerPoint must be installed on the same Windows machine as the
MCP servers.

## Install

This repository is the plugin root. It is not a repository-level marketplace catalog, so a fresh
install registers the cloned folder in Codex's personal marketplace first.

### Fresh install from GitHub (PowerShell)

The following commands clone the plugin to the standard personal-plugin location, create or update
the personal marketplace entry, and install it. Existing marketplace entries are preserved; only
the entry for this plugin is replaced.

```powershell
$pluginRoot = Join-Path $HOME "plugins\powerpoint-canvas-controller"
$marketplacePath = Join-Path $HOME ".agents\plugins\marketplace.json"

New-Item -ItemType Directory -Force -Path (Split-Path $pluginRoot -Parent) | Out-Null
if (Test-Path (Join-Path $pluginRoot ".git")) {
  git -C $pluginRoot pull --ff-only
} elseif (Test-Path $pluginRoot) {
  throw "The install directory exists but is not this Git repository: $pluginRoot"
} else {
  git clone https://github.com/wangzian828/powerpoint-canvas-controller.git $pluginRoot
}

New-Item -ItemType Directory -Force -Path (Split-Path $marketplacePath -Parent) | Out-Null
if (Test-Path $marketplacePath) {
  $catalog = Get-Content -Raw -LiteralPath $marketplacePath | ConvertFrom-Json
} else {
  $catalog = [pscustomobject]@{
    name = "personal"
    interface = [pscustomobject]@{ displayName = "Personal" }
    plugins = @()
  }
}

$entry = [pscustomobject]@{
  name = "powerpoint-canvas-controller"
  source = [pscustomobject]@{ source = "local"; path = "./plugins/powerpoint-canvas-controller" }
  policy = [pscustomobject]@{ installation = "AVAILABLE"; authentication = "ON_INSTALL" }
  category = "Productivity"
}
$catalog.plugins = @($catalog.plugins | Where-Object { $_.name -ne $entry.name }) + $entry
$catalog | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $marketplacePath -Encoding utf8

$marketplaceName = $catalog.name
codex plugin add "powerpoint-canvas-controller@$marketplaceName"
```

After installation, restart Codex and start a new thread so the skill and both MCP servers are
loaded. If you already maintain the standard personal marketplace entry, the final install step
is simply:

```powershell
codex plugin add powerpoint-canvas-controller@personal
```

### Ask Codex to install it

In a Codex task with terminal access, you can use this request:

```text
Install https://github.com/wangzian828/powerpoint-canvas-controller.
Clone it to ~/plugins/powerpoint-canvas-controller, register that local folder in the personal
Codex marketplace, install powerpoint-canvas-controller, validate the plugin, and tell me when I
should restart Codex. Do not open PowerPoint during installation.
```

## Use it

Start a new Codex thread after installation, mention **PowerPoint Canvas Controller**, and provide
the slide or reference material. A good first request is:

```text
Use PowerPoint Canvas Controller. Work in the active PowerPoint presentation and do not open a
second presentation unless no suitable target exists. Use only PowerPoint's native COM API; do not
control the OS mouse or keyboard. Recreate this figure as editable text, shapes, arrows, connectors,
and pictures. Draw one logical region at a time with a 100 ms delay, inspect and screenshot after
each region, correct overflow and crooked connectors, then save the editable PPTX and export a
2000 px-wide PNG preview.
```

Chinese prompts work equally well:

```text
使用 PowerPoint Canvas Controller。优先复用当前活动的 PowerPoint 演示文稿，不要打开第二个文稿，
除非没有合适的目标。只能调用 PowerPoint 原生 COM API，不能控制系统鼠标键盘。把这张图重建为
可编辑的文字、形状、箭头、连接符和图片；按 100 ms 的步骤逐个绘制逻辑区域，每个区域完成后
检查截图，修正溢出和歪曲的连接线，最后保存可编辑 PPTX，并导出宽度为 2000 px 的 PNG 预览图。
```

## One-presentation rule

The plugin is designed to keep a live session tidy:

1. Check `powerpoint_live_status` before creating anything.
2. Reuse the active presentation or an explicitly supplied `presentation_path` whenever possible.
3. Call `powerpoint_live_new_presentation` only when no suitable target exists or a new deck was
   explicitly requested.
4. Keep one named target throughout a drawing task; do not create a new deck for every region or
   test case.
5. The bundled self-test creates exactly one temporary presentation, reuses it, and closes that
   exact presentation in a `finally` block.

When several user presentations are open, pass the full presentation path rather than relying on
the active window. The plugin does not intentionally modify unrelated presentations, but an
explicit path is the safest choice in a multi-window session.

## MCP servers and tools

The plugin exposes two stdio MCP servers through [`.mcp.json`](.mcp.json).

### `powerpoint-live`

Live operations against the visible PowerPoint application:

`powerpoint_live_launch` · `powerpoint_live_status` · `powerpoint_live_new_presentation` ·
`powerpoint_live_add_slide` · `powerpoint_live_add_shape` · `powerpoint_live_add_text` ·
`powerpoint_live_add_line` · `powerpoint_live_add_connector` · `powerpoint_live_add_picture` ·
`powerpoint_live_update_shape` · `powerpoint_live_delete_shape` ·
`powerpoint_live_group_shapes` · `powerpoint_live_draw_sequence` · `powerpoint_live_clear` ·
`powerpoint_live_close_presentation` · `powerpoint_live_inspect` ·
`powerpoint_live_screenshot`

`powerpoint_live_draw_sequence` supports these operation types: `shape`, `text`, `line`,
`connector`, `picture`, `update`, `delete`, and `wait`.

### `powerpoint-file-utils`

File-oriented operations that still use PowerPoint's own renderer and object model:

`powerpoint_file_inspect` · `powerpoint_file_validate` · `powerpoint_file_save` ·
`powerpoint_file_export_slide` · `powerpoint_file_export_pdf`

Inspection and validation open an explicitly named file read-only and close it without saving by
default. Existing output files require `overwrite: true`. See the complete field reference in
[`skills/control-powerpoint-canvas/references/tool-reference.md`](skills/control-powerpoint-canvas/references/tool-reference.md).

## Minimal batch example

Coordinates and sizes are PowerPoint points (`72 pt = 1 inch`). A common 16:9 slide is `960 × 540`
points, and colors use `#RRGGBB`.

```json
{
  "step_delay_ms": 100,
  "screenshot_after": true,
  "operations": [
    {
      "type": "shape",
      "name": "input_card",
      "shape_type": "rounded",
      "text": "Input",
      "x": 80,
      "y": 210,
      "width": 210,
      "height": 90,
      "fill_color": "#EEF4FC",
      "line_color": "#17345B",
      "line_width": 2,
      "font_size": 20,
      "bold": true
    },
    {
      "type": "shape",
      "name": "model_card",
      "shape_type": "rounded",
      "text": "Model",
      "x": 375,
      "y": 210,
      "width": 210,
      "height": 90
    },
    {
      "type": "connector",
      "name": "input_to_model",
      "source": "input_card",
      "target": "model_card",
      "connector_type": "straight",
      "end_arrow": "triangle"
    }
  ]
}
```

Use native connectors when an arrow should remain attached while a shape moves. Use a straight line
when exact fixed coordinates matter. Give every object a stable semantic name; later updates and
deletions address objects by that name.

## Recommended drawing workflow

The bundled skill follows this sequence:

1. Read the current status and slide dimensions.
2. Establish the visual hierarchy and reusable object names.
3. Draw one logical region with a paced batch (`step_delay_ms: 100`).
4. Call `powerpoint_live_screenshot` and `powerpoint_live_inspect`.
5. Fix overlaps, text balance, information density, off-slide geometry, and connector routing
   before moving to the next region.
6. Run `powerpoint_file_validate` before delivery.
7. Save the editable `.pptx` with `powerpoint_file_save`.
8. Export a PNG/JPG preview with `powerpoint_file_export_slide`; set `width_px: 2000` when a 2000 px
   preview is requested. Use `powerpoint_file_export_pdf` for a PDF deliverable.

Avoid adding filler micro-labels merely to cover empty space. Improve density through meaningful
content, larger useful text, tighter spacing, and explicit relationships.

## Safety and privacy

- All live edits go through PowerPoint's native COM object model.
- The plugin never synthesizes XML as a first step and never sends OS-level mouse or keyboard
  events.
- `powerpoint_live_clear` and `powerpoint_live_close_presentation` require `confirm: true`.
- Closing a presentation does not quit PowerPoint; save behavior is explicit.
- Read-only inspection and validation close files without saving by default.
- Temporary bridge request files are created locally and removed after each call.
- No hosted backend, telemetry, or plugin-specific credential store is included.
- Do not upload confidential slides, reference images, or exported presentations to issues or pull
  requests.

## Repository layout

```text
.
├── .codex-plugin/plugin.json                 # Plugin manifest and UI metadata
├── .mcp.json                                 # The two stdio MCP server definitions
├── scripts/
│   ├── live-server.mjs                       # Live PowerPoint MCP server
│   ├── file-server.mjs                       # File inspect/save/export MCP server
│   ├── mcp-common.mjs                        # JSONL MCP and PowerShell bridge helpers
│   ├── powerpoint-bridge.ps1                 # Native PowerPoint COM implementation
│   └── self-test.mjs                          # Single-presentation integration test
├── skills/control-powerpoint-canvas/
│   ├── SKILL.md                              # Drawing and review workflow
│   ├── agents/openai.yaml                    # Skill UI metadata
│   └── references/tool-reference.md          # Operation fields and examples
├── LICENSE
└── README.md / README.zh-CN.md
```

## Development and validation

Run the self-test only on a Windows machine with desktop PowerPoint installed. It opens one
temporary presentation, exercises both MCP servers, saves and exports artifacts under the chosen
directory, validates the result, and closes the test presentation in `finally`:

```powershell
node .\scripts\self-test.mjs .\test-output
```

The generated `test-output/` directory is ignored by Git. Useful static checks are:

```powershell
node --check .\scripts\file-server.mjs
node --check .\scripts\live-server.mjs
node --check .\scripts\mcp-common.mjs
node --check .\scripts\self-test.mjs
```

For plugin and skill schema validation, use the validators shipped with the Codex plugin-creator
and skill-creator tools:

```powershell
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$skillCreator = Join-Path $codexHome "skills\.system\skill-creator"
$pluginCreator = Join-Path $codexHome "skills\.system\plugin-creator"
python (Join-Path $skillCreator "scripts\quick_validate.py") `
  .\skills\control-powerpoint-canvas
python (Join-Path $pluginCreator "scripts\validate_plugin.py") .
```

## Troubleshooting

### The plugin is not visible in Codex

Restart Codex and start a new thread. Confirm that the marketplace entry points to the cloned
folder and that `codex plugin list` shows the plugin as installed and enabled.

### PowerPoint is not found or the bridge times out

Confirm that desktop PowerPoint is installed and can be launched normally. Close modal Office
dialogs, use a full `presentation_path` when multiple decks are open, and retry `powerpoint_live_status`.
The plugin cannot control PowerPoint for the web or WPS Office.

### Text is clipped or an arrow is misplaced

Run `powerpoint_live_inspect` and `powerpoint_live_screenshot` after the affected logical region.
Use `powerpoint_live_update_shape` for targeted geometry, margins, font size, or z-order changes;
use a named native connector instead of a free-floating line when the endpoints should follow shapes.

### Export fails

Check that the destination directory exists and that an existing file is only replaced with
`overwrite: true`. Try exporting the same slide manually from desktop PowerPoint to distinguish an
Office rendering issue from a plugin issue.

## Contributing

Issues and pull requests are welcome. Include the Windows version, PowerPoint version, Codex
version, Node.js version, the exact tool call, and relevant error text. Please do not commit
generated `.pptx`, PNG, PDF, confidential reference images, or local test output.

## License

MIT © 2026 [wangzian828](https://github.com/wangzian828)
