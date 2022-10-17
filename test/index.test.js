const iOSWallpaperExtractor = require('../src/index').main
const path = require('path');
const convertCpbitmapToPng = require('cpbitmap-to-png');

jest.mock('cpbitmap-to-png', () => jest.fn());

describe('iOS Wallpaper Extractor', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log');
    jest.spyOn(process, 'exit').mockImplementation(jest.fn());
  })
  
  beforeEach(() => {
    jest.clearAllMocks();
    while (process.argv.length > 2) {
      process.argv.pop();
    }
  });

  it('checks for the required arguments', async () => {
    await iOSWallpaperExtractor();

    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.log).toHaveBeenCalled();
  });

  // it('unreadable', async () => {
  //   process.argv[2] = 'backup';
  //   process.argv[3] = 'output';

  //   await iOSWallpaperExtractor();

  //   expect(convertCpbitmapToPng).not.toHaveBeenCalledWith()
  // });

  // it('converts wallpapers from the database', async () => {
  //   const backupPath = path.join(process.cwd(), 'test/fixtures/backup');
  //   const outputPath = '/dev/null';
  //   process.argv[2] = backupPath;
  //   process.argv[3] = outputPath;

  //   await iOSWallpaperExtractor();

  //   const files = [
  //     ['e7/e779d740418fb576d2361bfbfa38dc20527c82df', 'OriginalHomeBackground.png'],
  //     ['0c/0c371b8c5e4b666e1f09053b29c3a2d434b2e2d9', 'OriginalLockBackground.png'],
  //     ['b9/b97b0c3bc8a6bb221d0849b450fbd92b5d06a301', 'HomeBackground.png'],
  //     ['86/86736007d0166a18c646c567279b75093fc066fe', 'LockBackground.png'],      
  //   ]
  //   for (const [src, dst] of files) {
  //     expect(convertCpbitmapToPng).toHaveBeenCalledWith(path.join(backupPath, src), path.join(outputPath, dst), 16);
  //   }
  // });
});
