// const fs = require('fs');
import { exec } from "child_process";
import fs from "fs";
import path from "path";

const libsMap = {};

const foldersInQueue = [];
const projectLibsPath = path.join(__dirname, "libs"); // Target directory

const folders = fs
  .readdirSync(projectLibsPath, { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name);
foldersInQueue.push(
  ...folders.map((folder) => path.join(projectLibsPath, folder)),
);

while (foldersInQueue.length > 0) {
  const currentPath = foldersInQueue.shift();
  // exec(`kdialog --msgbox "Processing folder: ${currentPath}"`);
  const libName = path.relative(projectLibsPath, currentPath);
  console.info(`Processing folder: ${currentPath}`);

  const currentLibrarySrcPathTs = path.join(currentPath, "src");;
  console.info(`Checking for src/index.ts in: ${currentPath}`);
  if (fs.existsSync(currentLibrarySrcPathTs)) {
    console.info(`Found src/index.ts for ${libName}, adding to libsMap.`);
    libsMap[`@libs/${libName}`] = currentLibrarySrcPathTs;
  } else {
    console.info(
      `No src/index.ts found for ${libName}, scanning subdirectories.`,
    );
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    entries.forEach((entry) => {
      if (entry.isDirectory()) {
        foldersInQueue.push(path.join(currentPath, entry.name));
      }
    });
  }
}
// exec(`kdialog --msgbox "libsMap: ${JSON.stringify(libsMap)}"`);
export default libsMap;
