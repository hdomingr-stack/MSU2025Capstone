import { NextAuthOptions } from "next-auth"
import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"


const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!

const allowedEmails = (process.env.ALLOWED_EMAILS || "").split(",")

const authOptions: NextAuthOptions = {
    session: {
        strategy: "jwt",
    },
    providers: [
        GoogleProvider({
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
        }),
    ],
    callbacks: {
        async signIn({ account, profile }) {
            if (!profile?.email) {
                return false
            }
            return allowedEmails.includes(profile.email)
        },
        // When user signs in for the first time, grab googleId from profile and store in token 
        async jwt({ token, account, profile}) {
            if (profile) {
                token.googleId = profile.sub; 
            }
            return token
        },
        // Add the google id into the session of the user
        async session({ session, token }) {
            if (session.user && token.googleId) {
                session.user.id = token.googleId as string;
            }
            return session;
        },
    },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }