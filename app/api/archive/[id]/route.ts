import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  deleteArchivePost,
  getArchivePost,
  updateArchivePost,
  validatePostId,
} from '@/lib/githubArchive'

export const dynamic = 'force-dynamic'

// GET /api/archive/[id] - 게시글 상세 조회
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }

  const { id } = params
  if (!validatePostId(id)) {
    return NextResponse.json({ message: '잘못된 게시글 ID입니다.' }, { status: 400 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const forceRefresh = searchParams.get('refresh') === '1'
    const post = await getArchivePost(id, forceRefresh)
    if (!post) {
      return NextResponse.json({ message: '게시글을 찾을 수 없습니다.' }, { status: 404 })
    }
    return NextResponse.json({ post })
  } catch (err: any) {
    console.error(`[GET /api/archive/${id}] error:`, err)
    return NextResponse.json(
      { message: err?.message || '게시글을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// PUT /api/archive/[id] - 게시글 수정
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }
  if (session.role === 'readonly') {
    return NextResponse.json({ message: '읽기 전용 계정은 글을 수정할 수 없습니다.' }, { status: 403 })
  }

  const { id } = params
  if (!validatePostId(id)) {
    return NextResponse.json({ message: '잘못된 게시글 ID입니다.' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const { title, author, isNotice, content, attachments, images } = body

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ message: '제목을 입력해주세요.' }, { status: 400 })
    }

    const updated = await updateArchivePost(id, {
      title: title.trim(),
      author: typeof author === 'string' && author.trim() ? author.trim() : session.userId,
      isNotice: Boolean(isNotice),
      content: typeof content === 'string' ? content : '',
      attachments: Array.isArray(attachments) ? attachments : [],
      images: Array.isArray(images) ? images : [],
    })

    if (!updated) {
      return NextResponse.json({ message: '게시글을 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ success: true, post: updated })
  } catch (err: any) {
    console.error(`[PUT /api/archive/${id}] error:`, err)
    return NextResponse.json(
      { message: err?.message || '게시글 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE /api/archive/[id] - 게시글 및 첨부파일 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
  }
  if (session.role === 'readonly') {
    return NextResponse.json({ message: '읽기 전용 계정은 글을 삭제할 수 없습니다.' }, { status: 403 })
  }

  const { id } = params
  if (!validatePostId(id)) {
    return NextResponse.json({ message: '잘못된 게시글 ID입니다.' }, { status: 400 })
  }

  try {
    await deleteArchivePost(id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error(`[DELETE /api/archive/${id}] error:`, err)
    return NextResponse.json(
      { message: err?.message || '게시글 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
