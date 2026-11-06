-- One statement. $1 query text, $2 query embedding, $3..$8 filters (NULL = any).
-- Visibility (searchable) is applied inside both retrievals (INV-07).
-- Source: docs/SPEC.md section 11.1
SET LOCAL hnsw.iterative_scan  = relaxed_order;
SET LOCAL hnsw.ef_search       = 100;
SET LOCAL hnsw.max_scan_tuples = 20000;

WITH q AS (SELECT websearch_to_tsquery('simple', $1) || websearch_to_tsquery('english', $1) AS tsq),
fts AS (
  SELECT d.doc_id, row_number() OVER (ORDER BY ts_rank_cd(d.tsv, q.tsq) DESC) AS r
  FROM search_docs d CROSS JOIN q
  WHERE d.searchable AND d.doc_type = 'entry' AND d.tsv @@ q.tsq
    AND ($3::text IS NULL OR d.kind = $3) AND ($4::text IS NULL OR d.outcome = $4)
    AND ($5::text IS NULL OR d.template = $5) AND ($6::uuid IS NULL OR $6 = ANY(d.topic_ids))
    AND ($7::bool IS NULL OR d.has_media = $7) AND ($8::bool IS NULL OR d.has_data = $8)
  ORDER BY ts_rank_cd(d.tsv, q.tsq) DESC LIMIT 50),
vec_raw AS MATERIALIZED (
  SELECT d.doc_id, d.embedding <=> $2::vector AS dist
  FROM search_docs d
  WHERE d.searchable AND d.doc_type = 'entry'
    AND ($3::text IS NULL OR d.kind = $3) AND ($4::text IS NULL OR d.outcome = $4)
    AND ($5::text IS NULL OR d.template = $5) AND ($6::uuid IS NULL OR $6 = ANY(d.topic_ids))
    AND ($7::bool IS NULL OR d.has_media = $7) AND ($8::bool IS NULL OR d.has_data = $8)
  ORDER BY d.embedding <=> $2::vector LIMIT 50),
vec AS (SELECT doc_id, row_number() OVER (ORDER BY dist) AS r FROM vec_raw)
SELECT doc_id, sum(1.0 / (60 + r)) AS rrf
FROM (SELECT doc_id, r FROM fts UNION ALL SELECT doc_id, r FROM vec) u
GROUP BY doc_id ORDER BY rrf DESC LIMIT 50;
