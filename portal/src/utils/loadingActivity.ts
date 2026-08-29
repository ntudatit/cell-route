import { useSyncExternalStore } from "react";

export type LoadingActivity = "api" | "connection";
type Snapshot = Readonly<Record<LoadingActivity, number>>;

let snapshot: Snapshot = { api: 0, connection: 0 };
const listeners = new Set<() => void>();

function emit(next: Snapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function beginLoadingActivity(activity: LoadingActivity) {
  emit({ ...snapshot, [activity]: snapshot[activity] + 1 });
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    emit({ ...snapshot, [activity]: Math.max(0, snapshot[activity] - 1) });
  };
}

export function useLoadingActivity() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => snapshot,
    () => snapshot,
  );
}
