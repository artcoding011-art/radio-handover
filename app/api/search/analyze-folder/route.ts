import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  ext?: string
  children?: FileNode[]
  modifiedAt?: string
}

interface AnalyzeResult {
  rootPath: string
  totalFiles: number
  totalDirs: number
  totalSize: number
  tree: FileNode[]
  extensions: Record<string, number>
}

const MAX_DEPTH = 5
const MAX_FILES_PER_DIR = 200

// 지원 파일 확장자 목록 (분석 대상)
const SUPPORTED_EXTS = new Set([
  '.txt', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.hwp', '.hwpx', '.csv', '.md', '.json', '.xml', '.html',
  '.mp3', '.wav', '.aac', '.mp4', '.avi', '.mov',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp',
])

function readDirectory(
  dirPath: string,
  depth: number = 0
): { nodes: FileNode[]; totalFiles: number; totalDirs: number; totalSize: number; extensions: Record<string, number> } {
  const result = {
    nodes: [] as FileNode[],
    totalFiles: 0,
    totalDirs: 0,
    totalSize: 0,
    extensions: {} as Record<string, number>,
  }

  if (depth > MAX_DEPTH) return result

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true })
  } catch {
    return result
  }

  // 숨김 파일/폴더 제외, 정렬
  const filtered = entries
    .filter(e => !e.name.startsWith('.'))
    .slice(0, MAX_FILES_PER_DIR)
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })

  for (const entry of filtered) {
    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      result.totalDirs++
      const sub = readDirectory(fullPath, depth + 1)
      result.totalFiles += sub.totalFiles
      result.totalDirs += sub.totalDirs
      result.totalSize += sub.totalSize
      for (const [ext, count] of Object.entries(sub.extensions)) {
        result.extensions[ext] = (result.extensions[ext] || 0) + count
      }
      result.nodes.push({
        name: entry.name,
        path: fullPath,
        type: 'directory',
        children: sub.nodes,
      })
    } else {
      const ext = path.extname(entry.name).toLowerCase()
      let size = 0
      let modifiedAt: string | undefined

      try {
        const stat = fs.statSync(fullPath)
        size = stat.size
        modifiedAt = stat.mtime.toISOString()
      } catch {
        // ignore
      }

      result.totalFiles++
      result.totalSize += size
      result.extensions[ext || '(없음)'] = (result.extensions[ext || '(없음)'] || 0) + 1

      result.nodes.push({
        name: entry.name,
        path: fullPath,
        type: 'file',
        size,
        ext: ext || '',
        modifiedAt,
      })
    }
  }

  return result
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { folderPath } = body as { folderPath?: string }

    if (!folderPath || typeof folderPath !== 'string') {
      return NextResponse.json({ error: '폴더 경로를 입력해주세요.' }, { status: 400 })
    }

    const resolved = path.resolve(folderPath)

    // 경로 존재 여부 확인
    if (!fs.existsSync(resolved)) {
      return NextResponse.json({ error: '해당 경로가 존재하지 않습니다: ' + resolved }, { status: 404 })
    }

    const stat = fs.statSync(resolved)
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: '파일이 아닌 폴더 경로를 입력해주세요.' }, { status: 400 })
    }

    const { nodes, totalFiles, totalDirs, totalSize, extensions } = readDirectory(resolved)

    const analyzeResult: AnalyzeResult = {
      rootPath: resolved,
      totalFiles,
      totalDirs,
      totalSize,
      tree: nodes,
      extensions,
    }

    return NextResponse.json({ success: true, result: analyzeResult })
  } catch (err) {
    console.error('[analyze-folder] error:', err)
    return NextResponse.json({ error: '폴더 분석 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
