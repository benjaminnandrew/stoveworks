import Link from "next/link";

import { signOutAction } from "./actions";

export function AccountNav() {
  return (
    <nav className="account-nav" aria-label="Account">
      <Link href="/account">Designs</Link>
      <Link href="/account/profile">Profile</Link>
      <Link href="/visualizer">Stove visualizer</Link>
      <Link href="/veneer">Stone veneer</Link>
      <form action={signOutAction}>
        <button type="submit" className="linklike">
          Sign out
        </button>
      </form>
    </nav>
  );
}
