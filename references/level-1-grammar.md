# Level 1 Semantic Grammar

## Purpose

Use this grammar as the stable intermediate representation between Method content and PowerPoint. Level 2 replaces selected modules with icons; Level 3 introduces illustration-led composition. Neither upgrade should change the verified Level 1 graph without an explicit technical revision.

## Figure specification

```json
{
  "figure": {
    "title": "Agent Skill Lifecycle",
    "message": "The agent retrieves, executes, evaluates, and stores reusable skills.",
    "audience": "AI conference paper reader",
    "target_width": "double-column",
    "contribution_nodes": ["skill-selector", "skill-library"]
  },
  "nodes": [],
  "edges": [],
  "groups": [],
  "layout_candidates": ["pipeline", "swimlane", "hub-spoke"],
  "selected_layout": "swimlane",
  "hub_node": "skill-selector"
}
```

Omit `selected_layout` during the wireframe-review pass. Add it only after the user confirms a candidate.

## Nodes

Required fields:

```json
{
  "id": "skill-library",
  "label": "Skill Library",
  "type": "memory",
  "role": "proposed"
}
```

Optional fields:

- `detail`: one short second line;
- `lane`: swimlane membership;
- `level`: integer hierarchy depth;
- `asset_slot`: later visual replacement, such as `database`, `robot`, `network`, `person`, or `environment`;
- `emphasis`: `normal` or `strong`.

Allowed `type` values:

- `input`, `output`: boundary data or user-visible result;
- `process`: ordinary transformation;
- `model`: learned or reasoning component;
- `memory`: data, knowledge, skill, or experience store;
- `decision`: routing or verification point;
- `external`: tool, user, API, or environment outside the core method.

Allowed `role` values:

- `neutral`: standard context;
- `representation`: encoded state or internal representation;
- `proposed`: claimed contribution;
- `auxiliary`: prompt, supervision, tool, or side signal;
- `output`: result or terminal state;
- `risk`: error, rejection, unsafe state, or negative feedback.

## Edges

```json
{
  "id": "selector-to-executor",
  "from": "skill-selector",
  "to": "executor",
  "type": "data",
  "label": "selected skill"
}
```

Allowed `type` values:

- `data`: primary transformation or information flow;
- `control`: scheduling, routing, or invocation;
- `feedback`: evaluation, reflection, or iterative return;
- `update`: parameter, memory, or skill-library update;
- `optional`: conditional or non-mandatory relation;
- `bidirectional`: symmetric interaction or synchronization.

Use solid arrows for `data` and `control`. Use dashed arrows for `feedback`, `update`, and `optional`. Use arrowheads at both ends only for `bidirectional`.

## Groups

```json
{
  "id": "agent-core",
  "label": "Agent Core",
  "members": ["planner", "skill-selector", "executor"],
  "role": "neutral"
}
```

Groups communicate a real system boundary, stage, modality, or ownership boundary. Do not create a group merely to fill whitespace.

## Hard constraints

- Use 3–12 nodes and unique lowercase hyphenated IDs.
- Use 2–3 unique `layout_candidates`.
- Reference only declared node IDs in edges, groups, contribution nodes, and `hub_node`.
- Keep node labels under 42 characters and details under 64 characters.
- Use at most four lanes and five hierarchy levels.
- Mark cycles as `feedback`, `update`, or `optional`; primary `data` and `control` edges should remain acyclic.
- Keep `asset_slot` semantic rather than visual-style-specific: use `robot`, not `cute-blue-robot`.

## Upgrade contract

When moving from Level 1 to Level 2 or 3:

1. Preserve `id`, `label`, graph edges, group membership, and confirmed coordinates.
2. Resolve `asset_slot` against the component library.
3. Inherit the node's semantic color token unless the replacement requires accessible contrast adjustment.
4. Fit the asset inside the node or replace the node while retaining its connector anchors.
5. Re-run layout, paper-size, grayscale, and editability QA.
