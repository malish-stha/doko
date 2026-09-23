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
  secret: process.env.AUTH_SECRET,
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
