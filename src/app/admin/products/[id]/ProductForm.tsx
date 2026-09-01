"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { Product } from "@/lib/products";
import { clearCutoutAction, saveProductAction, type AdminState } from "../../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending}>
      {pending ? "Saving…" : "Save product"}
    </button>
  );
}

export function ProductForm({ product }: { product: Product }) {
  const [state, action] = useActionState<AdminState, FormData>(saveProductAction, {});

  return (
    <div className="admin-edit">
      <form action={action} className="auth-form">
        <input type="hidden" name="id" value={product.id} />
        <input type="hidden" name="slug" value={product.slug} />

        {state.error ? (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p className="form-ok" role="status">
            Saved.
          </p>
        ) : null}

        <label className="field">
          <span className="field-label">Name</span>
          <input type="text" name="name" defaultValue={product.name} required />
          <span className="field-note">
            Replace the seeded placeholder with the real model, e.g. &ldquo;Jotul F 500
            Oslo&rdquo;.
          </span>
        </label>

        <label className="field">
          <span className="field-label">Description</span>
          <textarea name="summary" rows={4} defaultValue={product.summary ?? ""} />
        </label>

        <fieldset className="field-row">
          <legend className="field-label">Real dimensions (inches)</legend>
          <span className="field-note">
            Width is what the visualizer scales from — get it right and a customer sees the true
            footprint in their room.
          </span>
          <div className="dims">
            <label>
              Width
              <input
                type="number"
                name="width_in"
                min={1}
                max={200}
                step={0.25}
                defaultValue={product.width_in ? Number(product.width_in) : ""}
              />
            </label>
            <label>
              Height
              <input
                type="number"
                name="height_in"
                min={1}
                max={200}
                step={0.25}
                defaultValue={product.height_in ? Number(product.height_in) : ""}
              />
            </label>
            <label>
              Depth
              <input
                type="number"
                name="depth_in"
                min={1}
                max={200}
                step={0.25}
                defaultValue={product.depth_in ? Number(product.depth_in) : ""}
              />
            </label>
          </div>
        </fieldset>

        <label className="field">
          <span className="field-label">Manufacturer page</span>
          <input
            type="url"
            name="product_url"
            defaultValue={product.product_url ?? ""}
            placeholder="https://"
          />
        </label>

        <label className="field">
          <span className="field-label">Cutout image</span>
          <input type="file" name="cutout" accept="image/png,image/webp" />
          <span className="field-note">
            A transparent PNG, shot square-on with the product filling the frame. Transparent
            margins are trimmed automatically so the width matches the real dimension above.
          </span>
        </label>

        <label className="checkbox">
          <input type="checkbox" name="is_active" defaultChecked={product.is_active} />
          <span>Show this product in the visualizer</span>
        </label>

        <Submit />
      </form>

      <aside className="admin-preview">
        <h2>Current cutout</h2>
        {product.cutout_path ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.cutout_path} alt={`${product.name} cutout`} />
            <form action={clearCutoutAction}>
              <input type="hidden" name="id" value={product.id} />
              <button type="submit" className="linklike danger">
                Remove cutout
              </button>
            </form>
          </>
        ) : (
          <p className="muted">
            None yet — the visualizer is showing a {product.category} silhouette for this product.
          </p>
        )}
      </aside>
    </div>
  );
}
