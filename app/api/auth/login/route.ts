import { NextRequest, NextResponse } from 'next/server'
import { verifyCredentials, createToken, COOKIE_NAME } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { id, password } = await req.json()

    if (!id || !password) {
      return NextResponse.json({ message: '아이디와 비밀번호를 입력하세요.' }, { status: 400 })
    }

    const role = await verifyCredentials(id, password)
    if (!role) {
      return NextResponse.json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    const token = await createToken(id, role)

    const response = NextResponse.json({ success: true, role })
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    })

    return response
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ message: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

