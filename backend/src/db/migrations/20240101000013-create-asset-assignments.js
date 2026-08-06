'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('asset_assignments', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      asset_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'assets', key: 'id' },
        onDelete: 'CASCADE',
      },
      assigned_to_type: { type: Sequelize.ENUM('user', 'location', 'department'), allowNull: false },
      assigned_to_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      assigned_to_label: { type: Sequelize.STRING(255), allowNull: true },
      assigned_at: { type: Sequelize.DATE, allowNull: false },
      unassigned_at: { type: Sequelize.DATE, allowNull: true },
      due_back_at: { type: Sequelize.DATE, allowNull: true },
      assigned_by_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('asset_assignments', ['asset_id']);
    await queryInterface.addIndex('asset_assignments', ['assigned_to_user_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('asset_assignments');
  },
};
