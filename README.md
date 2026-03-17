# iOS Wallpaper Extractor

This tool extracts iOS wallpaper images from a backup using the `Manifest.db` database, images are converted from the cpbitmap format using [cpbitmap-to-png](https://github.com/hthetiot/cpbitmap-to-png). Encrypted backups are first decrypted with [irestore](https://github.com/dnicolson/node-irestore).

iOS backups are located in `~/Library/Application Support/MobileSync/Backup/`.

On macOS, you may need to grant your terminal app Full Disk Access to read backups from that folder.

## Usage

```
npx ios-wallpaper-extractor <backup path> <output path>
```

```
const extractor = require('ios-wallpaper-extractor');

extractor('/Users/dave/Library/Application Support/MobileSync/Backup/00008110-001438282142401E', 'wallpapers').then(output => {
    console.log(output);
}).catch(err => {
    console.error(err);
});
```

## License

MIT.
