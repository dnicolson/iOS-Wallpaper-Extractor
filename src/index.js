const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const sqlite3 = require('sqlite3').verbose();
const convertCpbitmapToPng = require('cpbitmap-to-png');
const IRestore = require('irestore');
const plist = require("simple-plist");

const extractWallpapers = (backupPath, useOriginalFilename = false) => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(`${backupPath}/Manifest.db`, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return reject(err.code)
      }

      const files = [];
      db.each('SELECT * FROM Files WHERE "relativePath" LIKE "%Background.cpbitmap%"', (_err, row) => {
        files.push({
          originalFilename: row.relativePath.replace(/^Library\/SpringBoard\//, ''),
          path: useOriginalFilename ? row.relativePath : `${row.fileID.slice(0,2)}/${row.fileID}`,
        });
      }, (err) => {
        if (err) {
          return reject(err.code);
        }
        resolve(files);
      });
    });
  });
};

const getiOSVersion = (backupPath) => {
  const infoPlist = plist.readFileSync(`${backupPath}/Info.plist`, 'utf8');
  return parseInt(infoPlist['Product Version'], 10);
}

const decryptBackup = async (backupPath) => {
  const tempBackupPath = fs.mkdtempSync(path.join(os.tmpdir(), 'irestore'));
  const iRestore = new IRestore(backupPath);
  await iRestore.restore('HomeDomain', tempBackupPath);
  return tempBackupPath;
}

const main = async () => {
  if (process.argv.length != 4) {
    return Promise.reject('Usage: ios-wallpaper-extractor <backup path> <output directory>');
  }

  const backupPath = process.argv[2];
  const outputPath = process.argv[3];

  let tempBackupPath;
  let files = [];

  try {
    files = await extractWallpapers(backupPath);
  } catch (err) {
    if (err === 'SQLITE_CANTOPEN') {
      return Promise.reject('Cannot open Manifest.db.');
    }

    if (err === 'SQLITE_NOTADB') {
      console.log('Manifest.db appears to be encrypted.\n\nEnter backup password:');

      tempBackupPath = await decryptBackup(backupPath);

      try {
        files = await extractWallpapers(tempBackupPath, true);
      } catch (_err) {
        return Promise.reject('Manifest.db file is unable to be decrypted.');
      }
    }
  }

  for (const file of files) {
    const oldFile = path.join(tempBackupPath || backupPath, file.path);
    const newFile = path.join(outputPath, file.originalFilename.replace(/cpbitmap$/, 'png'));
    const iOSVersion = getiOSVersion(backupPath);
    console.log(`Saving iOS ${iOSVersion} wallpaper as ${newFile}`);
    await convertCpbitmapToPng(oldFile, newFile, iOSVersion);
  }

  if (tempBackupPath) {
    fs.removeSync(tempBackupPath);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.log(err);
  });
} else {
  exports.main = main;
}
