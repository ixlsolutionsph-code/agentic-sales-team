import EmptyState from "@/components/EmptyState";
import { requireUser } from "@/lib/auth/guard";

// Milestone 6 adds folders and products. Until then: the empty state.
export default async function ProductsPage() {
  await requireUser();
  return (
    <div className="page">
      <EmptyState icon="products" title="No products yet" />
    </div>
  );
}
