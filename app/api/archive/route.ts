import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  createArchivePost,
  getArchiveIndex,
  sortArchivePosts,
} from '@/lib/githubArchive'

export const dynamic = 'force-dynamic'

// GET /api/archive - 자료실 게시글 목록 조회 (검색 지원)
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const query = (searchParams.get('q') || '').trim().toLowerCase()
    const forceRefresh = searchParams.get('refresh') === '1'

    const index = await getArchiveIndex(forceRefresh)
    let posts = sortArchivePosts(index.posts)

    if (query) {
      posts = posts.filter((post) => {
        const titleMatch = post.title.toLowerCase().includes(query)
        const authorMatch = post.author.toLowerCase().includes(query)
        const fileMatch = (post.attachmentNames || []).some((name) =>
          name.toLowerCase().includes(query)
        )
        return titleMatch || authorMatch || fileMatch
      })
    }

    return NextResponse.json({
      posts,
      total: posts.length,
    })
  } catch (err: any) {
    console.error('[GET /api/archive] error:', err)
    return NextResponse.json(
      { message: err?.message || '자료실 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// POST /api/archive - 새 자료실 게시글 작성
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }
  if (session.role === 'readonly') {
    return NextResponse.json({ message: '읽기 전용 계정은 글을 작성할 수 없습니다.' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, title, author, isNotice, content, attachments, images } = body

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ message: '제목을 입력해주세요.' }, { status: 400 })
    }

    const post = await createArchivePost({
      id: typeof id === 'string' ? id : undefined,
      title: title.trim(),
      author: typeof author === 'string' && author.trim() ? author.trim() : session.userId,
      isNotice: Boolean(isNotice),
      content: typeof content === 'string' ? content : '',
      attachments: Array.isArray(attachments) ? attachments : [],
      images: Array.isArray(images) ? images : [],
    })

    return NextResponse.json({ success: true, post }, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/archive] error:', err)
    return NextResponse.json(
      { message: err?.message || '게시글 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
