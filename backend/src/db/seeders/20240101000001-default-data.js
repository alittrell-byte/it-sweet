'use strict';

const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
const GROUP_NAME = 'Help Desk Team';
const MONITORING_SYSTEM_EMAIL = 'monitoring-system@internal.local';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Idempotent on purpose: containers can restart and re-run seeders (e.g. after a
  // transient crash before migrations finished), so this must be safe to run twice.
  async up(queryInterface) {
    const now = new Date();

    const [existingUsers] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE email = :email',
      { replacements: { email: ADMIN_EMAIL } }
    );
    let adminId = existingUsers[0]?.id;

    if (!adminId) {
      adminId = randomUUID();
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await queryInterface.bulkInsert('users', [
        {
          id: adminId,
          email: ADMIN_EMAIL,
          display_name: 'Administrator',
          role: 'admin',
          password_hash: passwordHash,
          auth_source: 'local',
          is_active: true,
          rank: 1000,
          is_super_admin: true,
          created_at: now,
          updated_at: now,
        },
      ]);
    } else {
      // Safety net for deployments where this seeder already ran before the
      // rank/is_super_admin columns existed: make sure the seeded admin is always
      // the one true super admin so there's never a deployment with nobody able
      // to manage user permissions.
      await queryInterface.sequelize.query(
        'UPDATE users SET is_super_admin = true, rank = 1000 WHERE id = :id',
        { replacements: { id: adminId } }
      );
    }

    // No password hash - this account is never logged into interactively. It exists so
    // alert-triggered tickets (backend/src/modules/logs/alertService.ts) have a clear,
    // non-human requester in the audit trail instead of being attributed to whichever
    // admin happens to be logged in when the evaluator runs.
    const [existingMonitoringUsers] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE email = :email',
      { replacements: { email: MONITORING_SYSTEM_EMAIL } }
    );
    if (existingMonitoringUsers.length === 0) {
      await queryInterface.bulkInsert('users', [
        {
          id: randomUUID(),
          email: MONITORING_SYSTEM_EMAIL,
          display_name: 'Monitoring System',
          role: 'technician',
          password_hash: null,
          auth_source: 'local',
          is_active: true,
          rank: 0,
          is_super_admin: false,
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    const [existingGroups] = await queryInterface.sequelize.query(
      'SELECT id FROM notification_groups WHERE name = :name',
      { replacements: { name: GROUP_NAME } }
    );
    let groupId = existingGroups[0]?.id;

    if (!groupId) {
      groupId = randomUUID();
      await queryInterface.bulkInsert('notification_groups', [
        {
          id: groupId,
          name: GROUP_NAME,
          notify_on_new_ticket: true,
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    const [existingMembership] = await queryInterface.sequelize.query(
      'SELECT 1 FROM notification_group_members WHERE group_id = :groupId AND user_id = :userId',
      { replacements: { groupId, userId: adminId } }
    );
    if (existingMembership.length === 0) {
      await queryInterface.bulkInsert('notification_group_members', [
        { group_id: groupId, user_id: adminId, created_at: now },
      ]);
    }
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('notification_group_members', null, {});
    await queryInterface.bulkDelete('notification_groups', { name: GROUP_NAME }, {});
    await queryInterface.bulkDelete('users', { email: ADMIN_EMAIL }, {});
    await queryInterface.bulkDelete('users', { email: MONITORING_SYSTEM_EMAIL }, {});
  },
};
