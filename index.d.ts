declare function extractor(
  backupPath: string,
  outputPath: string,
  password?: string,
  logger?: Function
): Promise<string | void>;

export = extractor
