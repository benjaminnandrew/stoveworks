"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";

import { updateProfileAction } from "../actions";

type State = { ok?: boolean; error?: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export function ProfileForm({
  email,
  name,
  phone,
  redirectTo,
}: {
  email: string;
  name: string;
  phone: string;
  redirectTo: string | null;
}) {
  const [state, action] = useActionState<State, FormData>(updateProfileAction, {});
  const router = useRouter();

  useEffect(() => {
    if (state.ok && redirectTo) router.push(redirectTo);
  }, [state.ok, redirectTo, router]);

  return (
    <form action={action} className="auth-form">
      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && !redirectTo ? (
        <p className="form-ok" role="status">
          Saved.
        </p>
      ) : null}

      <label className="field">
        <span className="field-label">Email</span>
        <input type="email" value={email} readOnly disabled />
        <span className="field-note">This is how you sign in. Contact us to change it.</span>
      </label>

      <label className="field">
        <span className="field-label">Name</span>
        <input type="text" name="name" defaultValue={name} autoComplete="name" required autoFocus={!name} />
      </label>

      <label className="field">
        <span className="field-label">Phone (optional)</span>
        <input type="tel" name="phone" defaultValue={phone} autoComplete="tel" />
        <span className="field-note">Only used if you ask us about a design.</span>
      </label>

      <Submit />
    </form>
  );
}
