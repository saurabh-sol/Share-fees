export default function DeskLoading() {
  return (
    <div aria-busy="true" aria-label="Loading desk" className="space-y-12">
      <div>
        <div className="desk-skeleton h-3 w-24" />
        <div className="desk-skeleton mt-4 h-8 w-44" />
      </div>
      <div className="desk-skeleton h-3 w-80 max-w-full" />
      <div className="grid grid-cols-1 divide-y divide-white/8 border-y border-white/8 md:grid-cols-3 md:divide-x md:divide-y-0">
        {[0, 1, 2].map((i) => (
          <div key={i} className="py-8 md:px-8 first:md:pl-0 last:md:pr-0">
            <div className="desk-skeleton h-3.5 w-28" />
            <div className="desk-skeleton mt-4 h-9 w-36" />
          </div>
        ))}
      </div>
      <div className="space-y-4 border-t border-white/8 pt-10">
        <div className="desk-skeleton h-3 w-20" />
        <div className="desk-skeleton h-7 w-64 max-w-full" />
        <div className="desk-skeleton h-3 w-96 max-w-full" />
        <div className="desk-skeleton mt-2 h-10 w-full max-w-sm" />
      </div>
    </div>
  );
}
