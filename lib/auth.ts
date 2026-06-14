import NextAuth from 'next-auth'
import { authConfig } from '../auth.config'
import { getDb } from './db'
import { ulid } from './ulid'

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  logger: {
    error: (error) => console.error('[auth][error]', error),
  },
  callbacks: {
    async signIn({ user }) {
      try {
        const db = getDb()
        await db.execute({
          sql: `INSERT INTO users (id, name, email, image) VALUES (?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET name=excluded.name, image=excluded.image`,
          args: [ulid(), user.name ?? '', user.email!, user.image ?? null],
        })
        return true
      } catch (err) {
        const e = err as any
        console.error('[auth][signIn] name:', e?.name)
        console.error('[auth][signIn] message:', e?.message)
        console.error('[auth][signIn] code:', e?.code)
        return false
      }
    },
    async session({ session }) {
      if (!session.user.email) return session
      const db = getDb()
      const result = await db.execute({
        sql: 'SELECT id FROM users WHERE email = ?',
        args: [session.user.email],
      })
      session.user.id = result.rows[0]?.id as string
      return session
    },
  },
})
