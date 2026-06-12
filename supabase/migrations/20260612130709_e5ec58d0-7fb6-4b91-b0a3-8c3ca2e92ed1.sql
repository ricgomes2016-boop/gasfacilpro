CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

UPDATE auth.users
SET encrypted_password = extensions.crypt('123456', extensions.gen_salt('bf')),
    updated_at = now()
WHERE email = 'admin@gasfacil.com';
