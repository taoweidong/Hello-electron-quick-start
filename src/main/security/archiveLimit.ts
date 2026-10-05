// 归档体积阈值判定（方案 B4/R7 的纯函数部分，B5 可测性拆分）：
// 只吃 size 与路径字符串，不依赖 electron/fs——stat 调用与日志留给 fileHandlers。
// zip 走 JSZip 全量入内存、rar 走 WASM 数据解压，超大包是 OOM 风险而不是慢，直接拒绝。

export const MAX_ARCHIVE_BYTES = 500 * 1024 * 1024

export class ArchiveTooLargeError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'ArchiveTooLargeError'
  }
}

/** 超限即抛 ArchiveTooLargeError（ipcSafe 会把 name 收编成 error.code） */
export function assertArchiveSize(sizeBytes: number, archivePath: string): void {
  if (sizeBytes > MAX_ARCHIVE_BYTES) {
    throw new ArchiveTooLargeError(
      `归档体积 ${(sizeBytes / 1024 / 1024).toFixed(1)} MB 超过上限 ${MAX_ARCHIVE_BYTES / 1024 / 1024} MB，已拒绝解压（防止内存耗尽），请拆分后重试：${archivePath}`
    )
  }
}
