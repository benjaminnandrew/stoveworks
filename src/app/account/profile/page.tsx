import type { Metadata } from "next";

import { business } from "@/content/site";
import { requireUser } from "@/lib/auth";
import { AccountNav } from "../AccountNav";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const user = await requireUser();
  const { welcome } = await searchParams;

  return (
    <>
      <div className="page-title">
        <div className="wrap">
          <h1>{welcome ? `Welcome to ${business.shortName}` : "Profile"}</h1>
          <AccountNav />
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          <div className="auth-panel">
            {welcome ? (
              <p className="auth-lede">
                You&rsquo;re signed in. Tell us your name so we know who we&rsquo;re talking to when
                you send a design over.
              </p>
            ) : null}

            <ProfileForm
              email={user.email}
              name={user.name ?? ""}
              phone={user.phone ?? ""}
              redirectTo={welcome ? "/visualizer/" : null}
            />
          </div>
        </div>
      </div>
    </>
  );
}
