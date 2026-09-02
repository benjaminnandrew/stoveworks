import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireStaff } from "@/lib/auth";
import { getStoneProduct } from "@/lib/stone";
import { StoneForm } from "./StoneForm";

export const metadata: Metadata = { title: "Edit stone profile", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminStoneProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const stone = await getStoneProduct(id);
  if (!stone) notFound();

  return (
    <>
      <div className="page-title">
        <div className="wrap">
          <h1>{stone.texture}</h1>
          <p className="page-lede">
            <Link href="/admin/stone">← Back to the stone catalogue</Link>
          </p>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          <StoneForm stone={stone} />
        </div>
      </div>
    </>
  );
}
