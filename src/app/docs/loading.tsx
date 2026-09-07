export default function DocsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading docs" className="space-y-6">
      <div className="desk-skeleton h-3 w-28" />
      <div className="desk-skeleton h-10 w-72 max-w-full" />
      <div className="desk-skeleton h-4 w-full max-w-xl" />
      <div className="desk-skeleton h-4 w-full max-w-lg" />
      <div className="desk-skeleton mt-10 h-7 w-48" />
      <div className="desk-skeleton h-4 w-full max-w-xl" />
    </div>
  );
}
