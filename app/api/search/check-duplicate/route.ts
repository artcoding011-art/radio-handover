import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

export async function POST(req: Request) {
  try {
    const { filenames } = await req.json()
    if (!Array.isArray(filenames)) {
      return NextResponse.json({ error: 'filenames array is required' }, { status: 400 })
    }

    const mdDir = path.join(process.cwd(), 'data', 'wiki', 'md')
    const duplicates: string[] = []

    if (fs.existsSync(mdDir)) {
      for (const filename of filenames) {
        const baseName = path.parse(filename).name
        const mdFilePath = path.join(mdDir, `${baseName}.md`)
        if (fs.existsSync(mdFilePath)) {
          duplicates.push(filename)
        }
      }
    }

    return NextResponse.json({ duplicates })
  } catch (error: any) {
    console.error('[check-duplicate] Error:', error)
    return NextResponse.json({ error: '서버 에러가 발생했습니다.' }, { status: 500 })
  }
}
