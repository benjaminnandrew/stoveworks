"use client";

import { useState } from "react";

/**
 * Shared by both visual tools: the "this is a sample room" bar shown while the
 * demo photo is up, and drag-and-drop of a replacement photo anywhere on the tool.
 */

export function DemoBanner({ onFile }: { onFile: (file: File) => void }) {
  return (
    <div className="demo-banner">
      <p>
        <strong>This is a sample room.</strong> Try it out here, then use a photo of your own
        &mdash; a straight-on shot of the wall works best.
      </p>
      <label className="btn tool-file">
        Upload your photo
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </label>
    </div>
  );
}

/** Props to spread on the tool's column so a photo can be dropped onto it. */
export function usePhotoDrop(onFile: (file: File) => void) {
  const [over, setOver] = useState(false);

  return {
    over,
    dropProps: {
      onDragOver: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setOver(true);
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      },
    },
  };
}
