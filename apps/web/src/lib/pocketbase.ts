import PocketBase from "pocketbase";

export const pb = new PocketBase(
  process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090",
);

export function isLoggedIn() {
  return pb.authStore.isValid;
}

export function getAuthUser() {
  return pb.authStore.model;
}

export function getProtectedFileURL(
  record: Parameters<typeof pb.files.getURL>[0],
  fileName: string,
  token: string,
  collectionName: string,
  download = false,
) {
  const fileURL = pb.files.getURL(
    { ...record, collectionName: record.collectionName ?? collectionName },
    fileName,
  );
  if (!fileURL) {
    throw new Error("PocketBase could not build a URL for this file record.");
  }

  const url = new URL(fileURL, pb.baseURL);
  url.searchParams.set("token", token);
  if (download) url.searchParams.set("download", "1");
  return url.toString();
}
