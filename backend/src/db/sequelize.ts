import { Sequelize } from 'sequelize';
import { env } from '../config/env';

// DB_DIALECT is the single switch between Postgres and MySQL. Model definitions
// throughout the app stick to portable Sequelize DataTypes so no code branches
// on dialect - only this connection setup does.
export const sequelize = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: env.DB_DIALECT,
  logging: env.DB_LOGGING ? console.log : false,
  define: {
    underscored: true,
  },
});

export async function connectDatabase(): Promise<void> {
  await sequelize.authenticate();
}
