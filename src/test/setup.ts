process.env.NODE_ENV ||= "test";
process.env.DATABASE_URL ||= "postgresql://postgres:postgres@localhost:5432/automedia_test?schema=public";
process.env.JWT_SECRET ||= "test-jwt-secret-with-enough-length";
process.env.WEBHOOK_SECRET ||= "test-webhook-secret";
