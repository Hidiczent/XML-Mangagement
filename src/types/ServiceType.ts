// src/types/ServiceType.ts
export const SERVICE_TYPES = ["LTCBANKING", "REFILL", "LUCKYDRAW"] as const;
export type ServiceType = typeof SERVICE_TYPES[number];

export const isServiceType = (v: string): v is ServiceType =>
  (SERVICE_TYPES as readonly string[]).includes(v);

export type UploadResp = {
  ok: boolean;
  fileId: string;
  version: number;
  userCount: number;
  unchanged?: boolean; // ⬅️ เพิ่ม

};
export type CountResp = { fileId: string; version: number; userCount: number };
export type VersionRow = {
  id: string;
  versionNo: number;
  userCount: number;
  createdAt: string;
};
export type NormalizedUser = { id: string } & Record<
  string,
  string | undefined
>;
export type UsersResp = {
  fileId: string;
  version: number;
  format: string;
  users: NormalizedUser[];
};
export type SchemaResp = {
  fileId: string;
  version: number;
  columns: string[];
  listFields: string[];
  filterKey: string | null;
  rowCount: number;
};
export type UpdateUsersResp = {
  ok: boolean;
  fileId: string;
  version: number;
  userCount: number;
  unchanged?: boolean; // ⬅️ เพิ่ม
};

export type Snapshot = {
  users: NormalizedUser[];
  columns: string[];
  listFields: string[];
};

export type FileListItem = {
  id: string;
  fileName: string;
  serviceType: ServiceType;
  latestVersion: number;
  userCount: number;
  updatedAt: string; // ISO
};



export type FileListItemEx = FileListItem &
  Record<string, unknown> & {
    __userIdDisplay?: string;
  };
