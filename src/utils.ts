import fs from "fs";

export const fileExists = async (filename: string) => {
  try {
    await fs.promises.access(filename);
    return true;
  } catch (e) {
    return false;
  }
};

export const findKeyPath = (
  obj: any,
  key: string,
  path: string[],
  fn: (s: string[]) => void
) => {
  if (typeof obj !== "object") {
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    const _path = [...path, k];
    if (k === key) {
      fn(_path);
    }
    findKeyPath(v, key, _path, fn);
  }
};

export const keySelect = (obj: any, path: string[]) => {
  for (const k of path) {
    let v = obj[k];
    if (v == null) {
      break;
    }
    obj = v;
  }
  return obj;
};
