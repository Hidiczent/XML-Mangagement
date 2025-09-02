// src/pages/AuditLog.tsx
import React, { useEffect, useRef, useState, useId } from "react";
import axios from "axios";

/** ===== Config ===== */
const API = import.meta.env.VITE_API_BASE_URL as string;

/** ===== Types ===== */
type AuditRow = {
  id: string;
  userId: string | null;
  action: string;
  resource: string | null;
  meta: unknown;
  ip: string | null;
  createdAt: string; // ISO string
};

type RawAudit = {
  id?: string | number;
  userId?: string | null;
  userID?: string | null;
  action?: string;
  resource?: string | null;
  meta?: unknown;
  ip?: string | null;
  ip_address?: string | null;
  createdAt?: string | number | Date;
};

type ApiResp = {
  items?: RawAudit[];
  total?: number;
  page?: number;
  pageSize?: number;
};

/** ===== Utils ===== */
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const toCsv = (rows: AuditRow[]) => {
  const head = [
    "ID",
    "UserID",
    "Action",
    "Resource",
    "Meta",
    "IP",
    "CreatedAt",
  ];
  const lines = rows.map((r) => {
    const meta =
      typeof r.meta === "string" ? r.meta : JSON.stringify(r.meta ?? {});
    const cells = [
      r.id,
      r.userId ?? "",
      r.action,
      r.resource ?? "",
      meta,
      r.ip ?? "",
      r.createdAt,
    ].map((v) => `"${String(v).replaceAll(`"`, `""`)}"`);
    return cells.join(",");
  });
  return [head.join(","), ...lines].join("\n");
};

const saveBlob = (blob: Blob, filename: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
};

// แปลงค่าจาก <input type="datetime-local"> เป็น ISO
const localDTtoISO = (v: string) => (v ? new Date(v).toISOString() : undefined);

/** ===== Page ===== */
const AuditLog: React.FC = () => {
  const headers = [
    "ID",
    "UserID",
    "Action",
    "Resource",
    "Meta",
    "IP",
    "CreatedAt",
  ];

  // filters
  const [qUser, setQUser] = useState("");
  const [qAction, setQAction] = useState("");
  const [qResource, setQResource] = useState("");
  const [qIP, setQIP] = useState("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // paging/sort
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<"createdAt:desc" | "createdAt:asc">(
    "createdAt:desc"
  );

  // data
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // id สำหรับ label ↔ input
  const uid = useId();
  const idUser = `${uid}-user`;
  const idAction = `${uid}-action`;
  const idResource = `${uid}-resource`;
  const idIP = `${uid}-ip`;
  const idFrom = `${uid}-from`;
  const idTo = `${uid}-to`;

  // guard ให้ทำงานถูกใน Strict Mode
  const aliveRef = useRef(false);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /** ===== Call API ===== */
  const fetchData = async () => {
    setLoading(true);
    setErr(null);

    try {
      const { data } = await axios.get<ApiResp>(`${API}/api/audit/logs`, {
        params: {
          userId: qUser || undefined,
          action: qAction || undefined,
          resource: qResource || undefined,
          ip: qIP || undefined,
          from: localDTtoISO(dateFrom),
          to: localDTtoISO(dateTo),
          page,
          pageSize,
          sort,
          _t: Date.now(),
        },
        headers: { "Cache-Control": "no-cache" },
        timeout: 15000,
      });

      if (!aliveRef.current) return;

      const items = Array.isArray(data?.items) ? data.items : [];

      const normalized: AuditRow[] = items.map((r: RawAudit) => ({
        id: String(r.id ?? ""),
        userId: r.userId ?? r.userID ?? null,
        action: String(r.action ?? ""),
        resource: r.resource ?? null,
        meta: r.meta ?? null,
        ip: r.ip ?? r.ip_address ?? null,
        createdAt:
          typeof r.createdAt === "string"
            ? r.createdAt
            : r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : r.createdAt != null
            ? new Date(r.createdAt).toISOString()
            : new Date().toISOString(),
      }));

      setRows(normalized);
      setTotal(
        Number.isFinite(data?.total) ? Number(data!.total) : normalized.length
      );
    } catch (e) {
      if (!aliveRef.current) return;
      setRows([]);
      setTotal(0);
      const msg = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error
        ? e.message
        : "Data loading failed";
      setErr(msg);
      console.error("[Audit] fetch error:", e);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  };

  // refetch เมื่อ filter/paging/sort เปลี่ยน
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qUser, qAction, qResource, qIP, dateFrom, dateTo, page, pageSize, sort]);

  const resetFilters = () => {
    setQUser("");
    setQAction("");
    setQResource("");
    setQIP("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const exportCsv = () => {
    const csv = toCsv(rows);
    saveBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      "audit_logs.csv"
    );
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="min-h-screen  flex flex-col items-center p-6">
      <h1 className="text-2xl font-bold text-primary mb-4">Audit Logs Manager</h1>

      {/* Filters */}
      <div className="w-full max-w-6xl rounded-2xl bg-white p-4 shadow mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* UserID */}
          <div>
            <label
              htmlFor={idUser}
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              UserID
            </label>
            <input
              id={idUser}
              className="w-full rounded-xl border px-3 py-2"
              value={qUser}
              onChange={(e) => {
                setPage(1);
                setQUser(e.target.value);
              }}
              placeholder="such as CPLAO"
            />
          </div>

          {/* Action */}
          <div>
            <label
              htmlFor={idAction}
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              Action
            </label>
            <input
              id={idAction}
              className="w-full rounded-xl border px-3 py-2"
              value={qAction}
              onChange={(e) => {
                setPage(1);
                setQAction(e.target.value);
              }}
              placeholder="such as  READ / UPDATE"
            />
          </div>

          {/* Resource */}
          <div>
            <label
              htmlFor={idResource}
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              Resource
            </label>
            <input
              id={idResource}
              className="w-full rounded-xl border px-3 py-2"
              value={qResource}
              onChange={(e) => {
                setPage(1);
                setQResource(e.target.value);
              }}
              placeholder="such as xml / users"
            />
          </div>

          {/* IP */}
          <div>
            <label
              htmlFor={idIP}
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              IP Address
            </label>
            <input
              id={idIP}
              className="w-full rounded-xl border px-3 py-2"
              value={qIP}
              onChange={(e) => {
                setPage(1);
                setQIP(e.target.value);
              }}
              placeholder="such as 115.84.118.198"
            />
          </div>

          {/* From */}
          <div>
            <label
              htmlFor={idFrom}
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              From
            </label>
            <input
              id={idFrom}
              type="datetime-local"
              className="w-full rounded-xl border px-3 py-2"
              value={dateFrom}
              onChange={(e) => {
                setPage(1);
                setDateFrom(e.target.value);
              }}
            />
          </div>

          {/* To */}
          <div>
            <label
              htmlFor={idTo}
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              To
            </label>
            <input
              id={idTo}
              type="datetime-local"
              className="w-full rounded-xl border px-3 py-2"
              value={dateTo}
              onChange={(e) => {
                setPage(1);
                setDateTo(e.target.value);
              }}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={resetFilters}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
          >
            Clear fillter
          </button>
          <button
            onClick={() =>
              setSort((s) =>
                s === "createdAt:desc" ? "createdAt:asc" : "createdAt:desc"
              )
            }
            className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
          >
            Sort by time:{" "}
            {sort === "createdAt:desc" ? "New → Old" : "Old → New"}
          </button>
          <button
            onClick={exportCsv}
            className="ml-auto rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto w-full max-w-6xl rounded-2xl shadow">
        <table className="border-collapse w-full bg-white rounded-2xl overflow-hidden">
          <thead>
            <tr className="bg-gray-50">
              {headers.map((h) => (
                <th
                  key={h}
                  className="border-b px-4 py-3 text-left text-sm font-semibold text-[#505991]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-t">
                  {headers.map((_, j) => (
                    <td key={`td-${i}-${j}`} className="px-4 py-4">
                      <div className="h-5 w-full animate-pulse rounded bg-gray-200" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length ? (
              rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-[#505991]">{r.id}</td>
                  <td className="px-4 py-3 text-sm text-[#505991]">
                    {r.userId ?? ""}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#505991]">
                    {r.action}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#505991]">
                    {r.resource ?? ""}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#505991]">
                    <span
                      title={
                        typeof r.meta === "string"
                          ? r.meta
                          : JSON.stringify(r.meta)
                      }
                    >
                      {typeof r.meta === "string"
                        ? r.meta.length > 40
                          ? r.meta.slice(0, 40) + "…"
                          : r.meta
                        : (() => {
                            const s = JSON.stringify(r.meta);
                            return s.length > 40 ? s.slice(0, 40) + "…" : s;
                          })()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#505991]">
                    {r.ip ?? ""}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#505991]">
                    {fmtDate(r.createdAt)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-4 py-10 text-center text-[#505991]"
                >
                  Data Not Found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="w-full max-w-6xl mt-3 flex items-center gap-2 text-white">
        <div className="rounded-xl bg-white/20 px-3 py-2">
          All {total.toLocaleString()} List
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="rounded-xl bg-white/10 px-3 py-2 hover:bg-white/20 disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            ‹ Prev
          </button>
          <span className="px-2">
            Page {page}/{totalPages}
          </span>
          <button
            className="rounded-xl bg-white/10 px-3 py-2 hover:bg-white/20 disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next ›
          </button>
          <select
            className="ml-2 rounded-xl bg-white text-[#505991] px-3 py-2"
            value={pageSize}
            onChange={(e) => {
              setPage(1);
              setPageSize(Number(e.target.value));
            }}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}/Pages
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error banner */}
      {err && (
        <div className="mt-3 rounded-xl bg-rose-100 text-rose-900 px-3 py-2">
          {err}
        </div>
      )}
    </div>
  );
};

export default AuditLog;
