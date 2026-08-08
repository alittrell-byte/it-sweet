'use strict';

// Data migration: `kb.manage` is replaced by four granular keys (kb.view_internal,
// kb.manage_internal, kb.manage_external, kb.manage_categories) so KB permissions can be
// split by space like every other module's checkbox-per-capability model. Anyone who held
// the old blanket key keeps equivalent capability under the new keys instead of silently
// losing access. Idempotent - safe to run more than once.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [holders] = await queryInterface.sequelize.query(
      "SELECT user_id FROM user_permissions WHERE permission_key = 'kb.manage'"
    );
    const now = new Date();

    for (const { user_id: userId } of holders) {
      for (const key of ['kb.manage_internal', 'kb.manage_external']) {
        const [existing] = await queryInterface.sequelize.query(
          'SELECT 1 FROM user_permissions WHERE user_id = :userId AND permission_key = :key',
          { replacements: { userId, key } }
        );
        if (existing.length === 0) {
          await queryInterface.bulkInsert('user_permissions', [{ user_id: userId, permission_key: key, created_at: now }]);
        }
      }
    }

    await queryInterface.bulkDelete('user_permissions', { permission_key: 'kb.manage' }, {});
  },
  async down() {
    // Not reversible in a meaningful way - the old blanket key is gone by design.
  },
};
