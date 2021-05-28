import fs from "fs";

export const fileExists = async (filename: string) => {
  try {
    await fs.promises.access(filename);
    return true;
  } catch (e) {
    return false;
  }
};
