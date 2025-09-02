// src/components/UploadXml.tsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import axios from "axios";
import { errMsg } from "@/lib/error";
import Panel from "./common/Panel";
import Spinner from "./common/Spinner";
import SearchBar from "./common/SearchBar";
import Chip from "./common/Chip";
import ListCell from "./common/ListCell";
import type {
  CountResp,
  NormalizedUser,
  SchemaResp,
  ServiceType,
  Snapshot,
  UpdateUsersResp,
  UploadResp,
  UsersResp,
  VersionRow,
} from "@/types/ServiceType";
import { useParams, useSearchParams } from "react-router-dom";

/* ================== Config ================== */
const API = import.meta.env.VITE_API_BASE_URL as string;
const LS_KEY = (fileId?: string, ver?: number) =>
  fileId && ver != null ? `xmldraft:${fileId}:${ver}` : "";

/* ================== Helpers ================== */
const isServiceType = (v: string): v is ServiceType =>
  v === "LTCBANKING" || v === "REFILL" || v === "LUCKYDRAW";

function deepCloneUsers(u: NormalizedUser[]): NormalizedUser[] {
  return JSON.parse(JSON.stringify(u));
}

/** อัปเดตแถวให้ได้ค่า id ใหม่ทุกคีย์ที่อาจ unique เพื่อกันชน */
function applyNewPrimaryId(
  row: Record<string, unknown>,
  primaryKey: string,
  newId: string
) {
  const next: Record<string, unknown> = JSON.parse(JSON.stringify(row));
  next[primaryKey] = newId;

  const possibleKeys = ["id", "userId", "uid", "accountId"] as const;
  for (const k of possibleKeys) {
    if (k === primaryKey) continue;
    if (k in next) next[k] = newId;
  }

  delete (next as { createdAt?: unknown }).createdAt;
  delete (next as { updatedAt?: unknown }).updatedAt;
  delete (next as { __version?: unknown }).__version;

  return next as NormalizedUser;
}

const guessPasswordKey = (columns: string[], row: Record<string, unknown>) => {
  const priority = ["password", "user_pass", "pass", "pwd", "pin", "secret"];
  const exact =
    priority.find((k) => columns.includes(k) || k in row) ??
    columns.find((c) => /(pass(word)?|pwd|pin|secret)$/i.test(c));
  return exact || "password";
};

const guessNameKey = (columns: string[], row: Record<string, unknown>) => {
  const priority = ["name", "userName", "username", "fullName", "displayName"];
  const exact =
    priority.find((k) => columns.includes(k) || k in row) ??
    columns.find((c) => /(user)?name$/i.test(c));
  return exact || "name";
};

export default function UploadXml() {
  /* ----- routing params ----- */
  const { fileId: fileIdParam } = useParams<{ fileId?: string }>();
  const [searchParams] = useSearchParams();
  const skipServerRef = useRef(false);

  const routeFileId = (fileIdParam ?? searchParams.get("fileId")) || null;
  const routeVersion = searchParams.get("version")
    ? Number(searchParams.get("version"))
    : undefined;
  const isExistingFile = Boolean(routeFileId);

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

  // primary key to use for duplicate/edit
  const primaryKey = useMemo(() => filterKey || "id", [filterKey]);

  // server-side filter
  const [filterId, setFilterId] = useState<string>("__ALL__");

  // dropdown options
  const [idOptions, setIdOptions] = useState<string[]>(["__ALL__"]);
  const allIdsRef = useRef<string[]>([]);

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

  // undo / redo
  const undoStackRef = useRef<Snapshot[]>([]);
  const redoStackRef = useRef<Snapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const MAX_HISTORY = 50;

  // selection
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Duplicate modal
  const [dupOpen, setDupOpen] = useState(false);
  const [dupForm, setDupForm] = useState({ userId: "", pass: "", name: "" });
  const dupKeysRef = useRef<{
    idKey: string;
    passKey: string;
    nameKey: string;
  }>({ idKey: "id", passKey: "password", nameKey: "name" });
  const [dupError, setDupError] = useState<string | null>(null);

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

  const clearSearch = () => {
    setSearch("");
    setSearchField("__ALL__");
  };

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

  const columnsToRender = useMemo(() => {
    const base = columns.length ? columns : fallbackColumns;
    return base.includes(primaryKey) ? base : [primaryKey, ...base];
  }, [columns, fallbackColumns, primaryKey]);

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

  /* ===== Draft helpers ===== */
  const draftKeyNow = () => {
    const fid = resp?.fileId ?? routeFileId ?? undefined;
    const ver = (selectedVersion ?? routeVersion) as number | undefined;
    return LS_KEY(fid, ver);
  };

  function onPick(f?: File | null) {
    if (!f) return flash("File not found", "error");
    if (!/\.xml$/i.test(f.name))
      return flash("Only .xml files are allowed", "error");
    if (f.size > 10 * 1024 * 1024)
      return flash("File must not exceed 10MB", "error");
    setFile(f);
    flash(`File Selected: ${f.name}`, "info");
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

  /* ---------- Undo/Redo helpers ---------- */
  const snapshot = (): Snapshot => ({
    users: deepCloneUsers(users),
    columns: [...columns],
    listFields: Array.from(listFields),
  });

  const applySnapshot = (s: Snapshot) => {
    setUsers(deepCloneUsers(s.users));
    setColumns([...s.columns]);
    setListFields(new Set(s.listFields));
    setDirty(true);
  };

  const pushUndo = () => {
    const u = undoStackRef.current;
    u.push(snapshot());
    if (u.length > MAX_HISTORY) u.shift();
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  };

  const undo = () => {
    const u = undoStackRef.current;
    if (!u.length) return;
    const current = snapshot();
    const prev = u.pop()!;
    redoStackRef.current.push(current);
    applySnapshot(prev);
    setCanUndo(u.length > 0);
    setCanRedo(true);
  };

  const redo = () => {
    const r = redoStackRef.current;
    if (!r.length) return;
    const current = snapshot();
    const next = r.pop()!;
    undoStackRef.current.push(current);
    applySnapshot(next);
    setCanUndo(true);
    setCanRedo(r.length > 0);
  };

  /* ----- loaders ----- */
  const loadVersions = async (fileId: string) => {
    setLoadingVersions(true);
    try {
      const { data } = await axios.get<VersionRow[]>(
        `${API}/api/xml/${fileId}/versions`,
        { headers: { "x-user-id": "demo-user" } }
      );
      setVersions(data);
      console.log("[API] /versions result:", data?.length);
    } finally {
      setLoadingVersions(false);
    }
  };

  const loadSchema = async (fileId: string, version?: number) => {
    setLoadingSchema(true);
    try {
      const { data } = await axios.get<SchemaResp>(
        `${API}/api/xml/${fileId}/schema`,
        {
          params: version ? { version } : undefined,
          headers: { "x-user-id": "demo-user" },
        }
      );
      setColumns(data.columns ?? []);
      setListFields(new Set(data.listFields ?? []));
      setFilterKey(data.filterKey ?? null);
      console.log("[API] /schema result:", {
        columns: data.columns?.length || 0,
        listFields: data.listFields?.length || 0,
        filterKey: data.filterKey || null,
      });
    } finally {
      setLoadingSchema(false);
    }
  };

  /** โหลด users (สำคัญ: ส่ง x-user-id ด้วย) */
  const loadUsers = async (
    fileId: string,
    version?: number,
    idFilterCsv?: string
  ) => {
    setLoadingUsers(true);
    try {
      const params: Record<string, string | number> = {};
      if (version) params.version = version;

      const key = (filterKey || "id").trim();
      if (idFilterCsv && idFilterCsv.trim() && idFilterCsv !== "__ALL__") {
        params[key] = idFilterCsv.trim();
      }

      const { data } = await axios.get<UsersResp>(
        `${API}/api/xml/${fileId}/users`,
        {
          params,
          headers: { "x-user-id": "demo-user" }, // ✅จำเป็น
        }
      );

      console.log("[API] /users params:", params);
      console.log("[API] /users result:", {
        version: data.version,
        rows: data.users?.length,
        format: data.format,
      });

      setUsers(data.users);
      setFormat(data.format || "—");
      setSelectedVersion(data.version);

      // อัปเดต dropdown options
      const setAll = new Set(allIdsRef.current);
      const pk = (filterKey || "id").trim();
      data.users.forEach((u) => {
        const v =
          (u as Record<string, unknown>)[pk] ??
          (u as Record<string, unknown>)["id"];
        if (v != null && v !== "") setAll.add(String(v));
      });
      if (idFilterCsv && idFilterCsv !== "__ALL__") setAll.add(idFilterCsv);
      const sorted = Array.from(setAll).sort();
      allIdsRef.current = sorted;
      const nextOptions = ["__ALL__", ...sorted];
      setIdOptions(nextOptions);
      if (!nextOptions.includes(filterId)) setFilterId("__ALL__");

      await loadSchema(fileId, data.version);

      // เช็ค draft ใน localStorage
      const lsKey = LS_KEY(fileId, data.version);
      if (lsKey) {
        const raw = localStorage.getItem(lsKey);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            const rows = Array.isArray(parsed)
              ? parsed.length
              : Array.isArray(parsed?.users)
              ? parsed.users.length
              : 0;
            if (rows > 0) {
              draftRef.current = raw;
              setShowRestore(true);
            } else {
              draftRef.current = "";
              setShowRestore(false);
            }
            console.log("[Draft] found", { key: lsKey, rows });
          } catch {
            draftRef.current = "";
            setShowRestore(false);
          }
        } else {
          draftRef.current = "";
          setShowRestore(false);
        }
      }

      setDirty(false);
      // reset history
      undoStackRef.current = [];
      redoStackRef.current = [];
      setCanUndo(false);
      setCanRedo(false);
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
          onUploadProgress: (ev) =>
            ev.total && setProgress(Math.round((ev.loaded * 100) / ev.total)),
        }
      );

      setResp(data);
      setSelectedVersion(data.version);
      allIdsRef.current = [];
      setIdOptions(["__ALL__"]);

      await Promise.all([
        loadVersions(data.fileId),
        loadUsers(data.fileId, data.version, "__ALL__"),
      ]);
      clearSearch();

      if (data.unchanged) {
        flash("file is unchanged — no new version created", "info");
      } else {
        flash("upload successfully ✓", "success");
      }
    } catch (e) {
      flash(errMsg(e)?.message || "something went wrong", "error");
    } finally {
      setProgress(0);
    }
  };

  const refetchCount = async () => {
    if (!resp) return;
    try {
      const { data } = await axios.get<CountResp>(
        `${API}/api/xml/${resp.fileId}/count`,
        { headers: { "x-user-id": "demo-user" } }
      );
      flash(`userCount ล่าสุด: ${data.userCount} (v${data.version})`, "info");
    } catch (e: unknown) {
      flash(errMsg(e)?.message || "something went wrong", "error");
    }
  };

  const saveUsers = async () => {
    if (!resp || selectedVersion == null) return;
    try {
      const { data } = await axios.put<UpdateUsersResp>(
        `${API}/api/xml/${resp.fileId}/users`,
        { baseVersion: Number(selectedVersion), users },
        { headers: { "x-user-id": "demo-user" } }
      );

      setResp(data);
      localStorage.removeItem(LS_KEY(resp.fileId, selectedVersion));

      await Promise.all([
        loadVersions(resp.fileId),
        loadUsers(resp.fileId, data.version, filterId),
      ]);

      if (data.unchanged) {
        flash("ไม่มีการเปลี่ยนแปลง — ไม่ได้สร้างเวอร์ชันใหม่", "info");
      } else {
        flash("Saved successfully (new version created) ✓", "success");
      }

      setDirty(false);
    } catch (e) {
      if (axios.isAxiosError(e)) {
        console.error("[FE] save error", e.response?.status, e.response?.data);
        flash(
          e.response?.data?.error || e.message || "บันทึกไม่สำเร็จ",
          "error"
        );
      } else {
        console.error("[FE] save error (unknown)", e);
        flash("บันทึกไม่สำเร็จ", "error");
      }
    }
  };

  /* ----- table ops + dirty/draft ----- */
  const nextCopyId = (baseId?: string) => {
    const seen = new Set<string>();
    const keysToCheck = new Set<string>([
      "id",
      "userId",
      "uid",
      "accountId",
      primaryKey,
    ]);
    users.forEach((u) => {
      for (const k of keysToCheck) {
        const v = u?.[k];
        if (v != null && v !== "") seen.add(String(v));
      }
    });

    const base = baseId && baseId !== "undefined" ? baseId : "row";
    const cand = `${base}_copy`;
    if (!seen.has(cand)) return cand;
    let i = 2;
    while (seen.has(`${base}_copy${i}`)) i++;
    return `${base}_copy${i}`;
  };

  const isIdUnique = (id: string) => {
    const keys = new Set<string>([
      "id",
      "userId",
      "uid",
      "accountId",
      primaryKey,
    ]);
    for (const u of users) {
      for (const k of keys) {
        if (String(u?.[k] ?? "") === id) return false;
      }
    }
    return true;
  };

  const setCell = (row: number, key: string, val: string) => {
    pushUndo();
    setUsers((prev) => {
      const next = [...prev];
      next[row] = { ...next[row], [key]: val };
      return next;
    });
    setSelectedIdx(row);
    setDirty(true);
  };

  const addRow = () => {
    pushUndo();
    const newId = nextCopyId("row");
    const newRow: NormalizedUser = {
      ...(primaryKey === "id" ? { id: newId } : { [primaryKey]: newId }),
      id: newId,
    } as NormalizedUser;
    setUsers((u) => {
      const next = [...u, newRow];
      setSelectedIdx(next.length - 1);
      return next;
    });
    setDirty(true);
  };

  const removeRow = (idx: number) => {
    pushUndo();
    setUsers((u) => u.filter((_, i) => i !== idx));
    setSelectedIdx((prev) => {
      if (prev == null) return prev;
      if (prev === idx) return null;
      if (prev > idx) return prev - 1;
      return prev;
    });
    setDirty(true);
  };

  const openDuplicateModal = (idx: number) => {
    const row = users[idx];
    const base = String(row?.[primaryKey] ?? row?.id ?? "row");
    const suggestedId = nextCopyId(base);
    const nameDefault =
      String(
        row?.name ?? row?.userName ?? row?.username ?? row?.fullName ?? ""
      ) || "";

    dupKeysRef.current = {
      idKey: primaryKey,
      passKey: guessPasswordKey(columnsToRender, row),
      nameKey: guessNameKey(columnsToRender, row),
    };
    setDupForm({ userId: suggestedId, pass: "", name: nameDefault });
    setDupError(null);
    setDupOpen(true);
  };

  const duplicateRowWithForm = () => {
    if (selectedIdx == null) return;
    const { idKey, passKey, nameKey } = dupKeysRef.current;
    let newId = dupForm.userId.trim();
    if (!newId) newId = nextCopyId("row");
    if (!isIdUnique(newId)) newId = nextCopyId(newId);

    pushUndo();
    setUsers((prev) => {
      const baseRow = prev[selectedIdx] ?? {};
      const row = JSON.parse(JSON.stringify(baseRow)) as Record<
        string,
        unknown
      >;

      const newRow = applyNewPrimaryId(row, idKey, newId);
      newRow[passKey] = dupForm.pass;
      newRow[nameKey] = dupForm.name;

      const next = [...prev];
      next.splice(selectedIdx + 1, 0, newRow);

      setColumns((cols) => {
        let c = cols.slice();
        if (c.length) {
          if (!c.includes(passKey)) c = [...c, passKey];
          if (!c.includes(nameKey)) c = [...c, nameKey];
        }
        return c;
      });

      return next;
    });

    setDupOpen(false);
    setSelectedIdx((i) => (i == null ? i : i + 1));
    setDirty(true);
    flash(`Duplicated (${primaryKey})`, "success");
  };

  /* ----- Auto-save draft ----- */
  useEffect(() => {
    try {
      if (!resp) return;
      if (selectedVersion == null) return;
      if (!dirty) return;
      const key = draftKeyNow();
      if (!key) return;
      const payload = JSON.stringify({ users, savedAt: Date.now() });
      localStorage.setItem(key, payload);
      console.log("[Draft] saved", { key, rows: users.length });
    } catch (err) {
      console.error("[Draft] save error", err);
    }
  }, [users, dirty, resp, selectedVersion]);

  const restoreDraft = () => {
    try {
      const key = draftKeyNow();
      const raw = draftRef.current || (key ? localStorage.getItem(key) : null);
      if (!raw) {
        flash("Draft not found for this file/version", "error");
        setShowRestore(false);
        return;
      }

      const parsed = JSON.parse(raw);
      const restored = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.users)
        ? parsed.users
        : null;
      const rows = Array.isArray(restored) ? restored.length : 0;

      if (!rows) {
        setShowRestore(false);
        flash("Draft is empty — kept server data", "info");
        return;
      }

      const nextUsers: NormalizedUser[] = JSON.parse(JSON.stringify(restored));
      setUsers(nextUsers);

      // ล้าง filter/search ให้เห็นครบ
      skipServerRef.current = true;
      setFilterId("__ALL__");
      clearSearch();

      setSelectedIdx(nextUsers.length ? nextUsers.length - 1 : null);
      setDirty(true);
      setShowRestore(false);

      console.log("[Draft] restored", { key, rows: nextUsers.length });
      flash(`Draft restored ✓ (${nextUsers.length} rows)`, "success");
    } catch (e) {
      console.error("[Draft] restore error", e);
      flash("Restore draft failed", "error");
      setShowRestore(false);
    }
  };

  // เปิดไฟล์จาก URL
  useEffect(() => {
    if (!routeFileId) return;
    (async () => {
      try {
        setResp({
          ok: true,
          fileId: routeFileId!,
          version: routeVersion ?? 0,
          userCount: 0,
        });
        setUsers([]);
        setVersions([]);
        setColumns([]);
        setListFields(new Set());
        setFilterKey(null);
        setFilterId("__ALL__");
        setSelectedVersion(null);
        setSelectedIdx(null);
        undoStackRef.current = [];
        redoStackRef.current = [];
        setCanUndo(false);
        setCanRedo(false);
        allIdsRef.current = [];
        setIdOptions(["__ALL__"]);
        setDirty(false);
        setShowRestore(false);

        console.log("[Route] open file", {
          fileId: routeFileId,
          version: routeVersion,
        });

        await Promise.all([
          loadVersions(routeFileId),
          loadUsers(routeFileId, routeVersion, "__ALL__"),
        ]);
        clearSearch();
      } catch (e) {
        flash(errMsg(e)?.message || "file not found ", "error");
      }
    })();
  }, [routeFileId, routeVersion]);

  // กันปิด/รีเฟรช + คีย์ลัด Undo/Redo
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (dirty) {
        const isRefresh =
          e.key === "F5" ||
          ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r");
        if (isRefresh) {
          e.preventDefault();
          const ok = confirm(
            "Editions not saved. Do you want to refresh the page?"
          );
          if (ok) {
            window.removeEventListener("beforeunload", onBeforeUnload);
            location.reload();
          }
          return;
        }
      }

      const metaOrCtrl = e.metaKey || e.ctrlKey;
      if (!metaOrCtrl) return;

      const k = e.key.toLowerCase();
      if (k === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo) redo();
        } else {
          if (canUndo) undo();
        }
      } else if (k === "y") {
        e.preventDefault();
        if (canRedo) redo();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dirty, canUndo, canRedo]);

  const guardedLoadUsers = async (fileId: string, versionNo: number) => {
    if (dirty && !confirm("Editions not saved. Do you want to change version?"))
      return;
    await loadUsers(fileId, versionNo, filterId);
    clearSearch();
  };

  // เปลี่ยน filter แล้วรีโหลด
  useEffect(() => {
    if (!resp) return;
    if (skipServerRef.current) {
      skipServerRef.current = false;
      return;
    }
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
          {!isExistingFile && (
            <Panel title="Upload & Controls">
              <div className="mb-3">
                <label className="text-sm font-medium">Service Type</label>
                <select
                  value={serviceType}
                  onChange={(e) =>
                    isServiceType(e.target.value) &&
                    setServiceType(e.target.value)
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 text-gray-900"
                >
                  <option value="LTCBANKING">LTCBANKING</option>
                  <option value="REFILL">REFILL</option>
                  <option value="LUCKYDRAW">LUCKYDRAW</option>
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
                      "Drag .xml file here or click to select"
                    )}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    File Upload Max 10MB
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
          )}

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
                <li className="text-sm text-gray-500">Data not found</li>
              )}
            </ul>
          </Panel>
        </div>

        {/* Right content */}
        <div className="lg:col-span-9 xl:col-span-9 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Table block */}
          <div className="lg:col-span-9">
            {/* sticky toolbar */}
            <div
              ref={toolbarRef}
              className="sticky top-0 z-40 mb-3 -mt-2 rounded-xl border bg-white/90 p-3 shadow-sm backdrop-blur"
            >
              <div className="flex flex-wrap items-center gap-2">
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
                    onClick={undo}
                    disabled={!canUndo}
                    className="rounded-xl border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                    title="Undo (Ctrl/⌘+Z)"
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    onClick={redo}
                    disabled={!canRedo}
                    className="rounded-xl border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                    title="Redo (Ctrl+Y or ⇧⌘+Z)"
                  >
                    Redo
                  </button>
                  <button
                    type="button"
                    onClick={addRow}
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                    title="Add new row at bottom"
                  >
                    Add row
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      selectedIdx != null && openDuplicateModal(selectedIdx)
                    }
                    disabled={selectedIdx == null}
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                    title={
                      selectedIdx == null
                        ? "Select a row to duplicate"
                        : "Duplicate selected row"
                    }
                  >
                    Duplicate
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

              <div className="mt-2 text-xs text-gray-500">
                {selectedIdx != null
                  ? `Selected row: #${selectedIdx + 1} • ${primaryKey}: ${
                      String(
                        users[selectedIdx]?.[primaryKey] ??
                          users[selectedIdx]?.id ??
                          ""
                      ) || "(empty)"
                    }`
                  : "Select a row to enable Duplicate"}
              </div>
            </div>

            {/* SearchBar */}
            <SearchBar
              value={search}
              onChange={setSearch}
              field={searchField}
              onFieldChange={setSearchField}
              columns={columnsToRender}
              className="mb-3"
            />

            {/* Filters */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
                className="rounded-xl border px-3 py-2 text-sm text-gray-900"
                title="Filter by User ID (server)"
              >
                {idOptions.map((id) => (
                  <option key={id} value={id}>
                    {id === "__ALL__" ? " All" : id}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={wrapCells}
                  onChange={(e) => setWrapCells(e.target.checked)}
                />
                Wrap text
              </label>

              {filterId !== "__ALL__" && (
                <Chip onRemove={() => setFilterId("__ALL__")}>
                  {filterKey || "id"}:{" "}
                  <span className="ml-1 font-medium">{filterId}</span>
                </Chip>
              )}
            </div>

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
                        style={{ minWidth: idx === 0 ? 160 : 180 }}
                        title={c}
                      >
                        {c.replace(/_/g, " ")}
                      </th>
                    ))}
                    <th className="w-28"></th>
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
                    visibleUsers.map((row) => {
                      const idx = users.indexOf(row);
                      const isSelected = selectedIdx === idx;
                      return (
                        <tr
                          key={idx}
                          className={`border-t ${
                            isSelected ? "bg-indigo-50" : ""
                          }`}
                          onClick={() => setSelectedIdx(idx)}
                          aria-selected={isSelected}
                        >
                          {columnsToRender.map((c, colIdx) => (
                            <td
                              key={c}
                              className={[
                                "px-3 py-2 align-top",
                                wrapCells
                                  ? "whitespace-pre-wrap break-words break-all"
                                  : "whitespace-nowrap",
                                colIdx === 0
                                  ? "sticky left-0 z-10 bg-white shadow-[inset_-8px_0_8px_-8px_rgba(0,0,0,0.06)]"
                                  : "",
                              ].join(" ")}
                              style={{ minWidth: colIdx === 0 ? 160 : 180 }}
                            >
                              {c === "id" || !listFields.has(c) ? (
                                <input
                                  value={String(row[c] ?? "")}
                                  onFocus={() => setSelectedIdx(idx)}
                                  onChange={(e) =>
                                    setCell(idx, c, e.target.value)
                                  }
                                  className={[
                                    "w-full h-9 rounded-lg border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200",
                                    wrapCells ? "min-h-[2.25rem]" : "",
                                    "text-gray-900 placeholder-gray-400",
                                  ].join(" ")}
                                />
                              ) : (
                                <div onClick={() => setSelectedIdx(idx)}>
                                  <ListCell
                                    value={String(row[c] ?? "")}
                                    onChange={(next) => setCell(idx, c, next)}
                                    label="items"
                                  />
                                </div>
                              )}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeRow(idx);
                              }}
                              className="rounded-lg border px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                              title="Remove row"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={columnsToRender.length + 1}
                        className="px-3 py-12 text-center text-gray-500"
                      >
                        No lines found matching the condition.
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
                  Found a previous draft of the revision? Want to recover it?
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

          {/* Schema panel */}
          <div className="lg:col-span-3">
            <Panel
              title="Schema"
              loading={loadingSchema}
              className="lg:sticky lg:top-2 lg:h-fit"
            >
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
                    {listFields.size
                      ? Array.from(listFields).join(", ")
                      : "(auto-detected ‘;’ fields)"}
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {/* ===== Duplicate Modal ===== */}
      {dupOpen && (
        <div
          className="fixed inset-0 z-[1000] grid place-items-center bg-black/30 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Duplicate row</h3>
            <p className="mt-1 text-xs text-gray-500">
              กรอกเฉพาะ 3 ช่องนี้ ระบบจะเติมค่าอื่น ๆ
              ให้เหมือนแถวเดิมโดยอัตโนมัติ
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-gray-600">User ID</label>
                <input
                  value={dupForm.userId}
                  onChange={(e) =>
                    setDupForm((f) => ({ ...f, userId: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="เช่น johndoe_001"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">User pass</label>
                <input
                  value={dupForm.pass}
                  onChange={(e) =>
                    setDupForm((f) => ({ ...f, pass: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="รหัสผ่าน"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">User Name</label>
                <input
                  value={dupForm.name}
                  onChange={(e) =>
                    setDupForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="ชื่อผู้ใช้"
                />
              </div>

              {dupError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {dupError}
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setDupOpen(false)}
                className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={duplicateRowWithForm}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white shadow hover:bg-indigo-700"
                title="สร้างแถวใหม่ถัดจากแถวที่เลือก"
              >
                Duplicate
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ===== /Duplicate Modal ===== */}
    </div>
  );
}
