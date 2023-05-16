const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const sqlite3 = require('sqlite3').verbose();
const convertCpbitmapToPng = require('cpbitmap-to-png');
const IRestore = require('irestore');
const plist = require('simple-plist');

const getWallpapers = (backupPath, useOriginalFilename = false) => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(`${backupPath}/Manifest.db`, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return reject(err.code);
      }

      const files = [];
      db.each('SELECT * FROM Files WHERE "relativePath" LIKE "%Background.cpbitmap%"', (_err, row) => {
        files.push({
          originalFilename: row.relativePath.replace(/^Library\/SpringBoard\//, ''),
          path: useOriginalFilename ? row.relativePath : `${row.fileID.slice(0,2)}/${row.fileID}`,
        });
      }, (err) => {
        return err ? reject(err.code) : resolve(files);
      });
    });
  });
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
      files = await getWallpapers(tempBackupPath, true);
    } catch (_err) {
      return Promise.reject('Manifest.db file is unable to be decrypted.');
    }
  } else {
    try {
      files = await getWallpapers(backupPath);
    } catch (err) {
      if (err === 'SQLITE_CANTOPEN') {
        return Promise.reject('Cannot open Manifest.db.');
      }

      if (err === 'SQLITE_NOTADB') {
        logger('Manifest.db appears to be encrypted.\n\nEnter backup password:');
        [tempBackupPath] = await decryptBackup(backupPath);

        try {
          files = await getWallpapers(tempBackupPath, true);
        } catch (_err) {
          return Promise.reject('Manifest.db file is unable to be decrypted.');
        }
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
    fs.removeSync(tempBackupPath);
  }

  return output;
}

module.exports = extractor;
