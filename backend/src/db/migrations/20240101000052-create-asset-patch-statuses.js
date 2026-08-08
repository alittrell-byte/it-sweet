'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('asset_patch_statuses', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      asset_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'assets', key: 'id' },
        onDelete: 'CASCADE',
      },
      patch_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'patches', key: 'id' },
        onDelete: 'CASCADE',
      },
      status: { type: Sequelize.ENUM('missing', 'installed', 'failed', 'pending_reboot'), allowNull: false },
      last_checked_at: { type: Sequelize.DATE, allowNull: false },
      installed_at: { type: Sequelize.DATE, allowNull: true },
      failure_reason: { type: Sequelize.TEXT, allowNull: true },
      missing_since_at: { type: Sequelize.DATE, allowNull: true },
      overdue_alerted_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('asset_patch_statuses', ['asset_id', 'patch_id'], { unique: true });
    await queryInterface.addIndex('asset_patch_statuses', ['status']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('asset_patch_statuses');
  },
};
