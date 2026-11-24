-- Written by hand: Drizzle does not manage vector indexes.
CREATE INDEX IF NOT EXISTS "products_embedding_idx" ON "products" USING hnsw ("embedding" vector_cosine_ops);
