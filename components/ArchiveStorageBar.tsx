'use client'

export interface ClientStorageUsage {
  available: boolean
  usedBytes: number
  limitBytes: number
  remainingBytes: number
  fileCount: number
  percent: number
}

interface ArchiveStorageBarProps {
  usage: ClientStorageUsage | null
  compact?: boolean
}

function formatCapacity(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ArchiveStorageBar({
  usage,
  compact = false,
}: ArchiveStorageBarProps) {
  if (!usage || !usage.available) return null

  const barColor =
    usage.percent >= 90
      ? 'bg-red-500'
      : usage.percent >= 70
      ? 'bg-amber-500'
      : 'bg-blue-900'

  const textColor =
    usage.percent >= 90
      ? 'text-red-600'
      : usage.percent >= 70
      ? 'text-amber-700'
      : 'text-blue-900'

  const tooltip = `대용량 저장소 사용량: ${formatCapacity(usage.usedBytes)} / 1 GB (${usage.percent}%) · 잔여: ${formatCapacity(usage.remainingBytes)} · 대용량 파일 ${usage.fileCount}개`

  if (compact) {
    return (
      <div
        title={tooltip}
        className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-blue-50/70 border border-blue-100 text-xs"
      >
        <span className="text-gray-600 font-medium whitespace-nowrap">
          대용량 잔여{' '}
          <strong className={textColor}>{formatCapacity(usage.remainingBytes)}</strong>
          <span className="text-gray-400"> / 1 GB</span>
        </span>
        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${Math.max(usage.usedBytes > 0 ? 3 : 0, usage.percent)}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      title={tooltip}
      className="mb-3 px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs"
    >
      <div className="flex items-center gap-2 text-gray-600">
        <span className="font-bold text-gray-700">대용량 저장소 잔여 용량</span>
        <strong className={textColor}>{formatCapacity(usage.remainingBytes)}</strong>
        <span className="text-gray-400">
          / 1 GB (사용 {formatCapacity(usage.usedBytes)} · {usage.fileCount}개)
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-28 h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200/70">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${Math.max(usage.usedBytes > 0 ? 3 : 0, usage.percent)}%` }}
          />
        </div>
        <span className={`font-bold w-10 text-right ${textColor}`}>{usage.percent}%</span>
      </div>
    </div>
  )
}
