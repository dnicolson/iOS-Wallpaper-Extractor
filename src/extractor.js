const os = require('os');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const convertCpbitmapToPng = require('cpbitmap-to-png');
const IRestore = require('irestore');
const plist = require('simple-plist');

const getWallpapers = (backupPath, useOriginalFilename = false) => {
  const db = new Database(`${backupPath}/Manifest.db`, { readonly: true });
  const stmt = db.prepare('SELECT * FROM Files WHERE "relativePath" LIKE \'%Background.cpbitmap%\'');
  const rows = stmt.all();

  const files = rows.map(row => ({
    originalFilename: row.relativePath.replace(/^Library\/SpringBoard\//, ''),
    path: useOriginalFilename ? row.relativePath : `${row.fileID.slice(0,2)}/${row.fileID}`,
  }));

  db.close();
  return files;
};

const getiOSVersion = (backupPath) => {
  const infoPlist = plist.readFileSync(`${backupPath}/Info.plist`, 'utf8');
  return parseInt(infoPlist['Product Version'], 10);
}

const decryptBackup = async (backupPath, password) => {
  let output;
  const tempBackupPath = fs.mkdtempSync(path.join(os.tmpdir(), 'irestore'));

  if (password) {
    try {
      const iRestore = new IRestore(backupPath, password)
      output = await iRestore.restore('HomeDomain', tempBackupPath);
    } catch (err) {
      return Promise.reject(err);
    }
  } else {
    const iRestore = new IRestore(backupPath);
    await iRestore.restore('HomeDomain', tempBackupPath);
  }

  return [tempBackupPath, output];
}

const extractor = async (backupPath, outputPath, password = null, logger) => {
  let tempBackupPath;
  let files = [];
  let output = '';

  if (!logger) {
    logger = (lines) => {
      output += lines + '\n';
    }
  }

  if (password) {
    try {
      [tempBackupPath, out] = await decryptBackup(backupPath, password);
      output += out;
    } catch (err) {
      return Promise.reject(err);
    }
    try {
      files = getWallpapers(tempBackupPath, true);
    } catch (_err) {
      return Promise.reject('Manifest.db file is unable to be decrypted.');
    }
  } else {
    try {
      files = getWallpapers(backupPath);
    } catch (err) {
      if (err.code === 'SQLITE_NOTADB') {
        logger('Manifest.db appears to be encrypted.\n\nEnter backup password:');
        [tempBackupPath] = await decryptBackup(backupPath);

        try {
          files = getWallpapers(tempBackupPath, true);
        } catch (_err) {
          return Promise.reject('Manifest.db file is unable to be decrypted.');
        }
      } else {
        return Promise.reject('Cannot open Manifest.db.');
      }
    }
  }

  for (const file of files) {
    const oldFile = path.join(tempBackupPath || backupPath, file.path);
    const newFile = path.join(outputPath, file.originalFilename.replace(/cpbitmap$/, 'png'));
    const iOSVersion = getiOSVersion(backupPath);
    logger(`Saving iOS ${iOSVersion} wallpaper as ${newFile}`);
    await convertCpbitmapToPng(oldFile, newFile, iOSVersion);
  }

  if (tempBackupPath) {
    fs.rmSync(tempBackupPath, { recursive: true, force: true });
  }

  return output;
}

module.exports = extractor;
