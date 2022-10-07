const main = require('../src/index').main
const fs = require('fs-extra');
const path = require('path');
const convertCpbitmapToPng = require('cpbitmap-to-png');
const IRestore = require('irestore');

jest.mock('cpbitmap-to-png', () => jest.fn());
jest.mock('irestore');

describe('iOS Wallpaper Extractor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    while (process.argv.length > 2) {
      process.argv.pop();
    }
  });

  it('checks for the required arguments', async () => {
    await expect(main()).rejects.toMatch(/^Usage/);
  });

  it('checks for databases that cannot be opened', async () => {
    process.argv[2] = 'backup';
    process.argv[3] = 'output';

    await expect(main()).rejects.toEqual('Cannot open Manifest.db.');
  });

  it('converts wallpapers from the database', async () => {
    const backupPath = path.join(process.cwd(), 'test/fixtures/backup');
    const outputPath = '/dev/null';
    process.argv[2] = backupPath;
    process.argv[3] = outputPath;

    await main();

    const files = [
      ['e7/e779d740418fb576d2361bfbfa38dc20527c82df', 'OriginalHomeBackground.png'],
      ['0c/0c371b8c5e4b666e1f09053b29c3a2d434b2e2d9', 'OriginalLockBackground.png'],
      ['b9/b97b0c3bc8a6bb221d0849b450fbd92b5d06a301', 'HomeBackground.png'],
      ['86/86736007d0166a18c646c567279b75093fc066fe', 'LockBackground.png'],      
    ]
    for (const [src, dst] of files) {
      expect(convertCpbitmapToPng).toHaveBeenCalledWith(path.join(backupPath, src), path.join(outputPath, dst), 16);
    }
  });

  it('handles an encrypted database unable to be decrypted', async () => {
    const backupPath = path.join(process.cwd(), 'test/fixtures/backup-encrypted');
    const outputPath = '/dev/null';
    process.argv[2] = backupPath;
    process.argv[3] = outputPath;

    await expect(main()).rejects.toEqual('Manifest.db file is unable to be decrypted.');

    expect(IRestore).toHaveBeenCalledWith(backupPath);
  });
});
