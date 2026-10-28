import type { Metadata } from "next";

import { ModelDetail } from "@/components/ModelDetail";
import { ModelModal } from "@/components/ModelModal";
import { loadModelPage, modelMetadata } from "@/lib/model-page";

type Props = { params: Promise<{ slug: string; model: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, model } = await params;
  return modelMetadata(slug, model);
}

/**
 * A model clicked in a list opens here, over the list (Ben, 22 Oct 2026). The
 * address is the model's page, so a refresh shows src/app/brands/[slug]/[model].
 */
export default async function ModelPopup({ params }: Props) {
  const { slug, model } = await params;
  const data = await loadModelPage(slug, model);
  if (!data) {
    return (
      <ModelModal title="Model not found">
        <p>We couldn&rsquo;t find that model in the current lineup.</p>
      </ModelModal>
    );
  }
  return (
    <ModelModal title={`${data.brand.name} ${data.model.name}`} subtitle={data.view.typeLine}>
      <ModelDetail data={data} variant="modal" />
    </ModelModal>
  );
}
