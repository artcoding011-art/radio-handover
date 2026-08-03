import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import { parseFileToText } from '@/lib/fileParser'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folderPath = formData.get('folderPath') as string | null

    if (!file || !folderPath) {
      return NextResponse.json({ error: '파일과 폴더 경로가 모두 필요합니다.' }, { status: 400 })
    }

    // 1. 원본 폴더 유효성 검사 및 생성
    const resolvedFolderPath = path.resolve(folderPath)
    if (!fs.existsSync(resolvedFolderPath)) {
      fs.mkdirSync(resolvedFolderPath, { recursive: true })
    }

    // 2. 원본 파일 저장
    const fileName = file.name
    const filePath = path.join(resolvedFolderPath, fileName)
    
    // File 객체를 ArrayBuffer를 거쳐 Buffer로 변환하여 저장
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    fs.writeFileSync(filePath, buffer)

    // 3. 파일 파싱 (텍스트 추출)
    const textContent = await parseFileToText(filePath)
    if (!textContent || textContent.includes('[파일 읽기 실패:')) {
      return NextResponse.json({ error: '파일 내용 추출에 실패했습니다.', detail: textContent }, { status: 500 })
    }

    // 4. API 키 및 설정 검증
    const apiKey = process.env.FACTCHAT_API_KEY
    const apiUrl = process.env.FACTCHAT_API_URL

    if (!apiKey || !apiUrl) {
      return NextResponse.json({ error: '서버에 API 설정이 되어있지 않습니다. (.env.local 확인)' }, { status: 500 })
    }

    const isClaude = apiUrl.includes('anthropic')
    const targetUrl = apiUrl

    // 5. LLM에 요약 요청 프롬프트 생성
    const systemContent = `당신은 사용자의 문서를 읽고 핵심 내용을 구조화하여 깔끔한 마크다운(Markdown) 기반의 위키 문서를 작성해주는 AI 어시스턴트입니다.
제공된 텍스트를 분석하여, 불필요한 서식을 제거하고 다음의 구성으로 요약본을 만들어주세요:
1. 문서 요약 (1~2줄)
2. 주요 키워드 (리스트 형태)
3. 핵심 내용 및 상세 정보 (가독성 좋은 계층적 구조)
결과물은 마크다운 문법을 사용하여 깔끔하게 작성해주세요.`

    const payload = isClaude ? {
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 4096,
      system: systemContent,
      messages: [{ role: 'user', content: `다음은 첨부된 파일(${fileName})의 내용입니다:\n\n---\n\n${textContent}` }]
    } : {
      model: 'gemini-3.5-pro',
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: `다음은 첨부된 파일(${fileName})의 내용입니다:\n\n---\n\n${textContent}` }
      ]
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(isClaude
          ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
          : { Authorization: 'Bearer ' + apiKey }),
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[upload-and-summarize] LLM API Error:', errorText)
      return NextResponse.json({ error: 'AI 요약 요청 실패' }, { status: response.status })
    }

    const data = await response.json()
    let summaryMd = ''
    if (data.choices?.[0]?.message?.content) {
      summaryMd = data.choices[0].message.content
    } else if (data.content?.[0]?.text) {
      summaryMd = data.content[0].text
    } else {
      summaryMd = '요약 결과를 가져올 수 없습니다.'
    }

    // 6. 요약 MD 파일을 _wiki_summaries 폴더에 저장
    const wikiDir = path.join(resolvedFolderPath, '_wiki_summaries')
    if (!fs.existsSync(wikiDir)) {
      fs.mkdirSync(wikiDir, { recursive: true })
    }
    
    // 확장자 제거 후 .md 붙이기 (예: document.pdf -> document.md)
    const baseName = path.parse(fileName).name
    const mdFilePath = path.join(wikiDir, `${baseName}.md`)
    fs.writeFileSync(mdFilePath, summaryMd, 'utf-8')

    return NextResponse.json({ 
      success: true, 
      originalFile: fileName,
      summaryFile: `${baseName}.md`,
      message: '파일 저장 및 요약이 완료되었습니다.' 
    })

  } catch (error: any) {
    console.error('[upload-and-summarize] Server Error:', error)
    return NextResponse.json({ error: error.message || '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}
