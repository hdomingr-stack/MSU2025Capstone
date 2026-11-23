// This file adds the id attribute to the Session interface 
// and the googleId attribute to the JWT interface 

import NextAuth from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            name?: string | null;
            email?: string | null;
            id: string; // Add id for the google id to be stored for database storage
        };
    }

    interface JWT {
        googleId?: string; // Add googleId to be added to session.user.id
    }
}