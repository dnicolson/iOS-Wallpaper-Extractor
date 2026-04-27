const os = require('os');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const convertCpbitmapToPng = require('cpbitmap-to-png');
const IRestore = require('irestore');
const plist = require('simple-plist');

const WALLPAPER_DOMAINS = ['AppDomain-com.apple.PosterBoard', 'HomeDomain'];
const POSTERBOARD_PATTERN = /output\.layerStack\/(.+\.HEIC)$/i;

const getWallpapers = (backupPath, useOriginalFilename = false) => {
  let files = [];
  const db = new Database(`${backupPath}/Manifest.db`, { readonly: true });

  const stmt = db.prepare('SELECT * FROM Files WHERE "relativePath" LIKE \'%Background.cpbitmap%\'');
  const rows = stmt.all();
  files = rows.map(row => ({
    domain: row.domain,
    originalFilename: row.relativePath.replace(/^Library\/SpringBoard\//, ''),
    path: useOriginalFilename ? row.relativePath : `${row.fileID.slice(0,2)}/${row.fileID}`,
  }));

  const stmtNew = db.prepare(`SELECT * FROM Files WHERE "domain" = 'AppDomain-com.apple.PosterBoard' AND "relativePath" LIKE '%output.layerStack%'`);
  const rowsNew = stmtNew.all();
  files.push(...rowsNew
    .filter(row => row.relativePath.match(POSTERBOARD_PATTERN))
    .map(row => ({
      domain: row.domain,
      originalFilename: row.relativePath.replace(/.*output.layerStack\//, ''),
      path: useOriginalFilename ? row.relativePath : `${row.fileID.slice(0,2)}/${row.fileID}`,
    })));

  const stmtHome = db.prepare('SELECT * FROM Files WHERE "relativePath" LIKE \'%com.apple.Home/Wallpapers%\' AND flags = 1');
  const rowsHome = stmtHome.all();
  files.push(...rowsHome.map(row => ({
    domain: row.domain,
    originalFilename: row.relativePath.replace(/^Library\/Application Support\/com\.apple\.Home\/Wallpapers\//, ''),
    path: useOriginalFilename ? row.relativePath : `${row.fileID.slice(0,2)}/${row.fileID}`,
  })));

  db.close();
  return files;
};

const getiOSVersion = (backupPath) => {
  const infoPlist = plist.readFileSync(`${backupPath}/Info.plist`, 'utf8');
  return parseInt(infoPlist['Product Version'], 10);
};

const decryptBackup = async (backupPath, password, domains = WALLPAPER_DOMAINS) => {
  let output = '';
  const tempBackupPath = fs.mkdtempSync(path.join(os.tmpdir(), 'irestore'));
  const restoreDomain = domains.join(',');

  if (password) {
    const iRestore = new IRestore(backupPath, password);
    output += await iRestore.restore(restoreDomain, tempBackupPath);
  } else {
    const iRestore = new IRestore(backupPath);
    await iRestore.restore(restoreDomain, tempBackupPath);
  }

  return [tempBackupPath, output];
};

const extractor = async (backupPath, outputPath, password = null, logger) => {
  let tempBackupPath;
  let files = [];
  let output = '';

  if (!logger) {
    logger = (lines) => {
      output += lines + '\n';
    };
  }

  try {
    fs.accessSync(`${backupPath}/Manifest.db`, fs.constants.R_OK);
  } catch (_err) {
    return Promise.reject('Cannot read Manifest.db. Check file permissions or Full Disk Access.');
  }

  if (password) {
    try {
      [tempBackupPath, output] = await decryptBackup(backupPath, password);
      files = getWallpapers(tempBackupPath, true);
    } catch (err) {
      return Promise.reject(err);
    }
  } else {
    try {
      files = getWallpapers(backupPath);
    } catch (err) {
      if (err.code === 'SQLITE_NOTADB') {
        logger('Manifest.db appears to be encrypted.\n\nEnter backup password:');

        try {
          [tempBackupPath] = await decryptBackup(backupPath);
          files = getWallpapers(tempBackupPath, true);
        } catch (err) {
          return Promise.reject('Manifest.db file is unable to be decrypted:\n' + err.message);
        }
      } else {
        return Promise.reject('Cannot open Manifest.db:\n' + err.message);
      }
    }
  }

  for (const file of files) {
    const oldFile = path.join(tempBackupPath || backupPath, file.path);
    
    const getUniqueFilename = (filePath) => {
      let uniquePath = filePath;
      let counter = 1;
      while (fs.existsSync(uniquePath)) {
        const ext = path.extname(filePath);
        const baseName = path.basename(filePath, ext);
        const dir = path.dirname(filePath);
        uniquePath = path.join(dir, `${baseName} (${counter})${ext}`);
        counter++;
      }
      return uniquePath;
    };

    if (file.originalFilename.match(/cpbitmap$/)) {
      const newFile = getUniqueFilename(path.join(outputPath, file.originalFilename.replace(/cpbitmap$/, 'png')));
      const iOSVersion = getiOSVersion(backupPath);
      logger(`Saving iOS ${iOSVersion} wallpaper as ${newFile}`);
      await convertCpbitmapToPng(oldFile, newFile, iOSVersion);
    } else {
      const newFile = getUniqueFilename(path.join(outputPath, file.originalFilename));
      logger(`Saving wallpaper as ${newFile}`);
      fs.copyFileSync(oldFile, newFile);
    }
  }

  if (tempBackupPath) {
    fs.rmSync(tempBackupPath, { recursive: true, force: true });
  }

  return output;
};

module.exports = extractor;
