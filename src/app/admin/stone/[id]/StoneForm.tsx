"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { StoneProduct } from "@/lib/stone";
import { clearSwatchAction, saveStoneAction, type AdminState } from "../../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending}>
      {pending ? "Saving…" : "Save profile"}
    </button>
  );
}

export function StoneForm({ stone }: { stone: StoneProduct }) {
  const [state, action] = useActionState<AdminState, FormData>(saveStoneAction, {});

  return (
    <div className="admin-edit">
      <form action={action} className="auth-form">
        <input type="hidden" name="id" value={stone.id} />
        <input type="hidden" name="slug" value={stone.slug} />

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

        <div className="dims">
          <label>
            Texture / profile
            <input type="text" name="texture" defaultValue={stone.texture} required />
          </label>
          <label>
            Colour
            <input type="text" name="color" defaultValue={stone.color ?? ""} placeholder="e.g. Bucks County" />
          </label>
          <label>
            Display name
            <input type="text" name="name" defaultValue={stone.name} />
          </label>
        </div>

        <label className="field">
          <span className="field-label">Description</span>
          <textarea name="summary" rows={3} defaultValue={stone.summary ?? ""} />
        </label>

        <label className="field">
          <span className="field-label">Swatch image</span>
          <input type="file" name="swatch" accept="image/jpeg,image/png,image/webp" />
          <span className="field-note">
            Must tile seamlessly — the left edge has to meet the right, and the top the bottom, or
            the wall will show a grid. Shoot or scan a flat, evenly lit panel with no shadows and no
            perspective. It is stored as-is; nothing is cropped.
          </span>
        </label>

        <fieldset className="field-row">
          <legend className="field-label">What area does one tile of that image cover?</legend>
          <span className="field-note">
            The single most important number here. Get it wrong and the stone comes out the wrong
            size on every customer&rsquo;s wall.
          </span>
          <div className="dims">
            <label>
              Width (in)
              <input
                type="number"
                name="swatch_width_in"
                min={1}
                max={200}
                step={0.5}
                defaultValue={Number(stone.swatch_width_in)}
                required
              />
            </label>
            <label>
              Height (in)
              <input
                type="number"
                name="swatch_height_in"
                min={1}
                max={200}
                step={0.5}
                defaultValue={Number(stone.swatch_height_in)}
                required
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="field-row">
          <legend className="field-label">Coverage</legend>
          <span className="field-note">
            From the manufacturer&rsquo;s coverage chart. Seeded with typical figures — confirm
            them, they vary by profile.
          </span>
          <div className="dims">
            <label>
              Flats: sq ft per box
              <input
                type="number"
                name="flat_sqft_per_box"
                min={0.5}
                max={200}
                step={0.5}
                defaultValue={stone.flat_sqft_per_box ? Number(stone.flat_sqft_per_box) : ""}
              />
            </label>
            <label>
              Corners: lin ft per box
              <input
                type="number"
                name="corner_lnft_per_box"
                min={0.5}
                max={200}
                step={0.5}
                defaultValue={stone.corner_lnft_per_box ? Number(stone.corner_lnft_per_box) : ""}
              />
            </label>
          </div>
        </fieldset>

        <label className="field">
          <span className="field-label">Manufacturer page</span>
          <input type="url" name="product_url" defaultValue={stone.product_url ?? ""} placeholder="https://" />
        </label>

        <label className="checkbox">
          <input type="checkbox" name="is_active" defaultChecked={stone.is_active} />
          <span>Offer this profile in the mock-up tool</span>
        </label>

        <Submit />
      </form>

      <aside className="admin-preview">
        <h2>Current swatch</h2>
        {stone.swatch_path ? (
          <>
            {/* Shown tiled, which is how a bad seam gives itself away. */}
            <div
              className="swatch-preview"
              style={{ backgroundImage: `url(${stone.swatch_path})`, backgroundSize: "50% 50%" }}
            />
            <p className="field-note">
              Shown at 2×2 repeat. If you can see the joins, the image does not tile.
            </p>
            <form action={clearSwatchAction}>
              <input type="hidden" name="id" value={stone.id} />
              <button type="submit" className="linklike danger">
                Remove swatch
              </button>
            </form>
          </>
        ) : (
          <>
            <div
              className="swatch-preview is-placeholder"
              style={{ backgroundImage: "url(/stone/ledgestone-grey.png)", backgroundSize: "50% 50%" }}
            />
            <p className="muted">
              None yet — the tool is showing a generic sample texture for this profile, labelled as
              such.
            </p>
          </>
        )}
      </aside>
    </div>
  );
}
