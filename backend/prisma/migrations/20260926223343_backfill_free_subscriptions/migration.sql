-- Todo usuario tiene una fila de suscripción (plan FREE por defecto).
-- Así ordenar por plan pone a los Premium primero sin nulos de por medio.
INSERT INTO "subscriptions" ("id", "userId", "plan", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", 'FREE', 'ACTIVE', NOW(), NOW()
FROM "users" u
WHERE NOT EXISTS (SELECT 1 FROM "subscriptions" s WHERE s."userId" = u."id");
