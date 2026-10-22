'use strict';

const { createHash } = require('crypto');

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

// Replaces the plaintext api_key column on log_sources and patch_agent_keys with
// api_key_hash (SHA-256 of the key). Existing keys keep working - agents still send the
// plaintext, the app hashes it on the way in - but the key itself can no longer be read
// back out of the database or the UI. Mirrors backend/src/common/apiKeys.ts.
const TABLES = ['log_sources', 'patch_agent_keys'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const table of TABLES) {
      await queryInterface.addColumn(table, 'api_key_hash', { type: Sequelize.STRING(64), allowNull: true });

      const [rows] = await queryInterface.sequelize.query(`SELECT id, api_key FROM ${table}`);
      for (const row of rows) {
        await queryInterface.sequelize.query(`UPDATE ${table} SET api_key_hash = :hash WHERE id = :id`, {
          replacements: { hash: sha256(row.api_key), id: row.id },
        });
      }

      await queryInterface.changeColumn(table, 'api_key_hash', { type: Sequelize.STRING(64), allowNull: false });
      await queryInterface.addIndex(table, ['api_key_hash'], { unique: true, name: `${table}_api_key_hash_unique` });
      await queryInterface.removeColumn(table, 'api_key');
    }
  },

  async down(queryInterface, Sequelize) {
    // The plaintext is gone for good, so rolling back issues fresh random keys: every agent
    // has to be re-pointed at its new key afterwards.
    const { randomBytes } = require('crypto');
    for (const table of TABLES) {
      await queryInterface.addColumn(table, 'api_key', { type: Sequelize.STRING(64), allowNull: true });
      const [rows] = await queryInterface.sequelize.query(`SELECT id FROM ${table}`);
      for (const row of rows) {
        await queryInterface.sequelize.query(`UPDATE ${table} SET api_key = :key WHERE id = :id`, {
          replacements: { key: randomBytes(24).toString('hex'), id: row.id },
        });
      }
      await queryInterface.changeColumn(table, 'api_key', { type: Sequelize.STRING(64), allowNull: false });
      await queryInterface.addIndex(table, ['api_key'], { unique: true, name: `${table}_api_key_unique` });
      await queryInterface.removeIndex(table, `${table}_api_key_hash_unique`);
      await queryInterface.removeColumn(table, 'api_key_hash');
    }
  },
};
