# PowerPoint Canvas Controller

[English](README.md) · [MIT 许可证](LICENSE)

PowerPoint Canvas Controller 是一个开源 Codex 插件和本地 MCP 实现，用于通过 Microsoft
PowerPoint 原生 COM 对象模型创建和修改可编辑幻灯片。它直接绘制到可见的桌面版 PowerPoint
中，文字、形状、箭头、连接符和图片都保持可编辑，并且不会使用操作系统级鼠标或键盘自动化。

> **运行平台：** Windows + 桌面版 Microsoft PowerPoint。由于依赖 Windows PowerPoint COM
> API，本插件不支持 PowerPoint 网页版、WPS Office、LibreOffice、macOS 或 Linux 运行时。

## 功能概览

| 能力 | 说明 |
| --- | --- |
| 实时编辑 | 创建幻灯片，添加、更新、删除、组合、检查原生 PowerPoint 对象，并返回 PowerPoint 渲染截图。 |
| 可编辑图元 | 矩形、圆角矩形、椭圆、三角形、菱形、六边形、平行四边形、云形、文本框、直线、连接符和独立图片。 |
| 分步绘制 | `powerpoint_live_draw_sequence` 将每次 COM 编辑分开执行；默认间隔 100 ms，也可以按批次调整。 |
| 质量检查 | 检查几何位置和文字，渲染 PowerPoint 截图，检测文字溢出及越界对象，再原位修正。 |
| 交付文件 | 保存可编辑 `.pptx`；按精确像素宽度导出 PNG/JPG；通过 PowerPoint 导出 PDF。 |
| 安全边界 | 默认复用当前活动演示文稿；清空幻灯片或关闭演示文稿必须显式传入 `confirm: true`。 |
| 运行时 | 无第三方 npm 依赖的 Node.js MCP 服务 + Windows PowerShell 桥接；不需要安装 npm 包。 |

## 工作原理

```text
Codex
  │ stdio 上的 MCP
  ▼
Node.js 服务（实时服务或文件服务）
  │ 临时请求 JSON
  ▼
PowerShell 桥接
  │ 原生 COM 调用
  ▼
可见的桌面版 Microsoft PowerPoint
```

桥接脚本直接修改 PowerPoint 对象模型，不会先生成 XML，也不会打开预生成文件，更不会注入
系统级鼠标或键盘事件。图片始终是独立的 PowerPoint 图片对象；文字、箭头、分区等不会被烘焙
进一张栅格图。

## 环境要求

- Windows 10 或 Windows 11
- 桌面版 Microsoft PowerPoint（Microsoft 365 或受支持的永久版桌面版本）
- 支持插件的 Codex 桌面应用或 Codex CLI
- Node.js 18 或更高版本（推荐 Node.js 22+）
- Windows PowerShell 5.1 或 PowerShell 7+
- Git（从仓库安装时需要）

不需要安装 npm 依赖。MCP 服务所在的 Windows 机器必须安装桌面版 PowerPoint。

## 安装

本仓库本身就是插件根目录，不是一个“仓库级 marketplace 根目录”。全新安装时，需要先把
克隆后的目录登记到 Codex 的个人 marketplace 中。

### 从 GitHub 全新安装（PowerShell）

下面的命令会把插件克隆到个人插件的标准位置，创建或更新个人 marketplace 条目，并安装插件。
已有的其他 marketplace 条目会保留，只会替换本插件自己的条目。

```powershell
$pluginRoot = Join-Path $HOME "plugins\powerpoint-canvas-controller"
$marketplacePath = Join-Path $HOME ".agents\plugins\marketplace.json"

New-Item -ItemType Directory -Force -Path (Split-Path $pluginRoot -Parent) | Out-Null
if (Test-Path (Join-Path $pluginRoot ".git")) {
  git -C $pluginRoot pull --ff-only
} elseif (Test-Path $pluginRoot) {
  throw "安装目录已存在，但不是这个 Git 仓库：$pluginRoot"
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

安装完成后重启 Codex，并新建一个对话，让 Skill 和两个 MCP 服务被重新加载。如果你已经有
标准的个人 marketplace 条目，最后一步可以直接使用：

```powershell
codex plugin add powerpoint-canvas-controller@personal
```

### 让 Codex 代为安装

在一个具备终端权限的 Codex 任务里，可以直接发送：

```text
安装 https://github.com/wangzian828/powerpoint-canvas-controller。
把它克隆到 ~/plugins/powerpoint-canvas-controller，将这个本地目录登记到个人 Codex marketplace，
安装 powerpoint-canvas-controller，验证插件，并告诉我何时重启 Codex。安装期间不要打开 PowerPoint。
```

## 使用方法

安装后重启 Codex 并新建对话，提到 **PowerPoint Canvas Controller**，然后提供幻灯片或参考素材。
可以从下面这个提示词开始：

```text
使用 PowerPoint Canvas Controller。优先复用当前活动的 PowerPoint 演示文稿，不要打开第二个文稿，
除非没有合适的目标。只能调用 PowerPoint 原生 COM API，不能控制系统鼠标键盘。把这张图重建为
可编辑的文字、形状、箭头、连接符和图片；按 100 ms 的步骤逐个绘制逻辑区域，每个区域完成后
检查截图，修正溢出和歪曲的连接线，最后保存可编辑 PPTX，并导出宽度为 2000 px 的 PNG 预览图。
```

英文提示词同样有效：

```text
Use PowerPoint Canvas Controller. Work in the active PowerPoint presentation and do not open a
second presentation unless no suitable target exists. Use only PowerPoint's native COM API; do not
control the OS mouse or keyboard. Recreate this figure as editable text, shapes, arrows, connectors,
and pictures. Draw one logical region at a time with a 100 ms delay, inspect and screenshot after
each region, correct overflow and crooked connectors, then save the editable PPTX and export a
2000 px-wide PNG preview.
```

## 单演示文稿规则

插件的设计目标是让实时会话保持整洁：

1. 创建任何对象前先调用 `powerpoint_live_status`。
2. 尽可能复用当前活动演示文稿，或复用明确传入的 `presentation_path`。
3. 只有在没有合适目标，或用户明确要求新建文稿时，才调用 `powerpoint_live_new_presentation`。
4. 一个绘制任务从头到尾保持同一个命名目标；不要为每个逻辑区域或每个测试用例创建新文稿。
5. 随附的自测脚本只创建一个临时演示文稿，反复复用，并在 `finally` 中关闭这个精确目标。

如果同时打开了多个用户演示文稿，建议传入完整的 `presentation_path`，不要依赖当前活动窗口。
插件不会主动修改无关演示文稿，但显式路径是多窗口场景下最安全的做法。

## MCP 服务与工具

插件通过 [`.mcp.json`](.mcp.json) 暴露两个 stdio MCP 服务。

### `powerpoint-live`

针对可见 PowerPoint 应用的实时操作：

`powerpoint_live_launch` · `powerpoint_live_status` · `powerpoint_live_new_presentation` ·
`powerpoint_live_add_slide` · `powerpoint_live_add_shape` · `powerpoint_live_add_text` ·
`powerpoint_live_add_line` · `powerpoint_live_add_connector` · `powerpoint_live_add_picture` ·
`powerpoint_live_update_shape` · `powerpoint_live_delete_shape` ·
`powerpoint_live_group_shapes` · `powerpoint_live_draw_sequence` · `powerpoint_live_clear` ·
`powerpoint_live_close_presentation` · `powerpoint_live_inspect` ·
`powerpoint_live_screenshot`

`powerpoint_live_draw_sequence` 支持以下操作类型：`shape`、`text`、`line`、`connector`、`picture`、
`update`、`delete` 和 `wait`。

### `powerpoint-file-utils`

仍然使用 PowerPoint 自身渲染器和对象模型的文件操作：

`powerpoint_file_inspect` · `powerpoint_file_validate` · `powerpoint_file_save` ·
`powerpoint_file_export_slide` · `powerpoint_file_export_pdf`

检查和验证默认以只读方式打开明确指定的文件，并在完成后不保存地关闭。已有输出文件必须传入
`overwrite: true` 才会替换。完整字段说明见
[`skills/control-powerpoint-canvas/references/tool-reference.md`](skills/control-powerpoint-canvas/references/tool-reference.md)。

## 最小批量绘制示例

坐标和尺寸使用 PowerPoint point（`72 pt = 1 inch`）。常见 16:9 幻灯片是 `960 × 540` point，颜色
使用 `#RRGGBB`。

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

当箭头需要跟随形状移动时，使用原生连接符；需要精确固定几何位置时，使用直线。为每个对象
设置稳定且有语义的名称，后续更新和删除都通过名称定位。

## 推荐绘制流程

随附 Skill 遵循以下流程：

1. 读取当前状态和幻灯片尺寸。
2. 规划视觉层级和可复用的对象名称。
3. 使用分步批处理绘制一个逻辑区域（`step_delay_ms: 100`）。
4. 调用 `powerpoint_live_screenshot` 和 `powerpoint_live_inspect`。
5. 在进入下一区域前，修正重叠、文字平衡、信息密度、越界几何和连接线走向。
6. 交付前运行 `powerpoint_file_validate`。
7. 用 `powerpoint_file_save` 保存可编辑 `.pptx`。
8. 用 `powerpoint_file_export_slide` 导出 PNG/JPG；需要 2000 px 预览时设置 `width_px: 2000`；需要
   PDF 时使用 `powerpoint_file_export_pdf`。

不要为了填空白而添加无意义的小标题或微型标签。应通过更有用的内容、更大的有效文字、更紧凑
的间距和明确的关系来提高信息密度。

## 安全与隐私

- 所有实时编辑都通过 PowerPoint 原生 COM 对象模型完成。
- 不会先生成 XML，也不会发送系统级鼠标或键盘事件。
- `powerpoint_live_clear` 和 `powerpoint_live_close_presentation` 必须传入 `confirm: true`。
- 关闭演示文稿不会退出 PowerPoint；是否保存由参数明确控制。
- 只读检查和验证默认不保存地关闭文件。
- 桥接用的临时请求文件在本地创建，每次调用结束后删除。
- 不包含云端后端、遥测或插件专用凭据存储。
- 请勿把机密幻灯片、参考图或导出文件上传到 Issue 或 Pull Request。

## 仓库结构

```text
.
├── .codex-plugin/plugin.json                 # 插件清单和界面元数据
├── .mcp.json                                 # 两个 stdio MCP 服务定义
├── scripts/
│   ├── live-server.mjs                       # PowerPoint 实时 MCP 服务
│   ├── file-server.mjs                       # 文件检查/保存/导出 MCP 服务
│   ├── mcp-common.mjs                        # JSONL MCP 和 PowerShell 桥接辅助代码
│   ├── powerpoint-bridge.ps1                 # 原生 PowerPoint COM 实现
│   └── self-test.mjs                          # 单演示文稿集成测试
├── skills/control-powerpoint-canvas/
│   ├── SKILL.md                              # 绘制与复核流程
│   ├── agents/openai.yaml                    # Skill 界面元数据
│   └── references/tool-reference.md          # 字段和示例
├── LICENSE
└── README.md / README.zh-CN.md
```

## 开发与验证

自测必须在安装了桌面版 PowerPoint 的 Windows 机器上运行。它只打开一个临时演示文稿，调用两个
MCP 服务，保存并导出到指定目录，验证结果，并在 `finally` 中关闭测试文稿：

```powershell
node .\scripts\self-test.mjs .\test-output
```

生成的 `test-output/` 已被 Git 忽略。常用静态检查：

```powershell
node --check .\scripts\file-server.mjs
node --check .\scripts\live-server.mjs
node --check .\scripts\mcp-common.mjs
node --check .\scripts\self-test.mjs
```

插件和 Skill 的清单验证，请使用 Codex plugin-creator 和 skill-creator 提供的验证脚本：

```powershell
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$skillCreator = Join-Path $codexHome "skills\.system\skill-creator"
$pluginCreator = Join-Path $codexHome "skills\.system\plugin-creator"
python (Join-Path $skillCreator "scripts\quick_validate.py") `
  .\skills\control-powerpoint-canvas
python (Join-Path $pluginCreator "scripts\validate_plugin.py") .
```

## 常见问题

### Codex 中看不到插件

重启 Codex 并新建对话。确认 marketplace 条目指向克隆后的目录，并确认 `codex plugin list` 中插件
显示为已安装且已启用。

### 找不到 PowerPoint 或桥接超时

确认桌面版 PowerPoint 已安装且能正常启动；关闭 Office 模态对话框；多个文稿同时打开时传入完整的
`presentation_path`；然后重试 `powerpoint_live_status`。本插件不能控制 PowerPoint 网页版或 WPS Office。

### 文字被裁切或箭头位置不对

在受影响的逻辑区域后调用 `powerpoint_live_inspect` 和 `powerpoint_live_screenshot`。用
`powerpoint_live_update_shape` 定点调整几何位置、边距、字号或层级；当端点应跟随形状时，使用命名的
原生连接符，而不是自由浮动的直线。

### 导出失败

确认目标目录存在；只有在传入 `overwrite: true` 时才替换已有文件。也可以先在桌面版 PowerPoint
中手工导出同一张幻灯片，以区分 Office 渲染问题和插件问题。

## 参与贡献

欢迎提交 Issue 和 Pull Request。请提供 Windows、PowerPoint、Codex、Node.js 版本，完整工具调用和
相关错误文本。请不要提交生成的 `.pptx`、PNG、PDF、机密参考图或本地测试输出。

## 许可证

MIT © 2026 [wangzian828](https://github.com/wangzian828)
