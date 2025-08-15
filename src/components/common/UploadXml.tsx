// src/components/common/UploadXml.tsx
import React, { useMemo, useRef, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_BASE_URL as string;

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
type NormalizedUser = { id: string; name?: string; email?: string };
type UsersResp = {
  fileId: string;
  version: number;
  format: "A" | "B";
  users: NormalizedUser[];
};

const isServiceType = (v: string): v is ServiceType =>
  v === "LTCBANKING" || v === "REFILL_LUCKYDRAW";

export default function UploadXml() {
  const [serviceType, setServiceType] = useState<ServiceType>("LTCBANKING");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resp, setResp] = useState<UploadResp | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [users, setUsers] = useState<NormalizedUser[]>([]);
  const [format, setFormat] = useState<"A" | "B">("A");
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<"info" | "success" | "error">("info");
  const inputRef = useRef<HTMLInputElement>(null);

  const emailEnabled = format === "A";
  const canSave = Boolean(resp && selectedVersion !== null && users.length > 0);

  // ---------- helpers ----------
  function flash(message: string, tone: "info" | "success" | "error" = "info") {
    setMsg(message);
    setMsgTone(tone);
    setTimeout(() => setMsg(null), 3500);
  }

  function onPick(f?: File | null) {
    if (!f) return flash("ບໍ່ພົບໄຟລ", "error");
    if (!/\.xml$/i.test(f.name))
      return flash("ອັບໂຫລດໄດ້ແຕ່ໄຟລ .xml", "error");
    if (f.size > 10 * 1024 * 1024)
      return flash("ໄຟລຕ້ອງບໍ່ເກິນ 10MB", "error");
    setFile(f);
    flash(`ເລືອກໄຟລແລ້ວ : ${f.name}`, "info");
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
    const cd = (r.headers["content-disposition"] as string) || "";
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

  const loadVersions = async (fileId: string) => {
    const { data } = await axios.get<VersionRow[]>(
      `${API}/api/xml/${fileId}/versions`
    );
    setVersions(data);
  };

  const loadUsers = async (fileId: string, version?: number) => {
    const { data } = await axios.get<UsersResp>(
      `${API}/api/xml/${fileId}/users`,
      {
        params: version ? { version } : undefined,
      }
    );
    setUsers(data.users);
    setFormat(data.format);
    setSelectedVersion(data.version);
  };

  // ---------- actions ----------
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
          headers: { "x-user-id": "demo-user" }, // ภายหลังเปลี่ยนเป็น Authorization: Bearer <JWT>
          onUploadProgress: (ev) => {
            if (ev.total) setProgress(Math.round((ev.loaded * 100) / ev.total));
          },
        }
      );

      setResp(data);
      setSelectedVersion(data.version);
      await Promise.all([
        loadVersions(data.fileId),
        loadUsers(data.fileId, data.version),
      ]);
      flash("ອັບໂຫລດສຳເລັດ ✓", "success");
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : "ເກິດຂໍ້ຜິດພາດ", "error");
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
      flash(e instanceof Error ? e.message : "ເກິດຂໍ້ຜິດພາດ", "error");
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
      await Promise.all([
        loadVersions(resp.fileId),
        loadUsers(resp.fileId, data.version),
      ]);
      flash("ບັນທຶກແລ້ວ (ສ້າງເວີຊັ່ນໃໝ່) ✓", "success");
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : "ບັນທຶກບໍ່ສຳເລັດ", "error");
    }
  };

  // ---------- table ops ----------
  const addRow = () => setUsers((u) => [...u, { id: `${Date.now()}` }]);
  const removeRow = (idx: number) =>
    setUsers((u) => u.filter((_, i) => i !== idx));

  const summary = useMemo(
    () => ({
      total: users.length,
      withEmail: users.filter((u) => u.email?.trim()).length,
    }),
    [users]
  );

  // ---------- UI ----------
  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* page header */}
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">XML Manager</h1>
          <p className="text-sm text-gray-500">
            ອັບໂຫຼດ • ເບິ່ງເວີຊັ່ນ • ແກ້ໄຂຜູ້ໃຊ້ • ສົ່ງອອກ XML
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
                : "bg-sky-50 text-sky-700 border border-sky-200")
            }
          >
            {msg}
          </div>
        )}
      </div>

      {/* layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT: upload & info */}
        <section className="lg:col-span-5 space-y-4">
          {/* card: controls */}
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-3">
              <label className="text-sm font-medium">Service Type</label>
              <select
                value={serviceType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  const v = e.target.value;
                  if (isServiceType(v)) setServiceType(v);
                }}
                className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
              >
                <option value="LTCBANKING">LTCBANKING</option>
                <option value="REFILL_LUCKYDRAW">REFILL_LUCKYDRAW</option>
              </select>
            </div>

            {/* drag & drop */}
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
                  ? "border-black/40 bg-black/5"
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
                <div className="text-xs text-gray-500 mt-1">
                  ຮອບຮັບສູງສຸດ 10MB
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

            {/* progress */}
            {progress > 0 && progress < 100 && (
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-2 bg-black transition-[width]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-1 text-right text-xs text-gray-500">
                  {progress}%
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={upload}
                disabled={!file}
                className="rounded-xl bg-black px-4 py-2 text-white shadow hover:bg-black/90 disabled:cursor-not-allowed disabled:bg-black/30"
              >
                Upload
              </button>

              {resp && (
                <>
                  <button
                    onClick={refetchCount}
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    Refresh count
                  </button>
                  <button
                    onClick={() =>
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
                  <dt className="text-gray-500">userCount</dt>
                  <dd className="font-medium">{resp.userCount}</dd>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <dt className="text-gray-500">table summary</dt>
                  <dd className="font-medium">
                    {summary.total} users
                    {emailEnabled ? ` • ${summary.withEmail} email` : ""}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          {/* card: versions */}
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Version history</h2>
              {resp && (
                <span className="text-xs text-gray-500">
                  {versions.length ? `${versions.length} versions` : "—"}
                </span>
              )}
            </div>
            <ul className="max-h-72 space-y-1 overflow-auto">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className={
                    "flex items-center justify-between rounded-xl border px-3 py-2 text-sm " +
                    (selectedVersion === v.versionNo
                      ? "bg-gray-50"
                      : "hover:bg-gray-50")
                  }
                >
                  <button
                    onClick={() => resp && loadUsers(resp.fileId, v.versionNo)}
                    className="text-left"
                  >
                    <div className="font-medium">v{v.versionNo}</div>
                    <div className="text-xs text-gray-500">
                      users: {v.userCount} •{" "}
                      {new Date(v.createdAt).toLocaleString()}
                    </div>
                  </button>
                  {resp && (
                    <button
                      onClick={() =>
                        download(
                          `${API}/api/xml/${resp.fileId}/export?version=${v.versionNo}`
                        )
                      }
                      className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
                    >
                      Download
                    </button>
                  )}
                </li>
              ))}
              {!versions.length && (
                <li className="text-sm text-gray-500">ຍັງບໍ່ມີຂໍ້ມູນ</li>
              )}
            </ul>
          </div>
        </section>

        {/* RIGHT: table editor */}
        <section className="lg:col-span-7 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Users {selectedVersion ? `(v${selectedVersion})` : ""}
              <span className="ml-2 text-xs font-normal text-gray-500">
                format {format}
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={addRow}
                className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
              >
                + Add row
              </button>
              <button
                onClick={saveUsers}
                disabled={!canSave}
                className="rounded-xl bg-black px-4 py-2 text-sm text-white shadow hover:bg-black/90 disabled:cursor-not-allowed disabled:bg-black/30"
              >
                Save as new version
              </button>
            </div>
          </div>

          <div className="overflow-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium [&>th]:text-gray-600">
                  <th style={{ width: 160 }}>id</th>
                  <th>name</th>
                  {emailEnabled && <th>email</th>}
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">
                      <input
                        className="w-full rounded-lg border px-2 py-1"
                        value={u.id}
                        onChange={(e) => {
                          const v = [...users];
                          v[i] = { ...v[i], id: e.target.value };
                          setUsers(v);
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-full rounded-lg border px-2 py-1"
                        value={u.name ?? ""}
                        onChange={(e) => {
                          const v = [...users];
                          v[i] = { ...v[i], name: e.target.value };
                          setUsers(v);
                        }}
                      />
                    </td>
                    {emailEnabled && (
                      <td className="px-3 py-2">
                        <input
                          className="w-full rounded-lg border px-2 py-1"
                          value={u.email ?? ""}
                          onChange={(e) => {
                            const v = [...users];
                            v[i] = { ...v[i], email: e.target.value };
                            setUsers(v);
                          }}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => removeRow(i)}
                        className="rounded-lg border px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                        title="Remove row"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {!users.length && (
                  <tr>
                    <td
                      colSpan={emailEnabled ? 4 : 3}
                      className="px-3 py-12 text-center text-gray-500"
                    >
                      เลือกเวอร์ชันจากซ้าย หรืออัปโหลดไฟล์เพื่อเริ่มต้น
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
