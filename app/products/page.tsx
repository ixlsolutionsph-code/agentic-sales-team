import { requireUser } from "@/lib/auth/guard";
import ProductsClient from "./ProductsClient";

export default async function ProductsPage() {
  await requireUser();
  return <ProductsClient />;
}
