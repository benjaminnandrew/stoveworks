import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { currentUser } from "@/lib/auth";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to your Hayward Stoveworks account to save room photos and stove designs from the visualizer.",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; next?: string; expired?: string }>;
}) {
  const user = await currentUser();
  if (user) redirect("/account/");

  const { sent, expired } = await searchParams;

  return (
    <>
      <div className="page-title">
        <div className="wrap">
          <h1>{sent ? "Check your email" : "Sign in"}</h1>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          <div className="auth-panel">
            {sent ? (
              <div className="prose">
                <p>
                  If that address belongs to an account — or is ready to become one — a sign-in
                  link is on its way. It works once and expires in 15 minutes.
                </p>
                <p>
                  Nothing arrived? Check your spam folder, then{" "}
                  <Link href="/sign-in/">try again</Link>.
                </p>
              </div>
            ) : (
              <>
                {expired ? (
                  <p className="form-error" role="alert">
                    That sign-in link has expired or was already used. Request a fresh one below.
                  </p>
                ) : null}

                <p className="auth-lede">
                  We don&rsquo;t use passwords. Enter your email and we&rsquo;ll send you a link
                  that signs you straight in.
                </p>

                <SignInForm />

                <p className="auth-note">
                  New here? Entering your email creates your account — no extra steps.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
