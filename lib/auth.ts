import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import crypto from 'node:crypto'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'ekb-secret-2026')
const DATA_DIR = join(process.cwd(), 'data')
const USERS_FILE = join(DATA_DIR, 'users.json')
const DEPARTMENTS_FILE = join(DATA_DIR, 'departments.json')
const INVITE_FILE = join(DATA_DIR, 'invite.json')
const ADMIN_KEY = process.env.ADMIN_REGISTER_KEY || 'ENTERPRISE-ADMIN-2026'

export interface StoredUser {
  id: string; name: string; password: string
  role: 'admin' | 'user'; permissionLevel: number
  email?: string; phone?: string; department?: string
  position?: string; employeeId?: string; createdAt?: string
}
export interface SessionUser {
  id: string; name: string
  role: 'admin' | 'user'; permissionLevel: number
}
export interface Department {
  id: string; name: string; managerId?: string; createdAt: string
}
export interface InviteData {
  token: string; createdAt: string
  records: { userId: string; name: string; joinedAt: string }[]
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
}

export function loadUsers(): Record<string, StoredUser> {
  ensureDataDir()
  if (!existsSync(USERS_FILE)) {
    const defaults: Record<string, StoredUser> = {
      admin: { id: 'admin', name: '管理员', password: hashPassword('admin2026'), role: 'admin', permissionLevel: 2 },
      user:  { id: 'user',  name: '普通用户', password: hashPassword('user2026'),  role: 'user',  permissionLevel: 0 },
    }
    writeFileSync(USERS_FILE, JSON.stringify(defaults, null, 2))
    return defaults
  }
  const users = JSON.parse(readFileSync(USERS_FILE, 'utf-8'))
  let dirty = false
  for (const key of Object.keys(users)) {
    if (users[key].permissionLevel === undefined) {
      users[key].permissionLevel = users[key].role === 'admin' ? 2 : 0
      dirty = true
    }
  }
  if (dirty) writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
  return users
}

function saveUsers(users: Record<string, StoredUser>) {
  ensureDataDir()
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
}

export function loadDepartments(): Department[] {
  ensureDataDir()
  if (!existsSync(DEPARTMENTS_FILE)) {
    writeFileSync(DEPARTMENTS_FILE, JSON.stringify([], null, 2))
    return []
  }
  return JSON.parse(readFileSync(DEPARTMENTS_FILE, 'utf-8'))
}

export function saveDepartments(depts: Department[]) {
  ensureDataDir()
  writeFileSync(DEPARTMENTS_FILE, JSON.stringify(depts, null, 2))
}

export function loadInvite(): InviteData {
  ensureDataDir()
  if (!existsSync(INVITE_FILE)) {
    const data: InviteData = {
      token: crypto.randomBytes(8).toString('hex'),
      createdAt: new Date().toISOString(),
      records: [],
    }
    writeFileSync(INVITE_FILE, JSON.stringify(data, null, 2))
    return data
  }
  return JSON.parse(readFileSync(INVITE_FILE, 'utf-8'))
}

export function saveInvite(data: InviteData) {
  ensureDataDir()
  writeFileSync(INVITE_FILE, JSON.stringify(data, null, 2))
}

export function resetInviteToken(): InviteData {
  const data = loadInvite()
  data.token = crypto.randomBytes(8).toString('hex')
  data.createdAt = new Date().toISOString()
  saveInvite(data)
  return data
}

export function validateInviteToken(token: string): boolean {
  const data = loadInvite()
  return data.token === token
}

export function recordInviteUsage(userId: string, name: string) {
  const data = loadInvite()
  if (!data.records) data.records = []
  data.records.push({ userId, name, joinedAt: new Date().toISOString() })
  saveInvite(data)
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 32).toString('hex')
  return salt + ':' + hash
}

function checkPassword(plain: string, stored: string): boolean {
  if (stored.includes(':')) {
    const [salt, hash] = stored.split(':')
    const derived = crypto.scryptSync(plain, salt, 32).toString('hex')
    return derived === hash
  }
  return plain === stored
}

export function verifyCredentials(username: string, password: string): SessionUser | null {
  const users = loadUsers()
  const u = users[username]
  if (u && checkPassword(password, u.password)) {
    return { id: u.id, name: u.name, role: u.role, permissionLevel: u.permissionLevel ?? (u.role === 'admin' ? 2 : 0) }
  }
  return null
}

export function registerUser(
  username: string, password: string, name?: string, adminKey?: string, inviteToken?: string
): { ok: boolean; error?: string; user?: SessionUser } {
  if (!username || username.length < 2) return { ok: false, error: '用户名至少2个字符' }
  if (!password || password.length < 6) return { ok: false, error: '密码至少6位' }
  if (!/^[\w一-龥]+$/.test(username)) return { ok: false, error: '用户名只能包含字母、数字、下划线或中文' }
  const users = loadUsers()
  if (users[username]) return { ok: false, error: '用户名已存在' }

  let role: 'admin' | 'user' = 'user'
  let permissionLevel = 0
  if (adminKey) {
    if (adminKey !== ADMIN_KEY) return { ok: false, error: '管理员密钥无效' }
    role = 'admin'
    permissionLevel = 2
  }
  if (inviteToken) {
    if (!validateInviteToken(inviteToken)) return { ok: false, error: '邀请链接无效' }
  }

  const displayName = name || username
  users[username] = {
    id: username, name: displayName, password: hashPassword(password),
    role, permissionLevel, createdAt: new Date().toISOString(),
  }
  saveUsers(users)
  if (inviteToken) recordInviteUsage(username, displayName)
  return { ok: true, user: { id: username, name: displayName, role, permissionLevel } }
}

export function createUserByAdmin(
  username: string,
  password: string,
  profile: {
    name?: string; email?: string; phone?: string; department?: string
    position?: string; employeeId?: string
    role?: 'admin' | 'user'; permissionLevel?: number
  }
): { ok: boolean; error?: string; user?: SessionUser } {
  if (!username || username.length < 2) return { ok: false, error: '用户名至少2个字符' }
  if (!password || password.length < 6) return { ok: false, error: '密码至少6位' }
  if (!/^[\w一-龥]+$/.test(username)) return { ok: false, error: '用户名只能包含字母、数字、下划线或中文' }
  const users = loadUsers()
  if (users[username]) return { ok: false, error: '用户名已存在' }

  const role = profile.role || 'user'
  const permissionLevel = profile.permissionLevel ?? (role === 'admin' ? 2 : 0)
  const displayName = profile.name || username

  users[username] = {
    id: username, name: displayName, password: hashPassword(password),
    role, permissionLevel,
    email: profile.email || undefined,
    phone: profile.phone || undefined,
    department: profile.department || undefined,
    position: profile.position || undefined,
    employeeId: profile.employeeId || undefined,
    createdAt: new Date().toISOString(),
  }
  saveUsers(users)
  return { ok: true, user: { id: username, name: displayName, role, permissionLevel } }
}

export function deleteUser(userId: string): boolean {
  const users = loadUsers()
  if (!users[userId]) return false
  delete users[userId]
  saveUsers(users)
  return true
}

export function updateUser(
  userId: string,
  updates: Partial<Pick<StoredUser, 'role' | 'permissionLevel' | 'name' | 'email' | 'phone' | 'department' | 'position' | 'employeeId'>>
): boolean {
  const users = loadUsers()
  if (!users[userId]) return false
  Object.assign(users[userId], updates)
  saveUsers(users)
  return true
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(SECRET)
  const c = await cookies()
  c.set('ekb_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 86400 })
}

const _sessionCache = new Map<string, { session: SessionUser; exp: number }>()

export async function getSession(): Promise<SessionUser | null> {
  try {
    const c = await cookies()
    const token = c.get('ekb_token')?.value
    if (!token) return null
    const hit = _sessionCache.get(token)
    if (hit && hit.exp > Date.now()) return hit.session
    const { payload } = await jwtVerify(token, SECRET)
    const p = payload as unknown as SessionUser
    if (p.permissionLevel === undefined) p.permissionLevel = p.role === 'admin' ? 2 : 0
    _sessionCache.set(token, { session: p, exp: Date.now() + 300_000 })
    return p
  } catch {
    return null
  }
}

export async function deleteSession() {
  const c = await cookies()
  c.delete('ekb_token')
}
