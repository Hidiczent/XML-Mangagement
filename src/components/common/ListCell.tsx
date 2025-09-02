import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

import Chip from "./Chip";

const toList = (v?: string) =>
  (v ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
const fromList = (items: string[]) => items.join(";");

function ListCell({
  value,
  onChange,
  label = "items",
}: {
  value?: string;
  onChange: (next: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<string[]>(toList(value));
  const [draft, setDraft] = useState("");
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 280,
  });

  useEffect(() => setItems(toList(value)), [value]);

  const commit = (next: string[]) => {
    setItems(next);
    onChange(fromList(next));
  };

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    setDraft("");
    commit([...items, v]);
  };

  const removeAt = (i: number) => commit(items.filter((_, idx) => idx !== i));
  const count = items.length;

  const measure = () => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(420, Math.max(280, r.width));
    let top = r.bottom + 6;
    if (top + 240 > window.innerHeight) top = Math.max(8, r.top - 6 - 220);
    setPos({
      top,
      left: Math.min(r.left, window.innerWidth - (width + 8)),
      width,
    });
  };

  useEffect(() => {
    if (!open) return;
    measure();
    const onScroll = () => measure();
    const onResize = () => measure();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const portal = open
    ? ReactDOM.createPortal(
        <div
          className="fixed z-[9999] rounded-2xl border bg-white p-3 shadow-2xl box-border"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <div className="mb-2 text-xs text-gray-500">
            Manage list (คั่นด้วย <code>;</code>)
          </div>

          <div className="flex max-h-48 flex-wrap gap-2 overflow-auto pr-1">
            {items.map((it, i) => (
              <Chip key={`${it}-${i}`} onRemove={() => removeAt(i)}>
                {it}
              </Chip>
            ))}
            {!items.length && (
              <span className="text-xs text-gray-400">(empty)</span>
            )}
          </div>

          {/* แถวล่าง */}
          <div className="mt-3 grid grid-cols-[1fr,auto,auto] items-center gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Enter item"
              className="min-w-0 h-9 rounded-lg border px-2 text-sm text-gray-900 placeholder-gray-400"
            />

            <button
              type="button"
              onClick={add}
              className="h-9 rounded-lg bg-indigo-600 px-3 text-sm text-white hover:bg-indigo-700"
            >
              Add
            </button>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 rounded-lg border px-3 text-sm hover:bg-gray-50"
            >
              Done
            </button>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="relative" ref={anchorRef}>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={count ? `(มี ${count} ${label})` : "(empty)"}
          className="w-full rounded-lg border bg-white px-2 py-1 text-gray-900"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
        >
          {count} {label} ▾
        </button>
      </div>
      {portal}
    </div>
  );
}

export default ListCell;
