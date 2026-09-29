INSERT INTO "games" ("id", "name", "slug", "genre", "platforms", "tags", "updatedAt")
VALUES (gen_random_uuid(), 'GTA V', 'gta-v', 'Mundo abierto', ARRAY['PC', 'PLAYSTATION', 'XBOX']::"Platform"[], ARRAY['rol', 'cooperativo'], NOW())
ON CONFLICT ("slug") DO NOTHING;
