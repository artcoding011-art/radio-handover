import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'radio-handover-secret-key-2024'
)

const COOKIE_NAME = 'radio_session'

// 관리자 계정 (환경변수로 override 가능)
const ADMIN_ID = process.env.ADMIN_ID || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin'

// 읽기전용 계정 (환경변수로 override 가능)
const READONLY_ID = process.env.READONLY_ID || 'radio'
const READONLY_PASSWORD = process.env.READONLY_PASSWORD || 'radio'

export type UserRole = 'admin' | 'readonly'

export interface SessionUser {
  userId: string
  role: UserRole
}

// 자격증명 검증 후 역할 반환 (실패 시 null)
export async function verifyCredentials(id: string, password: string): Promise<UserRole | null> {
  if (id === ADMIN_ID && password === ADMIN_PASSWORD) return 'admin'
  if (id === READONLY_ID && password === READONLY_PASSWORD) return 'readonly'
  return null
}

export async function createToken(userId: string, role: UserRole): Promise<string> {
  return new SignJWT({ userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const role = (payload.role as UserRole) || 'admin' // 기존 토큰 하위 호환
    return { userId: payload.userId as string, role }
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

export { COOKIE_NAME }

