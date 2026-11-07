-- Standard context keys (F-03). Labels are interface strings, not translations of values.
INSERT INTO context_keys (key, labels, value_type, allowed, templates) VALUES
  ('country', '{"en":"Country"}', 'country', NULL, '{}'),
  ('region', '{"en":"Region"}', 'text', NULL, '{}'),
  ('climate_zone', '{"en":"Climate zone"}', 'enum', '["A","B","C","D","E"]', '{}'),
  ('season', '{"en":"Season"}', 'enum', '["dry","wet","spring","summer","autumn","winter"]', '{}'),
  ('setting', '{"en":"Setting"}', 'enum', '["urban","rural"]', '{}'),
  ('budget_band', '{"en":"Budget"}', 'enum', '["under_5_usd","under_20_usd","under_100_usd","under_1000_usd","more"]', '{}'),
  ('tools_level', '{"en":"Tools"}', 'enum', '["hand","power","industrial"]', '{}'),
  ('skill_level', '{"en":"Skill"}', 'enum', '["new","practiced","professional"]', '{}'),
  ('os', '{"en":"Operating system"}', 'text', NULL, '{software}'),
  ('framework_version', '{"en":"Framework version"}', 'version', NULL, '{software}'),
  ('soil_type', '{"en":"Soil"}', 'text', NULL, '{farming_food}')
ON CONFLICT (key) DO NOTHING;
