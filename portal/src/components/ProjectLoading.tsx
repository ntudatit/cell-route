import { useEffect, useRef, useState } from "react";
import { Waypoints } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useLoadingActivity } from "../utils/loadingActivity";

const MINIMUM_VISIBLE_MS = 420;

export function ProjectLoading() {
  const location = useLocation();
  const [pageVisible, setPageVisible] = useState(true);
  const activity = useLoadingActivity();
  const startedAt = useRef(performance.now());
  const timer = useRef<number>();

  function show() {
    window.clearTimeout(timer.current);
    startedAt.current = performance.now();
    setPageVisible(true);
  }

  function hideAfterMinimum() {
    window.clearTimeout(timer.current);
    const delay = Math.max(0, MINIMUM_VISIBLE_MS - (performance.now() - startedAt.current));
    timer.current = window.setTimeout(() => setPageVisible(false), delay);
  }

  useEffect(() => {
    hideAfterMinimum();
    return () => window.clearTimeout(timer.current);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onPageTransition = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.download) return;
      const next = new URL(anchor.href, window.location.href);
      if (next.origin !== window.location.origin || (next.pathname === location.pathname && next.search === location.search)) return;
      show();
    };
    const onBeforeUnload = () => show();
    document.addEventListener("click", onPageTransition, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onPageTransition, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [location.pathname, location.search]);

  const connectionVisible = activity.connection > 0;
  const visible = pageVisible || connectionVisible;
  const label = connectionVisible ? "Establishing Fiber connection" : "Synchronizing browser runtime";

  return <>
    <div className={`project-loading${visible ? " visible" : ""}`} role="status" aria-live="polite" aria-hidden={!visible}>
      <div className="project-loading-grid" />
      <div className="project-loading-content">
        <span className="project-loading-mark"><Waypoints size={29} /><i /></span>
        <strong>FIBER<span>OPS</span></strong>
        <small>INITIALIZING CONTROL PLANE</small>
        <div className="project-loading-track"><i /></div>
        <p><span /> {label}</p>
      </div>
    </div>
    <div className={`api-loading-indicator${activity.api > 0 ? " visible" : ""}`} role="status" aria-live="polite" aria-hidden={activity.api === 0}>
      <i /><span>API</span><b>{activity.api > 1 ? `${activity.api} requests` : "Loading"}</b>
    </div>
  </>;
}
