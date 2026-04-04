const extractor = require('../src/extractor');
const fs = require('fs');
const path = require('path');
const os = require('os');
const convertCpbitmapToPng = require('cpbitmap-to-png');
const IRestore = require('irestore');

jest.mock('cpbitmap-to-png');
jest.mock('irestore');

describe('iOS Wallpaper Extractor', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('checks for databases that cannot be opened', async () => {
    const backupPath = 'backup'
    const outputPath = '/dev/null';

    await expect(extractor(backupPath, outputPath)).rejects.toEqual('Cannot read Manifest.db. Check file permissions or Full Disk Access.');
  });

  it('converts wallpapers from a database', async () => {
    const backupPath = path.join(process.cwd(), 'test/fixtures/backup');
    const outputPath = '/dev/null';
    const files = [
      ['e7/e779d740418fb576d2361bfbfa38dc20527c82df', 'OriginalHomeBackground.png'],
      ['0c/0c371b8c5e4b666e1f09053b29c3a2d434b2e2d9', 'OriginalLockBackground.png'],
      ['b9/b97b0c3bc8a6bb221d0849b450fbd92b5d06a301', 'HomeBackground.png'],
      ['86/86736007d0166a18c646c567279b75093fc066fe', 'LockBackground.png'],
    ];

    for (const [src] of files) {
      const sourcePath = path.join(backupPath, src);
      fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
      fs.writeFileSync(sourcePath, 'fixture');
    }

    await extractor(backupPath, outputPath);

    for (const [src, dst] of files) {
      expect(convertCpbitmapToPng).toHaveBeenCalledWith(path.join(backupPath, src), path.join(outputPath, dst), 16);
      fs.rmSync(path.join(backupPath, src.split('/')[0]), { recursive: true, force: true });
    }
  });

  it('handles an encrypted database unable to be decrypted', async () => {
    const backupPath = path.join(process.cwd(), 'test/fixtures/backup-encrypted');
    const outputPath = '/dev/null';
    const restore = jest.fn(async () => {
      throw new Error('decrypt failed');
    });

    IRestore.mockImplementation(() => ({ restore }));

    await expect(extractor(backupPath, outputPath)).rejects.toEqual('Manifest.db file is unable to be decrypted: decrypt failed');
    expect(IRestore).toHaveBeenCalledWith(backupPath);
    expect(restore).toHaveBeenCalledWith('AppDomain-com.apple.PosterBoard,HomeDomain', expect.any(String));
  });

  it('handles an encrypted database unable to be decrypted with password', async () => {
    const backupPath = path.join(process.cwd(), 'test/fixtures/backup-encrypted');
    const outputPath = '/dev/null';
    const restore = jest.fn(async () => {
      throw new Error('decrypt failed');
    });

    IRestore.mockImplementation(() => ({ restore }));

    await expect(extractor(backupPath, outputPath, 'xxx')).rejects.toEqual(new Error('decrypt failed'));
    expect(IRestore).toHaveBeenCalledWith(backupPath, 'xxx');
    expect(restore).toHaveBeenCalledWith('AppDomain-com.apple.PosterBoard,HomeDomain', expect.any(String));
  });

  it('extracts wallpapers from restored encrypted backup files', async () => {
    const backupPath = fs.mkdtempSync(path.join(os.tmpdir(), 'encrypted-backup-'));
    const outputPath = fs.mkdtempSync(path.join(os.tmpdir(), 'extractor-output-'));
    const restoredRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'restored-files-'));
    const restoredBackupPath = path.join(process.cwd(), 'test/fixtures/backup');
    const homeDir = path.join(restoredRoot, 'Library', 'SpringBoard');
    let restoreDestination;

    fs.writeFileSync(path.join(backupPath, 'Manifest.db'), 'encrypted');
    fs.writeFileSync(path.join(backupPath, 'Info.plist'), '<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>Product Version</key><string>18.0</string></dict></plist>');
    fs.mkdirSync(homeDir, { recursive: true });
    fs.writeFileSync(path.join(homeDir, 'HomeBackground.cpbitmap'), 'cpbitmap');

    IRestore.mockImplementation(() => ({
      restore: jest.fn(async (_domain, destination) => {
        restoreDestination = destination;
        fs.copyFileSync(path.join(restoredBackupPath, 'Manifest.db'), path.join(destination, 'Manifest.db'));
        fs.cpSync(restoredRoot, destination, { recursive: true });
        return 'restored';
      }),
    }));

    await extractor(backupPath, outputPath, 'password');
    expect(convertCpbitmapToPng).toHaveBeenCalledWith(
      path.join(restoreDestination, 'Library', 'SpringBoard', 'HomeBackground.cpbitmap'),
      path.join(outputPath, 'HomeBackground.png'),
      18
    );

    fs.rmSync(backupPath, { recursive: true, force: true });
    fs.rmSync(outputPath, { recursive: true, force: true });
    fs.rmSync(restoredRoot, { recursive: true, force: true });
  });
});
