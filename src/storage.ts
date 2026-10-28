import type { Project } from "./model";
import { validateProject } from "./import";
export const storageKey = "bar-estimate.workspace.v1";
export interface Workspace {
  current: Project;
  saved: Project[];
}
export function loadWorkspace(): Workspace | null {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (!Array.isArray(value.saved)) throw new Error("Хранилище повреждено.");
  return {
    current: validateProject(value.current),
    saved: value.saved.map(validateProject),
  };
}
export function saveWorkspace(workspace: Workspace) {
  localStorage.setItem(storageKey, JSON.stringify(workspace));
}
