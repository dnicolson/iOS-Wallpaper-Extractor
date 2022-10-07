# iOS Backup Extractor

This tool extracts iOS wallpaper images from a backup using the `Manifest.db` database, images are converted from the cpbitmap format using [cpbitmap-to-png](https://github.com/hthetiot/cpbitmap-to-png). Encrypted backups are first decrypted with [irestore](https://www.npmjs.com/package/irestore).

iOS backups are located in `~/Library/Application Support/MobileSync/Backup/`.

## Installation

```
npm i -g ios-backup-extractor
```
## Usage

```
ios-backup-extractor <backup path> <output directory>
```

## License
MIT.
