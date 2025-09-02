// src/components/ServiceBrowser.tsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Panel from "@/components/common/Panel";
import Spinner from "@/components/common/Spinner";
import type { FileListItem, ServiceType } from "@/types/ServiceType";

const API = import.meta.env.VITE_API_BASE_URL as string;

export type FileListItemEx = FileListItem & {
  userId?: string;
  ownerId?: string;
  createdBy?: string;
};

export default function ServiceBrowser() {
  const [services, setServices] = useState<ServiceType[]>([]);
  const [selected, setSelected] = useState<ServiceType | "__ALL__">("__ALL__");
  const [files, setFiles] = useState<FileListItemEx[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoadingServices(true);
      try {
        const { data } = await axios.get<string[]>(
          `${API}/api/xml/service-types`,
          { headers: { "x-user-id": "demo-user" } }
        );
        const known = data.filter((s): s is ServiceType =>
          ["LTCBANKING", "REFILL", "LUCKYDRAW"].includes(s)
        );
        setServices(known);
      } finally {
        setLoadingServices(false);
      }
    })();
  }, []);

  const loadFiles = async (svc?: ServiceType | "__ALL__") => {
    setLoadingFiles(true);
    try {
      const { data } = await axios.get<FileListItemEx[]>(
        `${API}/api/xml/files`,
        {
          params: svc && svc !== "__ALL__" ? { serviceType: svc } : undefined,
          headers: { "x-user-id": "demo-user" },
        }
      );
      setFiles(data);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    loadFiles(selected);
  }, [selected]);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return files;
    return files.filter((f) => {
      const userId = f.userId ?? f.ownerId ?? f.createdBy ?? "";
      return (
        f.fileName.toLowerCase().includes(k) ||
        String(f.latestVersion).includes(k) ||
        String(f.userCount).includes(k) ||
        String(userId).toLowerCase().includes(k)
      );
    });
  }, [q, files]);

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Service Browser</h1>
          <p className="text-gray-500">View file XML filter by Service</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by file name / version / rows / user id"
            className="rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: services */}
        <div className="lg:col-span-3">
          <Panel
            title="Service Types"
            loading={loadingServices}
            right={
              <span className="text-xs text-gray-500">
                {services.length ? `${services.length} services` : "—"}
              </span>
            }
          >
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => setSelected("__ALL__")}
                  className={
                    "w-full rounded-xl border px-3 py-2 text-left text-sm " +
                    (selected === "__ALL__"
                      ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                      : "hover:bg-gray-50")
                  }
                >
                  All
                </button>
              </li>
              {services.map((s) => (
                <li key={s}>
                  <button
                    onClick={() => setSelected(s)}
                    className={
                      "w-full rounded-xl border px-3 py-2 text-left text-sm " +
                      (selected === s
                        ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                        : "hover:bg-gray-50")
                    }
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* Right: files */}
        <div className="lg:col-span-9">
          <Panel
            title={selected === "__ALL__" ? "All Files" : `Files • ${selected}`}
            loading={loadingFiles}
            right={
              <span className="text-xs text-gray-500">
                {filtered.length
                  ? `${filtered.length} file${filtered.length > 1 ? "s" : ""}`
                  : "—"}
              </span>
            }
          >
            {loadingFiles ? (
              <div className="py-8 text-center">
                <Spinner />
              </div>
            ) : filtered.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-gray-50">
                    <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium [&>th]:text-gray-600">
                      <th>File name</th>
                      <th className="whitespace-nowrap">Service</th>
                      <th className="whitespace-nowrap">User ID</th>
                      <th>Latest ver.</th>
                      <th>Rows</th>
                      <th>Updated</th>
                      <th className="w-32"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((f) => {
                      const userId =
                        f.userId ?? f.ownerId ?? f.createdBy ?? "—";
                      return (
                        <tr key={f.id} className="border-t">
                          <td className="px-3 py-2">{f.fileName}</td>
                          <td className="px-3 py-2">{f.serviceType}</td>
                          <td className="px-3 py-2">{userId}</td>
                          <td className="px-3 py-2">v{f.latestVersion}</td>
                          <td className="px-3 py-2">{f.userCount}</td>
                          <td className="px-3 py-2">
                            {new Date(f.updatedAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <a
                              href={`/manage?fileId=${encodeURIComponent(
                                f.id
                              )}&version=${f.latestVersion}`}
                              className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
                            >
                              Open
                            </a>
                            <a
                              href={`${API}/api/xml/${f.id}/export?version=${
                                f.latestVersion || ""
                              }`}
                              className="ml-2 rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
                            >
                              Download
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500">
                Not found files matching this criteria
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
