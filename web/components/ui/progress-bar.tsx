interface ProgressBarProps {
  percent: number;
  label?: string;
}

export function ProgressBar({ percent, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="space-y-1.5">
      {label && <p className="text-sm text-muted">{label}</p>}
      <div className="h-2 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-gradient-to-r from-soft-purple to-pink transition-all duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="text-right text-xs text-muted">{clamped}%</p>
    </div>
  );
}
