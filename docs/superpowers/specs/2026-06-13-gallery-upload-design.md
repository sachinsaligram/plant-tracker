# Gallery Upload Option — Design Spec

**Date:** 2026-06-13  
**Status:** Approved

## Problem

The "Add a Plant" capture step uses `capture="environment"` on its file input, which forces mobile browsers to open the rear camera directly. Users cannot choose an existing photo from their gallery.

## Goal

Add a gallery upload option alongside the camera option, with equal visual prominence.

## Scope

Single file change: `components/identify-flow.tsx` — capture step UI only.  
No changes to API routes, database, saving logic, or any other component.

## Design

### Capture Step UI

Replace the single camera tile with two equal side-by-side tiles in a 2-column CSS grid:

| Tile | Label | Input attributes |
|------|-------|-----------------|
| Camera | 📷 Take a photo | `type="file" accept="image/*" capture="environment"` |
| Gallery | 🖼️ Choose from gallery | `type="file" accept="image/*"` (no `capture`) |

Both tiles use the same dashed-border green styling as the current single tile, scaled to fit two columns. Both inputs are `sr-only` and triggered by their `<label>`. Both call the existing `handleFile` handler — identification and saving logic are untouched.

### Behavior

- Tapping "Take a photo" → opens device camera (rear-facing, existing behavior)
- Tapping "Choose from gallery" → opens OS file/photo picker (no camera pre-selected)
- After either selection, flow continues identically: preview → identify → confirm → save

### Non-goals

- No changes to the confirm or saving steps
- No mobile-vs-desktop detection or conditional rendering
- No new state beyond what already exists
