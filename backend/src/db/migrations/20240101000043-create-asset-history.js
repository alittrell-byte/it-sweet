'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('asset_history', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      // No FK constraint (see assetHistory.model.ts) - the audit trail must survive deletion
      // of the asset it describes.
      asset_id: { type: Sequelize.UUID, allowNull: false },
      changed_by_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      action: { type: Sequelize.ENUM('created', 'updated', 'deleted', 'received'), allowNull: false },
      changes: { type: Sequelize.JSON, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('asset_history', ['asset_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('asset_history');
  },
};
