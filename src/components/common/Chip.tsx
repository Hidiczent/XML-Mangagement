function Chip({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded bg-rose-50 px-1 text-rose-600 hover:bg-rose-100"
          title="Remove"
        >
          ×
        </button>
      )}
    </span>
  );
}

export default Chip;
