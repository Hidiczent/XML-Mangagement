import Spinner from "./Spinner";

function Panel({
  title,
  right,
  children,
  className = "",
  loading = false,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border bg-white p-5 shadow-sm ${className}`}
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        {right}
      </header>
      <div className="relative">
        {children}
        {loading && (
          <div className="absolute inset-0 z-10 grid place-items-center rounded-xl bg-white/60">
            <div className="flex items-center gap-2 text-indigo-600">
              <Spinner />
              <span className="text-sm">Loading…</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default Panel;
