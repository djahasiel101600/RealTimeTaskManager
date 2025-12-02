-- Initialize database with UTF8 encoding
SET client_encoding = 'UTF8';

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";