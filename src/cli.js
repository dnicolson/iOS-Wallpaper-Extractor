const extractor = require('./extractor');

if (process.argv.length != 4) {
  console.log('Usage: ios-wallpaper-extractor <backup path> <output path>')
  process.exit(1);
}

const backupPath = process.argv[2];
const outputPath = process.argv[3];

extractor(backupPath, outputPath, null, console.log).catch((err) => {
  console.error(err);
});
