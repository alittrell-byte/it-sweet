import { KnowledgeBaseCategory } from '../../core/models/kb.model';

// Builds this category's full ancestor-to-self name path (e.g. ['Hardware', 'Replacing GPU']).
// Guards against a cyclical parentId chain (shouldn't happen, but a corrupt edit shouldn't hang).
function pathNames(category: KnowledgeBaseCategory, byId: Map<string, KnowledgeBaseCategory>): string[] {
  const path: string[] = [];
  const seen = new Set<string>();
  let current: KnowledgeBaseCategory | undefined = category;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

/**
 * Sorts categories so every category appears immediately after its parent and before any of
 * its parent's later siblings (a "materialized path" sort) - siblings are alphabetical, and a
 * parent always sorts immediately before its own children. Gives a hierarchically-grouped list
 * without needing per-row indentation to convey it.
 */
export function sortCategoriesHierarchically(categories: KnowledgeBaseCategory[]): KnowledgeBaseCategory[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const withPaths = categories.map((category) => ({ category, path: pathNames(category, byId) }));
  withPaths.sort((a, b) => {
    const len = Math.min(a.path.length, b.path.length);
    for (let i = 0; i < len; i++) {
      const cmp = a.path[i].localeCompare(b.path[i], undefined, { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    }
    return a.path.length - b.path.length;
  });
  return withPaths.map((w) => w.category);
}

/** Ancestor names only (excludes the category's own name), for a breadcrumb-style prefix. */
export function categoryAncestorNames(category: KnowledgeBaseCategory, categories: KnowledgeBaseCategory[]): string[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return pathNames(category, byId).slice(0, -1);
}

export function categoryDepth(category: KnowledgeBaseCategory, categories: KnowledgeBaseCategory[]): number {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return pathNames(category, byId).length - 1;
}
