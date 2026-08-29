import { LoaderCircle } from "lucide-react";

export function LoadingSpinner({ size = 16 }: { size?: number }) {
  return <LoaderCircle className="loading-spinner" size={size} aria-hidden="true" />;
}

export function LoadingBlock({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <LoadingSpinner size={20} />
      <span>{label}</span>
    </div>
  );
}
