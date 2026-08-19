-- Huddly PostgreSQL Initialization Script
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant all privileges to postgres user on public schema
GRANT ALL ON SCHEMA public TO postgres;
