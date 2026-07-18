export default function WorkspaceLoading() {
  return (
    <div className="grid gap-3" aria-label="Loading section">
      <div className="h-24 animate-pulse rounded-md border border-slate-200 bg-white" />
      <div className="h-64 animate-pulse rounded-md border border-slate-200 bg-white" />
    </div>
  );
}
