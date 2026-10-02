import type { Planner } from "./travel-planner";

// Compare content, not object insertion order or optional undefined properties.
/** Compares normalized values while ignoring serialization order and undefined fields. */
export function sameContent(a: unknown, b: unknown): boolean {
    /** Converts a value into a deterministic comparison representation. */
  function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)]));
    return value;
  }
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

export class WorkspaceConflict extends Error {}
/** Merges non-conflicting account edits against the latest saved workspace. */
export function mergeWorkspace(base: Planner, edited: Planner, latest: Planner): Planner {
    /** Merges a field when only one side changed it and rejects incompatible concurrent edits. */
  function choose<T>(before: T, after: T, current: T): T {
    if (sameContent(before, after)) return current;
    if (sameContent(before, current) || sameContent(after, current)) return after;
    throw new WorkspaceConflict("This item changed in another session. Reload the latest version before saving.");
  }
    /** Merges identified records while rejecting conflicting edits to the same entity. */
  function records<T extends { id: string }>(before: T[], after: T[], current: T[]): T[] {
    const original = new Map(before.map(item => [item.id, item]));
    const desired = new Map(after.map(item => [item.id, item]));
    const live = new Map(current.map(item => [item.id, item]));
    const ids = new Set([...live.keys(), ...original.keys(), ...desired.keys()]);
    return [...ids].flatMap(id => { const item = choose(original.get(id), desired.get(id), live.get(id)); return item ? [item] : []; });
  }
  const settings = { ...latest.settings };
  for (const key of Object.keys(edited.settings) as (keyof Planner["settings"])[]) {
    Object.assign(settings, { [key]: choose(base.settings[key], edited.settings[key], latest.settings[key]) });
  }
  return { ...latest, settings, journeys: records(base.journeys, edited.journeys, latest.journeys), rules: records(base.rules, edited.rules, latest.rules), holidays: records(base.holidays, edited.holidays, latest.holidays) };
}
