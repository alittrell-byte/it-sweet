require('dotenv/config');

// Plain JS config consumed by sequelize-cli (migrations/seeders run outside ts-node).
// Mirrors the validated env in src/config/env.ts, kept dialect-agnostic so the same
// migrations run against Postgres or MySQL depending on DB_DIALECT.
function build() {
  return {
    dialect: process.env.DB_DIALECT || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || (process.env.DB_DIALECT === 'mysql' ? 3306 : 5432),
    database: process.env.DB_NAME || 'helpdesk',
    username: process.env.DB_USER || 'helpdesk',
    password: process.env.DB_PASSWORD || 'helpdesk',
    logging: false,
  };
}

module.exports = {
  development: build(),
  test: { ...build(), database: `${process.env.DB_NAME || 'helpdesk'}_test` },
  production: build(),
};
