function SearchBar({
  value,
  onChange,
  field,
  onFieldChange,
  columns,
  className = "",
}: {
  value: string;
  onChange: (s: string) => void;
  field: string;
  onFieldChange: (s: string) => void;
  columns: string[];
  className?: string;
}) {
  return (
    <div className={"rounded-2xl border bg-white p-3 shadow-sm " + className}>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr,220px]">
        <div className="relative">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Search${
              field === "__ALL__" ? " (All columns)" : ` in ${field}`
            }`}
            className="w-full rounded-xl border px-3 py-2 pl-9 text-base focus:outline-none focus:ring-2 focus:ring-indigo-200 text-gray-900 placeholder-gray-400"
          />
          <span className="pointer-events-none absolute left-3 top-2.5 opacity-60">
            
          </span>
          {value && (
            <button
              className="absolute right-2 top-1.5 rounded px-2 text-gray-400 hover:text-gray-600"
              onClick={() => onChange("")}
              title="Clear"
            >
              ×
            </button>
          )}
        </div>

        <select
          value={field}
          onChange={(e) => onFieldChange(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm text-gray-900"
        >
          <option value="__ALL__">All columns</option>
          {columns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
export default SearchBar;
