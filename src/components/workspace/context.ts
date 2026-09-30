"use client";

import { createContext, useContext } from "react";
import type { Ticket } from "@/lib/types";
import type { Preferences } from "@/lib/workspace-types";

export type WorkspaceContextValue = {
  preferences: Preferences; setPreferences: (value: Preferences) => void;
  revision: number; refresh: () => void; notify: (message: string) => void;
  openTrip: (id: string) => void; addTrip: (seed?: Partial<Ticket>) => void; logout: () => Promise<void>;
};
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("Workspace context is required.");
  return context;
}
