import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireStaff } from "@/lib/auth";
import { getProduct } from "@/lib/products";
import { ProductForm } from "./ProductForm";

export const metadata: Metadata = { title: "Edit product", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  return (
    <>
      <div className="page-title">
        <div className="wrap">
          <h1>{product.name}</h1>
          <p className="page-lede">
            <Link href="/admin">← Back to inventory</Link>
          </p>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          <ProductForm product={product} />
        </div>
      </div>
    </>
  );
}
