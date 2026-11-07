/**
 * Load-test data for one field note's discussion. Development only: it writes
 * synthetic accounts and responses into the database in DATABASE_URL.
 *   node scripts/seed-discussion.mjs <entry-id> [count=100000] [people=2000]
 */
import pg from "pg";

const [entryId, count = "100000", people = "2000"] = process.argv.slice(2);
if (!entryId || !process.env.DATABASE_URL) {
  console.error(
    "Usage: DATABASE_URL=… node scripts/seed-discussion.mjs <entry-id> [count] [people]",
  );
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const started = Date.now();
await client.query("BEGIN");
await client.query(
  `INSERT INTO web.accounts (id, name, role)
   SELECT gen_random_uuid(), 'Load tester ' || g, (ARRAY['Farmer','Student','Engineer','Technician',''])[1 + g % 5]
   FROM generate_series(1, $1::int) g`,
  [Number(people)],
);
await client.query(
  `INSERT INTO web.explanations (id, entry_id, owner, title, detail)
   SELECT gen_random_uuid(), $1, (SELECT id FROM web.accounts WHERE name LIKE 'Load tester %' LIMIT 1),
          'Load-test explanation ' || g, 'Synthetic explanation for performance testing.'
   FROM generate_series(1, 6) g`,
  [entryId],
);
await client.query(
  `WITH people AS (SELECT array_agg(id) AS ids FROM web.accounts WHERE name LIKE 'Load tester %'),
        explanations AS (SELECT array_agg(id::text) AS ids FROM web.explanations WHERE entry_id = $1)
   INSERT INTO web.comments (id, entry_id, explanation_id, owner, kind, body, helpful, created)
   SELECT gen_random_uuid(), $1,
          CASE WHEN k IN ('supports', 'disputes') THEN e.ids[1 + (g % array_length(e.ids, 1))] END,
          p.ids[1 + (g % array_length(p.ids, 1))],
          k,
          'Load-test response ' || g || '. ' ||
            (ARRAY['I tried this in a humid week and saw a smaller effect.',
                   'Shade made more difference than the sand in my case.',
                   'How long did you keep the tomatoes before checking?',
                   'Measured 4 degrees cooler inside the inner pot at noon.',
                   'Did not work for me with larger tomatoes.',
                   'Airflow seems to matter more than how wet the sand is.'])[1 + g % 6],
          (power(random(), 6) * 400)::int,
          now() - (random() * interval '180 days')
   FROM generate_series(1, $2::int) g, people p, explanations e,
        LATERAL (SELECT (ARRAY['comment','comment','comment','comment','question','supports','supports','disputes','worked','didnt'])[1 + (g * 7) % 10] AS k) kinds`,
  [entryId, Number(count)],
);
await client.query(
  `INSERT INTO web.comments (id, entry_id, parent_id, owner, kind, body, created)
   SELECT gen_random_uuid(), c.entry_id, c.id, c.owner, 'comment', 'Load-test reply to a question.', c.created + interval '1 hour'
   FROM web.comments c WHERE c.entry_id = $1 AND c.kind = 'question' AND random() < 0.5`,
  [entryId],
);
await client.query("COMMIT");
await client.query("ANALYZE web.comments");
const { rows } = await client.query(
  "SELECT count(*)::int AS n FROM web.comments WHERE entry_id = $1",
  [entryId],
);
console.log(
  `Seeded ${rows[0].n} responses in ${((Date.now() - started) / 1000).toFixed(1)} s`,
);
await client.end();
