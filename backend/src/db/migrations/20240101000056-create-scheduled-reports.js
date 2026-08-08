'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('scheduled_reports', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING(150), allowNull: false },
      report_type: {
        type: Sequelize.ENUM(
          'ticket_dashboard',
          'license_compliance',
          'depreciation',
          'patch_compliance',
          'log_dashboard',
          'kb_feedback'
        ),
        allowNull: false,
      },
      cadence: { type: Sequelize.ENUM('daily', 'weekly', 'monthly'), allowNull: false, defaultValue: 'weekly' },
      notify_group_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'notification_groups', key: 'id' },
        onDelete: 'CASCADE',
      },
      last_sent_at: { type: Sequelize.DATE, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('scheduled_reports');
  },
};
