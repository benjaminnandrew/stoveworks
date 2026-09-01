"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { requestSignInLink, type SignInState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending}>
      {pending ? "Sending…" : "Email me a sign-in link"}
    </button>
  );
}

export function SignInForm() {
  const [state, action] = useActionState<SignInState, FormData>(requestSignInLink, {});

  return (
    <form action={action} className="auth-form" noValidate>
      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <label className="field">
        <span className="field-label">Email address</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
          placeholder="you@example.com"
        />
      </label>

      {/* Honeypot — hidden from people, irresistible to bots. */}
      <div className="honeypot" aria-hidden="true">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Submit />
    </form>
  );
}
