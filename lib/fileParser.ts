import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'

/**
 * 주어진 파일의 확장자에 따라 내용을 텍스트로 추출합니다.
 * Next.js Webpack 번들링 문제를 피하기 위해 별도의 Node 프로세스로 실행합니다.
 */
export async function parseFileToText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase()

  try {
    const textExts = ['.txt', '.md', '.json', '.xml', '.html', '.js', '.ts', '.jsx', '.tsx', '.css']
    if (textExts.includes(ext)) {
      return fs.readFileSync(filePath, 'utf-8')
    }

    const workerPath = path.join(process.cwd(), 'lib', 'parserWorker.js')
    if (!fs.existsSync(workerPath)) {
      console.error(`Worker not found at ${workerPath}`)
      return `[파일 읽기 실패: 파서 워커를 찾을 수 없습니다.]`
    }

    // 10MB 버퍼 제한으로 실행
    const resultBuffer = execFileSync(process.execPath, [workerPath, filePath], { maxBuffer: 10 * 1024 * 1024 })
    const resultJson = JSON.parse(resultBuffer.toString('utf-8'))

    if (resultJson.error) {
      console.error(`Error parsing file ${filePath}:`, resultJson.error)
      return `[파일 읽기 실패: ${resultJson.error}]`
    }

    return resultJson.text || ''

  } catch (error: any) {
    console.error(`Error parsing file ${filePath}:`, error)
    return `[파일 읽기 실패: ${error.message}]`
  }
}
