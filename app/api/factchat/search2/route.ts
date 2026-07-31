import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import { parseFileToText } from '@/lib/fileParser'

export async function POST(req: Request) {
  console.log('[DEBUG] /api/factchat/search POST STARTED')
  try {
    const body = await req.json()
    const { query, model, useFolderContext, folderPath } = body

    if (!query) {
      return NextResponse.json({ error: '검색어를 입력해주세요.' }, { status: 400 })
    }

    const apiKey = process.env.FACTCHAT_API_KEY
    const apiUrl = process.env.FACTCHAT_API_URL

    if (!apiKey) {
      return NextResponse.json(
        { error: '서버에 API 키가 설정되지 않았습니다. .env.local 파일을 확인해주세요.' },
        { status: 500 }
      )
    }
    
    if (!apiUrl) {
      return NextResponse.json(
        { error: '서버에 API URL이 설정되지 않았습니다. .env.local 파일을 확인해주세요.' },
        { status: 500 }
      )
    }

    // 폴더 컨텍스트 읽기
    let folderContext = ''
    if (useFolderContext && folderPath && typeof folderPath === 'string') {
      try {
        const resolvedPath = path.resolve(folderPath)
        if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
          
          // 재귀적으로 파일 목록 수집 함수
          const walkSync = (dir: string, filelist: string[] = [], depth = 0) => {
            if (depth > 3) return filelist // 최대 3단계 깊이까지만 탐색
            const files = fs.readdirSync(dir)
            for (const file of files) {
              if (file.startsWith('.')) continue // 숨김 파일 무시
              const filepath = path.join(dir, file)
              try {
                if (fs.statSync(filepath).isDirectory()) {
                  filelist = walkSync(filepath, filelist, depth + 1)
                } else {
                  filelist.push(filepath)
                }
              } catch (e) {
                // 권한 오류 등 무시
              }
            }
            return filelist
          }

          const allFiles = walkSync(resolvedPath)
          
          // AI에게 제공할 '파일 목차 (경로 모음)' 생성
          const fileIndex = allFiles.map(f => f.replace(resolvedPath, '')).join('\n')
          folderContext += `[폴더 내 전체 파일 목록 (경로)]\n${fileIndex}\n\n`

          // 내용 추출은 토큰 제한을 위해 상위 15개 파일만 진행
          const filesToRead = allFiles.slice(0, 15)

          let readCount = 0
          for (const fullPath of filesToRead) {
            const relativePath = fullPath.replace(resolvedPath, '')
            const text = await parseFileToText(fullPath)
            if (text && !text.startsWith('[내용을 텍스트로 변환할 수 없는')) {
              folderContext += `\n\n--- 파일 경로: ${relativePath} ---\n${text.substring(0, 3000)}`
              readCount++
            }
          }
        }
      } catch (err) {
        console.error('Folder context error:', err)
      }
    }

    // 모델에 따른 엔드포인트 및 페이로드 분기
    let targetUrl = apiUrl
    let payload: any = {}
    const isClaude = model && model.includes('claude')
    const systemContent = '당신은 KBS 라디오 업무 인수인계 시스템의 검색 어시스턴트입니다. 사용자의 질문에 친절하고 정확하게 답변해주세요.' + 
      (folderContext ? `\n\n[참고 자료 - 사용자 지정 폴더 내용]\n${folderContext}` : '')

    if (isClaude) {
      // Claude 네이티브 API 엔드포인트로 변경
      targetUrl = 'https://factchat.mindlogic-kr-api.com/v1/gateway/claude/v1/messages/'
      payload = {
        model: model,
        max_tokens: 2048,
        system: systemContent,
        messages: [
          { role: 'user', content: query }
        ]
      }
    } else {
      payload = {
        model: model || 'gemini-3.5-flash-lite',
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: query },
        ]
      }
    }

    console.log(`[DEBUG] FactChat Fetch URL: ${targetUrl}`)
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(isClaude ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } : { Authorization: `Bearer ${apiKey}` }),
      },
      body: JSON.stringify(payload),
    })

    console.log(`[DEBUG] FactChat Fetch Status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[DEBUG] FactChat API Error:', errorText)
      // Next.js에서 404를 반환하면 HTML 404 페이지로 가로채는 버그 방지를 위해 502 사용
      const statusToReturn = response.status === 404 ? 502 : response.status
      console.log(`[DEBUG] Returning error status: ${statusToReturn}`)
      return NextResponse.json(
        { error: `API 요청 실패: ${response.status} ${response.statusText}` },
        { status: statusToReturn }
      )
    }

    const data = await response.json()
    
    // OpenAI 호환 응답인 경우 content 추출, 아니면 전체 JSON 문자열 반환
    let answer = ''
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      answer = data.choices[0].message.content
    } else if (data.response) { // 다른 흔한 응답 포맷
       answer = data.response
    } else if (data.answer) {
       answer = data.answer
    } else if (data.message) {
       answer = data.message
    } else {
       answer = JSON.stringify(data, null, 2)
    }

    console.log(`[DEBUG] /api/factchat/search RETURNING 200 with answer length: ${answer.length}`)
    return NextResponse.json({ answer })
  } catch (error: any) {
    console.error('[DEBUG] Search API Error Catch Block:', error)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    )
  }
}
