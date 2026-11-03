"use client";
import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    usernameClient({ displayUsername: false }),
    inferAdditionalFields({
      user: {
        role: { type: "string", required: false, input: false },
        phone: { type: "string", required: false },
      },
    }),
  ],
});
