// src/components/common/UploadXml.tsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import ReactDOM from "react-dom";
import axios from "axios";
import { errMsg } from "@/lib/error";

/* ================== Config ================== */
const API = import.meta.env.VITE_API_BASE_URL as string;
const LS_KEY = (fileId?: string, ver?: number) =>
  fileId && ver != null ? `xmldraft:${fileId}:${ver}` : "";

/* ================== Types ================== */
type ServiceType = "LTCBANKING" | "REFILL_LUCKYDRAW";
type UploadResp = {
  ok: boolean;
  fileId: string;
  version: number;
  userCount: number;
};
type CountResp = { fileId: string; version: number; userCount: number };
type VersionRow = {
  id: string;
  versionNo: number;
  userCount: number;
  createdAt: string;
};
export type NormalizedUser = { id: string } & Record<
  string,
  string | undefined
>;
type UsersResp = {
  fileId: string;
  version: number;
  format: string;
  users: NormalizedUser[];
};
type SchemaResp = {
  fileId: string;
  version: number;
  columns: string[];
  listFields: string[];
  filterKey: string | null;
  rowCount: number;
};

/* ================== Small UI ================== */
function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={"h-5 w-5 animate-spin " + className}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-80"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z"
      />
    </svg>
  );
}

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

const toList = (v?: string) =>
  (v ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
const fromList = (items: string[]) => items.join(";");

/** ===== ListCell (Portal) — กัน dropdown โดนตัดด้วย overflow ===== */
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
          className="fixed z-[9999] rounded-2xl border bg-white p-3 shadow-2xl"
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

          <div className="mt-3 flex items-center gap-2">
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
              placeholder="พิมพ์ค่าแล้วกด Add หรือ Enter"
              className="flex-1 rounded-lg border px-2 py-1"
            />
            <button
              type="button"
              onClick={add}
              className="rounded-lg bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700"
            >
              + Add
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border px-3 py-1 text-xs hover:bg-gray-50"
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
          className="w-full rounded-lg border bg-white px-2 py-1"
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

/* ================== Main ================== */
const isServiceType = (v: string): v is ServiceType =>
  v === "LTCBANKING" || v === "REFILL_LUCKYDRAW";

export default function UploadXml() {
  /* ----- state ----- */
  const [serviceType, setServiceType] = useState<ServiceType>("LTCBANKING");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);

  const [resp, setResp] = useState<UploadResp | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [users, setUsers] = useState<NormalizedUser[]>([]);
  const [format, setFormat] = useState<string>("—");
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  // schema for rendering
  const [columns, setColumns] = useState<string[]>([]);
  const [listFields, setListFields] = useState<Set<string>>(new Set());
  const [filterKey, setFilterKey] = useState<string | null>(null);

  // server-side filter by ID (now shown on toolbar)
  const [filterId, setFilterId] = useState<string>("__ALL__");

  // client-side search
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState<string>("__ALL__");
  const [wrapCells, setWrapCells] = useState(false);

  // messages
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<"info" | "success" | "error">("info");

  // dirty/draft
  const [dirty, setDirty] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const draftRef = useRef<string>("");

  // loaders
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingSchema, setLoadingSchema] = useState(false);

  // sticky header offset
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [, setToolbarH] = useState(0);
  useLayoutEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const update = () => setToolbarH(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);

  /* ----- computed ----- */
  const canSave = Boolean(
    resp && selectedVersion !== null && users.length > 0 && dirty
  );

  const idsForFilter = useMemo(() => {
    const s = new Set<string>();
    users.forEach((u) => s.add(u.id));
    return ["__ALL__", ...Array.from(s).sort()];
  }, [users]);

  const fallbackColumns = useMemo(() => {
    const keys = new Set<string>();
    users.forEach((u) => Object.keys(u).forEach((k) => keys.add(k)));
    if (keys.size === 0) return [];
    keys.delete("id");
    const rest = Array.from(keys).filter((k) => k !== "name");
    const ordered = ["id"];
    if (keys.has("name")) ordered.push("name");
    ordered.push(...rest);
    return ordered;
  }, [users]);
  const columnsToRender = columns.length ? columns : fallbackColumns;

  const visibleUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    const keys =
      searchField === "__ALL__"
        ? columnsToRender
        : columnsToRender.filter((c) => c === searchField);
    return users.filter((row) =>
      keys.some((k) =>
        String(row[k] ?? "")
          .toLowerCase()
          .includes(q)
      )
    );
  }, [users, search, searchField, columnsToRender]);

  /* ----- utils ----- */
  function flash(message: string, tone: "info" | "success" | "error" = "info") {
    setMsg(message);
    setMsgTone(tone);
    setTimeout(() => setMsg(null), 3000);
  }

  function onPick(f?: File | null) {
    if (!f) return flash("ບໍ່ພົບໄຟລ", "error");
    if (!/\.xml$/i.test(f.name)) return flash("ອັບໂຫລດໄດ້ແຕ່ໄຟລ .xml", "error");
    if (f.size > 10 * 1024 * 1024) return flash("ໄຟລຕ້ອງບໍ່ເກິນ 10MB", "error");
    setFile(f);
    flash(`เลือกไฟล์แล้ว: ${f.name}`, "info");
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    onPick(f);
  }

  async function download(url: string) {
    const r = await axios.get(url, { responseType: "blob" });
    const cd = (r.headers["content-disposition"] as string) ?? "";
    const m = /filename="?([^"]+)"?/.exec(cd);
    const fname = m?.[1] ?? "export.xml";
    const blob = new Blob([r.data], {
      type: (r.headers["content-type"] as string) || "application/xml",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  /* ----- loaders ----- */
  const loadVersions = async (fileId: string) => {
    setLoadingVersions(true);
    try {
      const { data } = await axios.get<VersionRow[]>(
        `${API}/api/xml/${fileId}/versions`
      );
      setVersions(data);
    } finally {
      setLoadingVersions(false);
    }
  };

  const loadSchema = async (fileId: string, version?: number) => {
    setLoadingSchema(true);
    try {
      const { data } = await axios.get<SchemaResp>(
        `${API}/api/xml/${fileId}/schema`,
        { params: version ? { version } : undefined }
      );
      setColumns(data.columns ?? []);
      setListFields(new Set(data.listFields ?? []));
      setFilterKey(data.filterKey ?? null);
    } finally {
      setLoadingSchema(false);
    }
  };

  /**
   * โหลด users (รองรับกรองแบบ server-side โดยส่งพารามิเตอร์ตาม filterKey จาก schema)
   */
  const loadUsers = async (
    fileId: string,
    version?: number,
    idFilterCsv?: string
  ) => {
    setLoadingUsers(true);
    try {
      const params: Record<string, string | number> = {};
      if (version) params.version = version;

      // กรองตาม filterKey แบบไดนามิก (เช่น "id") — ถ้าเป็น "__ALL__" จะไม่ส่งพารามิเตอร์
      const key = (filterKey || "id").trim();
      if (idFilterCsv && idFilterCsv.trim() && idFilterCsv !== "__ALL__") {
        params[key] = idFilterCsv.trim();
      }

      const { data } = await axios.get<UsersResp>(
        `${API}/api/xml/${fileId}/users`,
        { params }
      );
      setUsers(data.users);
      setFormat(data.format || "—");
      setSelectedVersion(data.version);

      await loadSchema(fileId, data.version);

      const lsKey = LS_KEY(fileId, data.version);
      if (lsKey) {
        const draft = localStorage.getItem(lsKey);
        if (draft) {
          draftRef.current = draft;
          setShowRestore(true);
        } else {
          draftRef.current = "";
          setShowRestore(false);
        }
      }
      setDirty(false);
    } finally {
      setLoadingUsers(false);
    }
  };

  /* ----- actions ----- */
  const upload = async () => {
    if (!file) return flash("ກາລຸນາເລືອກໄຟລກ່ອນ", "error");
    setProgress(0);
    try {
      const fd = new FormData();
      fd.append("serviceType", serviceType);
      fd.append("file", file);

      const { data } = await axios.post<UploadResp>(
        `${API}/api/xml/upload`,
        fd,
        {
          headers: { "x-user-id": "demo-user" },
          onUploadProgress: (ev) => {
            if (ev.total) setProgress(Math.round((ev.loaded * 100) / ev.total));
          },
        }
      );

      setResp(data);
      setSelectedVersion(data.version);
      await Promise.all([
        loadVersions(data.fileId),
        loadUsers(data.fileId, data.version, filterId),
      ]);
      flash("อัปโหลดสำเร็จ ✓", "success");
    } catch (e: unknown) {
      flash(errMsg(e)?.message || "เกิดข้อผิดพลาด", "error");
    } finally {
      setProgress(0);
    }
  };

  const refetchCount = async () => {
    if (!resp) return;
    try {
      const { data } = await axios.get<CountResp>(
        `${API}/api/xml/${resp.fileId}/count`
      );
      flash(`userCount ล่าสุด: ${data.userCount} (v${data.version})`, "info");
    } catch (e: unknown) {
      flash(errMsg(e)?.message || "เกิดข้อผิดพลาด", "error");
    }
  };

  const saveUsers = async () => {
    if (!resp || selectedVersion == null) return;
    try {
      const { data } = await axios.put<UploadResp>(
        `${API}/api/xml/${resp.fileId}/users`,
        { baseVersion: selectedVersion, users },
        { headers: { "x-user-id": "demo-user" } }
      );
      setResp(data);
      localStorage.removeItem(LS_KEY(resp.fileId, selectedVersion));
      await Promise.all([
        loadVersions(resp.fileId),
        loadUsers(resp.fileId, data.version, filterId),
      ]);
      flash("บันทึกแล้ว (สร้างเวอร์ชันใหม่) ✓", "success");
    } catch (e: unknown) {
      flash(errMsg(e)?.message || "บันทึกไม่สำเร็จ", "error");
    }
  };

  /* ----- table ops + dirty/draft ----- */
  const setCell = (row: number, key: string, val: string) => {
    setUsers((prev) => {
      const next = [...prev];
      next[row] = { ...next[row], [key]: val };
      return next;
    });
    setDirty(true);
  };
  const addRow = () => {
    setUsers((u) => [...u, { id: `${Date.now()}` }]);
    setDirty(true);
  };
  const removeRow = (idx: number) => {
    setUsers((u) => u.filter((_, i) => i !== idx));
    setDirty(true);
  };

  // Auto-save draft
  useEffect(() => {
    if (!resp || selectedVersion == null) return;
    if (!dirty) return;
    const key = LS_KEY(resp.fileId, selectedVersion);
    if (!key) return;
    const payload = JSON.stringify({ users, savedAt: Date.now() });
    localStorage.setItem(key, payload);
  }, [users, dirty, resp, selectedVersion]);

  const restoreDraft = () => {
    try {
      const draft = draftRef.current ? JSON.parse(draftRef.current) : null;
      if (draft?.users?.length) {
        setUsers(draft.users);
        setDirty(true);
        setShowRestore(false);
        flash("กู้คืนฉบับร่างเรียบร้อย ✓", "success");
      } else {
        setShowRestore(false);
      }
    } catch {
      setShowRestore(false);
    }
  };

  // guards: beforeunload + block refresh key
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    const keyBlock = (e: KeyboardEvent) => {
      const isRefresh =
        e.key === "F5" ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r");
      if (isRefresh && dirty) {
        e.preventDefault();
        const ok = confirm(
          "ยังไม่ได้บันทึกการแก้ไข ต้องการรีเฟรชหน้าจอเลยหรือไม่?"
        );
        if (ok) {
          window.removeEventListener("beforeunload", beforeUnload);
          location.reload();
        }
      }
    };
    window.addEventListener("keydown", keyBlock);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", keyBlock);
    };
  }, [dirty]);

  const guardedLoadUsers = async (fileId: string, versionNo: number) => {
    if (
      dirty &&
      !confirm("ยังไม่ได้บันทึกการแก้ไข ต้องการเปลี่ยนเวอร์ชันหรือไม่?")
    )
      return;
    await loadUsers(fileId, versionNo, filterId);
  };

  // เมื่อเปลี่ยน filterId จาก toolbar ให้รีโหลดทันที
  useEffect(() => {
    if (!resp) return;
    loadUsers(resp.fileId, selectedVersion ?? undefined, filterId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterId]);

  /* ================== UI ================== */
  return (
    <div className="mx-auto max-w-[1480px] p-6">
      {/* Top header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">XML Manager</h1>
          <p className="text-sm text-gray-500">
            อัปโหลด • จัดการเวอร์ชัน • แก้ไขแถว • ส่งออก XML
          </p>
        </div>
        {msg && (
          <div
            className={
              "rounded-xl px-3 py-2 text-sm shadow " +
              (msgTone === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : msgTone === "error"
                ? "bg-rose-50 text-rose-700 border border-rose-200"
                : "bg-indigo-50 text-indigo-700 border border-indigo-200")
            }
          >
            {msg}
          </div>
        )}
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left rail */}
        <div className="space-y-4 lg:col-span-3 xl:col-span-3">
          <Panel title="Upload & Controls">
            <div className="mb-3">
              <label className="text-sm font-medium">Service Type</label>
              <select
                value={serviceType}
                onChange={(e) =>
                  isServiceType(e.target.value) &&
                  setServiceType(e.target.value)
                }
                className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="LTCBANKING">LTCBANKING</option>
                <option value="REFILL_LUCKYDRAW">REFILL_LUCKYDRAW</option>
              </select>
            </div>

            {/* Drag & drop */}
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={
                "mt-2 flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition " +
                (isDragging
                  ? "border-indigo-400 bg-indigo-50"
                  : "border-gray-300 hover:bg-gray-50")
              }
              onClick={() => inputRef.current?.click()}
            >
              <div>
                <div className="text-sm font-medium">
                  {file ? (
                    <span>📄 {file.name}</span>
                  ) : (
                    "ลากไฟล์ .xml มาวาง หรือคลิกเพื่อเลือก"
                  )}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  อัปโหลดได้สูงสุด 10MB
                </div>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xml"
                className="hidden"
                onChange={(e) => onPick(e.target.files?.[0] || null)}
              />
            </div>

            {/* Progress */}
            {progress > 0 && progress < 100 && (
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-2 bg-indigo-600 transition-[width]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-1 text-right text-xs text-gray-500">
                  {progress}%
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={upload}
                disabled={!file}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-white shadow hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
              >
                {progress > 0 && progress < 100 ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner className="text-white" />
                    Uploading…
                  </span>
                ) : (
                  "Upload"
                )}
              </button>
              {resp && (
                <>
                  <button
                    type="button"
                    onClick={refetchCount}
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      resp &&
                      download(
                        `${API}/api/xml/${resp.fileId}/export?version=${
                          selectedVersion ?? resp.version
                        }`
                      )
                    }
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    Export XML
                  </button>
                </>
              )}
            </div>

            {/* Summary */}
            {resp && (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-gray-50 p-3">
                  <dt className="text-gray-500">fileId</dt>
                  <dd className="truncate font-medium" title={resp.fileId}>
                    {resp.fileId}
                  </dd>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <dt className="text-gray-500">latest version</dt>
                  <dd className="font-medium">{resp.version}</dd>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <dt className="text-gray-500">table rows</dt>
                  <dd className="font-medium">{users.length}</dd>
                </div>
              </dl>
            )}
          </Panel>

          <Panel
            title="Versions"
            loading={loadingVersions}
            right={
              resp && (
                <span className="text-xs text-gray-500">
                  {versions.length ? `${versions.length} versions` : "—"}
                </span>
              )
            }
          >
            <ul className="max-h-80 space-y-1 overflow-auto">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className={
                    "flex items-center justify-between rounded-xl border px-3 py-2 text-sm " +
                    (selectedVersion === v.versionNo
                      ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                      : "hover:bg-gray-50")
                  }
                >
                  <button
                    type="button"
                    onClick={() =>
                      resp && guardedLoadUsers(resp.fileId, v.versionNo)
                    }
                    className="text-left"
                    title={`Open v${v.versionNo}`}
                  >
                    <div className="font-medium">v{v.versionNo}</div>
                    <div className="text-xs text-gray-500">
                      rows: {v.userCount} •{" "}
                      {new Date(v.createdAt).toLocaleString()}
                    </div>
                  </button>
                  {resp && (
                    <button
                      type="button"
                      onClick={() =>
                        download(
                          `${API}/api/xml/${resp.fileId}/export?version=${v.versionNo}`
                        )
                      }
                      className="rounded-lg border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      Download
                    </button>
                  )}
                </li>
              ))}
              {!versions.length && (
                <li className="text-sm text-gray-500">ยังไม่มีรายการ</li>
              )}
            </ul>
          </Panel>

          <Panel title="Schema" loading={loadingSchema}>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-gray-500">filterKey</div>
                <div className="font-medium">{filterKey ?? "—"}</div>
              </div>
              <div>
                <div className="text-gray-500">columns</div>
                <div className="break-words font-medium">
                  {columns.length ? columns.join(", ") : "(dynamic by data)"}
                </div>
              </div>
              <div>
                <div className="text-gray-500">listFields</div>
                <div className="break-words font-medium">
                  {columns.length
                    ? Array.from(listFields).join(", ")
                    : "(auto-detected ‘;’ fields)"}
                </div>
              </div>
            </div>
          </Panel>
        </div>

        {/* Right content */}
        <div className="lg:col-span-9 xl:col-span-9">
          {/* sticky toolbar (2 แถว) + Filter by User ID moved here */}
          <div
            ref={toolbarRef}
            className="sticky top-0 z-40 mb-3 -mt-2 rounded-xl border bg-white/90 p-3 shadow-sm backdrop-blur"
          >
            {/* แถวบน */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-[240px] flex-1 items-center gap-2 text-sm">
                <span className="font-medium">Users</span>
                {selectedVersion && (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                      v{selectedVersion}
                    </span>
                    <span className="ml-1 text-gray-500">
                      • format {format}
                    </span>
                  </>
                )}
                {dirty && (
                  <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                    Unsaved
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addRow}
                  className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                >
                  + Add row
                </button>
                <button
                  type="button"
                  onClick={saveUsers}
                  disabled={!canSave}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white shadow hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                >
                  Save as new version
                </button>
              </div>
            </div>

            {/* แถวล่าง */}
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[1fr,220px,220px,auto]">
              <div className="relative">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`ค้นหา${
                    searchField === "__ALL__"
                      ? " (ทุกคอลัมน์)"
                      : ` ใน ${searchField}`
                  }`}
                  className="w-full rounded-xl border px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <span className="pointer-events-none absolute left-3 top-2.5 text-gray-400">
                  🔎
                </span>
                {search && (
                  <button
                    className="absolute right-2 top-1.5 rounded px-2 text-gray-400 hover:text-gray-600"
                    onClick={() => setSearch("")}
                    title="Clear"
                  >
                    ×
                  </button>
                )}
              </div>

              <select
                value={searchField}
                onChange={(e) => setSearchField(e.target.value)}
                className="rounded-xl border px-3 py-2 text-sm"
              >
                <option value="__ALL__">ทุกคอลัมน์</option>
                {columnsToRender.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Filter by User ID on toolbar */}
              <select
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
                className="rounded-xl border px-3 py-2 text-sm"
                title="Filter by User ID (server)"
              >
                {idsForFilter.map((id) => (
                  <option key={id} value={id}>
                    {id === "__ALL__" ? "ทั้งหมด (All)" : id}
                  </option>
                ))}
              </select>

              <label className="flex items-center justify-start gap-2 rounded-xl border px-3 text-sm md:justify-center">
                <input
                  type="checkbox"
                  checked={wrapCells}
                  onChange={(e) => setWrapCells(e.target.checked)}
                />
                ห่อบรรทัด
              </label>
            </div>
          </div>

          {/* Active Filters line (แสดงด้านบน table) */}
          {filterId && filterId !== "__ALL__" && (
            <div className="mb-2 flex items-center gap-2 text-sm">
              <span className="text-gray-500">Filters:</span>
              <Chip onRemove={() => setFilterId("__ALL__")}>
                {filterKey || "id"}:{" "}
                <span className="ml-1 font-medium">{filterId}</span>
              </Chip>
            </div>
          )}

          {/* table */}
          <div
            className="relative overflow-x-auto rounded-xl border"
            style={{ overflowY: "visible" }}
          >
            <table
              className={`min-w-[1024px] w-full text-sm ${
                wrapCells ? "table-fixed" : "table-auto"
              }`}
            >
              <thead
                className="bg-gray-50 z-10"
                style={{ position: "sticky", top: 0 }}
              >
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium [&>th]:text-gray-600 [&>th]:whitespace-nowrap">
                  {columnsToRender.map((c, idx) => (
                    <th
                      key={c}
                      className={`capitalize ${
                        idx === 0 ? "sticky left-0 z-20 bg-gray-50" : ""
                      } ${wrapCells ? "truncate" : ""}`}
                      style={{ minWidth: idx === 0 ? 140 : 160 }}
                      title={c}
                    >
                      {c.replace(/_/g, " ")}
                    </th>
                  ))}
                  <th className="w-20"></th>
                </tr>
              </thead>

              <tbody>
                {loadingUsers ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={`sk-${i}`} className="border-t">
                      {columnsToRender.map((c, j) => (
                        <td key={`${c}-${j}`} className="px-3 py-2">
                          <div className="h-8 w-full animate-pulse rounded-lg bg-gray-200" />
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <div className="h-7 w-16 animate-pulse rounded-lg bg-gray-200" />
                      </td>
                    </tr>
                  ))
                ) : visibleUsers.length ? (
                  visibleUsers.map((row, i) => (
                    <tr key={i} className="border-t">
                      {columnsToRender.map((c, idx) => (
                        <td
                          key={c}
                          className={`px-3 py-2 align-top ${
                            wrapCells
                              ? "whitespace-normal"
                              : "whitespace-nowrap"
                          } ${idx === 0 ? "sticky left-0 z-10 bg-white" : ""}`}
                          style={{ minWidth: idx === 0 ? 140 : 160 }}
                        >
                          {c === "id" || !listFields.has(c) ? (
                            <input
                              value={row[c] ?? ""}
                              onChange={(e) => setCell(i, c, e.target.value)}
                              className="w-full h-9 rounded-lg border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            />
                          ) : (
                            <ListCell
                              value={row[c] ?? ""}
                              onChange={(next) => setCell(i, c, next)}
                              label="items"
                            />
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          className="rounded-lg border px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                          title="Remove row"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={columnsToRender.length + 1}
                      className="px-3 py-12 text-center text-gray-500"
                    >
                      ไม่พบบรรทัดที่ตรงกับเงื่อนไข
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {loadingSchema && (
              <div className="absolute inset-0 z-20 grid place-items-center rounded-xl bg-white/40">
                <div className="flex items-center gap-2 text-indigo-700">
                  <Spinner />
                  <span className="text-sm">Preparing schema…</span>
                </div>
              </div>
            )}
          </div>

          {/* restore draft banner */}
          {showRestore && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900">
              <div className="text-sm">
                พบฉบับร่างการแก้ไขก่อนหน้า ต้องการกู้คืนหรือไม่?
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={restoreDraft}
                  className="rounded-lg bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-700"
                >
                  Restore draft
                </button>
                <button
                  onClick={() => setShowRestore(false)}
                  className="rounded-lg border px-3 py-1 text-xs hover:bg-white"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
