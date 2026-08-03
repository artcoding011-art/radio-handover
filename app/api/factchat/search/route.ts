import { NextResponse } from 'next/server'
import * as fsModule from 'fs'
import * as path from 'path'
import { parseFileToText } from '@/lib/fileParser'
import { buildDbContext, DbContextOptions } from '@/lib/dbContextBuilder'

export async function POST(req: Request) {
  console.log('[DEBUG] /api/factchat/search POST STARTED')
  try {
    const body = await req.json()
    const { query, model, useFolderContext, folderPath, useDbContext, dbContextOptions } = body

    if (!query) {
      return NextResponse.json({ error: '검색어를 입력해주세요.' }, { status: 400 })
    }

    const apiKey = process.env.FACTCHAT_API_KEY
    const apiUrl = process.env.FACTCHAT_API_URL

    if (!apiKey) {
      return NextResponse.json({ error: '서버에 API 키가 설정되지 않았습니다. .env.local 파일을 확인해주세요.' }, { status: 500 })
    }
    if (!apiUrl) {
      return NextResponse.json({ error: '서버에 API URL이 설정되지 않았습니다. .env.local 파일을 확인해주세요.' }, { status: 500 })
    }

    // DB 콘텍스트
    let dbContextStr = ''
    let dbSummary = ''
    if (useDbContext && dbContextOptions) {
      try {
        const opts: DbContextOptions = {
          useHandover: !!dbContextOptions.useHandover,
          useMwInspection: !!dbContextOptions.useMwInspection,
          useSchedule: !!dbContextOptions.useSchedule,
          useTask: !!dbContextOptions.useTask,
          useStaff: !!dbContextOptions.useStaff,
          from: dbContextOptions.from || undefined,
          to: dbContextOptions.to || undefined,
        }
        const result = await buildDbContext(query, opts, 7)
        dbContextStr = result.context
        dbSummary = result.summary
        console.log('[DEBUG] DB Context loaded: ' + result.summary)
      } catch (err) {
        console.error('[DEBUG] DB context build error:', err)
      }
    }

    // 폴더 콘텍스트 (data/wiki/md 하드코딩)
    let folderContext = ''
    if (useFolderContext) {
      try {
        const mdDir = path.join(process.cwd(), 'data', 'wiki', 'md')
        if (fsModule.existsSync(mdDir) && fsModule.statSync(mdDir).isDirectory()) {
          const files = fsModule.readdirSync(mdDir)
          const mdFiles = files.filter(f => f.endsWith('.md'))
          
          if (mdFiles.length > 0) {
            folderContext += '[학습된 위키 문서 목록]\n' + mdFiles.join('\n') + '\n\n'
            for (const file of mdFiles) {
              const filepath = path.join(mdDir, file)
              try {
                const text = fsModule.readFileSync(filepath, 'utf-8')
                folderContext += '\n\n--- 문서: ' + file + ' ---\n' + text.substring(0, 3000)
              } catch (e) {}
            }
          }
        }
      } catch (err) {
        console.error('Folder context error:', err)
      }
    }

    // 시스템 프롬프트 조립
    let systemContent = '당신은 KBS 라디오 업무 인수인계 시스템의 검색 어시스턴트입니다. 사용자의 질문에 친절하고 정확하게 답변해주세요.'
    if (dbSummary) {
      systemContent += '\n\n참고로, 이 답변을 생성하기 위해 ' + dbSummary
    }
    if (dbContextStr) {
      systemContent += '\n\n' + dbContextStr
    }
    if (folderContext) {
      systemContent += '\n\n[참고 자료 - 사용자 지정 폴더 내용]\n' + folderContext
    }

    // 모델 분기
    let targetUrl = apiUrl
    let payload: any = {}
    const isClaude = model && model.includes('claude')

    if (isClaude) {
      targetUrl = 'https://factchat.mindlogic-kr-api.com/v1/gateway/claude/v1/messages/'
      payload = {
        model,
        max_tokens: 2048,
        system: systemContent,
        messages: [{ role: 'user', content: query }]
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

    console.log('[DEBUG] FactChat Fetch URL: ' + targetUrl)
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

    console.log('[DEBUG] FactChat Fetch Status: ' + response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[DEBUG] FactChat API Error:', errorText)
      const statusToReturn = response.status === 404 ? 502 : response.status
      return NextResponse.json(
        { error: 'API 요청 실패: ' + response.status + ' ' + response.statusText },
        { status: statusToReturn }
      )
    }

    const data = await response.json()
    let answer = ''
    if (data.choices?.[0]?.message?.content) {
      answer = data.choices[0].message.content
    } else if (Array.isArray(data.content) && data.content[0]?.text) {
      answer = data.content[0].text
    } else if (data.response) {
      answer = data.response
    } else if (data.answer) {
      answer = data.answer
    } else if (data.message) {
      answer = data.message
    } else {
      answer = JSON.stringify(data, null, 2)
    }

    console.log('[DEBUG] /api/factchat/search RETURNING 200 with answer length: ' + answer.length)
    return NextResponse.json({ answer, dbSummary })
  } catch (error: any) {
    console.error('[DEBUG] Search API Error Catch Block:', error)
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    )
  }
}
