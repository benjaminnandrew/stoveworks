"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSignInToken, isValidEmail } from "@/lib/auth";
import { sendMail, signInEmail } from "@/lib/mail";
import { siteUrl } from "@/lib/site-url";

export type SignInState = { error?: string };

export async function requestSignInLink(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "");
  // Bots fill hidden fields; people do not.
  const trap = String(formData.get("company") ?? "");

  if (trap) redirect("/sign-in?sent=1");
  if (!isValidEmail(email)) return { error: "Please enter a valid email address." };

  const head = await headers();
  const ip =
    head.get("x-forwarded-for")?.split(",")[0]?.trim() ?? head.get("x-real-ip") ?? null;

  const result = await createSignInToken(email, ip);

  if (!result.ok) {
    return {
      error:
        "Too many sign-in requests for that address. Please wait a few minutes and try again.",
    };
  }

  const link = `${siteUrl}/auth/verify?token=${encodeURIComponent(result.token)}`;

  try {
    await sendMail({ to: email.trim(), ...signInEmail(link, result.isNewUser) });
  } catch (err) {
    console.error("sign-in email failed:", err);
    return { error: "We couldn't send that email just now. Please try again in a moment." };
  }

  redirect("/sign-in?sent=1");
}
