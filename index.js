const path = require('path');
const fs = require('fs');
const { mkdtempSync, removeSync } = require('fs-extra');
const sqlite3 = require('sqlite3').verbose();
const convertCpbitmapToPng = require('cpbitmap-to-png');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const IRestore = require('irestore');
const plist = require('plist');

const extractWallpapers = (backupPath, useOriginalFilename) => {
    const db = new sqlite3.Database(`${backupPath}/Manifest.db`);
    return new Promise((resolve, reject) => {
        const files = [];
        db.each(`SELECT * FROM Files WHERE "relativePath" LIKE "%Background.cpbitmap%"`, (_err, row) => {
            if (row) {
                files.push({
                    originalFilename: row.relativePath.replace(/^Library\/SpringBoard\//, ''),
                    path: useOriginalFilename ? row.relativePath : `${row.fileID.slice(0,2)}/${row.fileID}`,
                });
                resolve(files);
            } else {
                reject('Encrypted backup?');
            }
        });
    });
}

const getiOSVersion = (backupPath) => {
    const infoPlist = plist.parse(fs.readFileSync(`${backupPath}/Info.plist`, 'utf8'));
    return parseInt(infoPlist['Product Version'], 10);
}

const decryptBackup = async (backupPath) => {
    const tempBackupPath = mkdtempSync('irestore');
    const iRestore = new IRestore(backupPath);
    await iRestore.restore('HomeDomain', tempBackupPath);
    return tempBackupPath;
}

const main = async () => {
    const argv = yargs(hideBin(process.argv)).argv;
    const backupPath = argv._[0];
    const outputPath = argv.o || '';
    let tempBackupPath;
    let files;

    try {
        files = await extractWallpapers(backupPath);
    } catch (e) {
        console.log('Manifest.db appears to be encrypted.\n\nEnter backup password:');

        tempBackupPath = await decryptBackup(backupPath);

        try {
            files = await extractWallpapers(tempBackupPath, true);
        } catch (e) {
            console.log('Manifest.db file is unreadable.');
        }
    }

    files && files.forEach(file => {
        const oldFile = path.join(tempBackupPath || backupPath, file.path);
        const newFile = path.join(outputPath, file.originalFilename.replace(/cpbitmap$/, 'png'));
        convertCpbitmapToPng(oldFile, newFile, getiOSVersion(backupPath));
    });

    if (tempBackupPath) {
        removeSync(tempBackupPath);
    }
}

main();
