import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),

  ],
  pages: {
    signIn: '/sign-in',
  },
  callbacks: {
    async jwt({ token, profile }) {
      if (profile?.email) {
        token.email = profile.email
        token.name = profile.name
        token.picture = profile.picture
        token.sub = profile.sub!
        token.iss = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'doko'
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string
        session.user.name = token.name as string
        session.user.image = token.picture as string
      }
      return session
    },
  },
})
