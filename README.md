# PowerPoint Canvas Controller

A local Codex plugin that controls Microsoft PowerPoint through the native COM object model. It
keeps slides editable and never uses operating-system mouse, keyboard, or screen automation.

## Requirements

- Windows 10/11
- Desktop Microsoft PowerPoint
- Node.js 18 or newer
- Windows PowerShell 5.1 or PowerShell 7+
- Codex CLI (for plugin installation)

## Implemented services

- `powerpoint-live`: launch/attach, create slides, add/update/delete/group editable shapes, text, pictures, lines and attached connectors, run paced batches, inspect, clear safely, close a named temporary presentation, and return PowerPoint-rendered screenshots.
- `powerpoint-file-utils`: inspect PPTX files, detect text overflow and off-slide objects, save editable PPTX files, and export PNG/JPG/PDF through PowerPoint.

PowerPoint coordinates use points. Batch drawing defaults to a 100 ms operation interval. The implementation requires Windows, Node.js, Windows PowerShell, and desktop Microsoft PowerPoint; it has no npm dependencies.

## Install in Codex

Install the plugin from the personal marketplace after cloning or downloading this repository:

```powershell
codex plugin add powerpoint-canvas-controller@personal
```

Start a new Codex thread after installation so the MCP servers and skill are loaded.

## Safety and scope

The live service attaches to the active PowerPoint instance when possible and reuses the selected
presentation. It does not enumerate or modify unrelated presentations. File writes, clearing a
slide, and closing a presentation are explicit operations. The bridge invokes PowerPoint's COM
API directly; it does not synthesize OS input events.

Run the single-presentation integration test with:

```powershell
node .\scripts\self-test.mjs .\test-output
```

The test creates exactly one temporary presentation, reuses it for every operation, and closes it in a `finally` block.

## License

MIT. See [LICENSE](LICENSE).
