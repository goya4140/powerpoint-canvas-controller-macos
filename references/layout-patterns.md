# Level 1 Layout Patterns

## Selection rule

Generate two or three structurally distinct candidates. A candidate must change the reading model, not only colors or spacing.

## Pipeline

Use for a dominant input-to-output transformation. Keep the main path left to right, place auxiliary signals above or below their targets, and route feedback along the outer boundary.

Avoid when the method depends on several simultaneous system regions or a central orchestrator.

## Swimlane

Use to separate agent/environment, training/inference, modalities, or ownership. Keep the main time direction horizontal and lanes vertical. Cross-lane arrows should be sparse and meaningful.

Require every primary node to declare `lane`.

## Hub-spoke

Use when an orchestrator, memory, planner, or novel module mediates most interactions. Set `hub_node` explicitly. Keep peripheral nodes ordered by execution sequence when one exists.

Avoid when the hub is only visually convenient and not technically central.

## Hierarchy

Use for task decomposition, multi-resolution processing, policy levels, or manager-worker systems. Assign every node an integer `level`; place lower levels beneath higher levels.

Avoid mixing hierarchy depth with time unless the distinction is explicitly encoded.

## Loop

Use for self-improvement, reflection, data flywheels, or iterative optimization. Label the forward phase and the return/update edge differently. Keep the loop visually open; never draw a circular arrow through node labels.

The bundled generator represents most loops through `feedback` or `update` edges in the other supported layouts. Use a task-specific script for a fully circular composition.

## Contribution-first

Use when one proposed module deserves substantially more space than surrounding standard context. This is a sizing and grouping strategy applied to pipeline, swimlane, or hub-spoke—not a cosmetic highlight.

## Overview plus inset

Use when the main path is simple but one module requires internal detail. Confirm the overview first. Add the inset only after the user agrees that the selected module needs expansion.
