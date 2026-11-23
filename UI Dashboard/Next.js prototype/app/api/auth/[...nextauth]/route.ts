import { NextAuthOptions } from "next-auth"
import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"


const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!

const allowedEmails = (process.env.ALLOWED_EMAILS || "").split(",")

console.log("Allowed emails:", allowedEmails);

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
            /*
            if (!profile?.email) {
                return false
            }
            if (account?.provider === "google") {
                
                const allowedDomain = "example.com"
                const emailDomain = profile.email.split("@")[1]
                if (emailDomain !== allowedDomain) {
                    return false
                }
                
               return allowedEmails.includes(profile.email)
            }

            return false
            */
        },
    },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }