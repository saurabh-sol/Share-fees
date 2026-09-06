export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading admin" className="space-y-10">
      <div>
        <div className="desk-skeleton h-3 w-24" />
        <div className="desk-skeleton mt-4 h-8 w-52" />
        <div className="desk-skeleton mt-4 h-3 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 divide-y divide-white/8 border-y border-white/8 md:grid-cols-2 md:divide-x md:divide-y-0">
        {[0, 1].map((i) => (
          <div key={i} className="py-8 md:px-10 first:md:pl-0 last:md:pr-0">
            <div className="desk-skeleton h-3.5 w-28" />
            <div className="desk-skeleton mt-4 h-9 w-40" />
            <div className="desk-skeleton mt-4 h-3 w-64 max-w-full" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i}>
            <div className="desk-skeleton h-3 w-20" />
            <div className="desk-skeleton mt-3 h-6 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
