declare module 'archiver' {
  export interface ArchiveEntry {
    mode: number
    name: string
  }

  export class ZipArchive {
    constructor(options: { zlib: { level: number } })

    file(sourcePath: string, entry: ArchiveEntry): this
    finalize(): Promise<void>
    on(event: 'error', listener: (error: Error) => void): this
    pipe(destination: NodeJS.WritableStream): NodeJS.WritableStream
    symlink(entryPath: string, linkTarget: string, mode?: number): this
  }

  export class TarArchive {
    constructor(options: { gzip: true; gzipOptions: { level: number } })

    file(sourcePath: string, entry: ArchiveEntry): this
    finalize(): Promise<void>
    on(event: 'error', listener: (error: Error) => void): this
    pipe(destination: NodeJS.WritableStream): NodeJS.WritableStream
    symlink(entryPath: string, linkTarget: string, mode?: number): this
  }
}
