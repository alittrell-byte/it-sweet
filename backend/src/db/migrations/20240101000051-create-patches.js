'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('patches', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      platform: { type: Sequelize.ENUM('windows', 'linux', 'macos', 'other'), allowNull: false },
      external_id: { type: Sequelize.STRING(255), allowNull: false },
      title: { type: Sequelize.STRING(500), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      classification: {
        type: Sequelize.ENUM('security', 'critical', 'feature', 'other'),
        allowNull: false,
        defaultValue: 'other',
      },
      severity: {
        type: Sequelize.ENUM('critical', 'important', 'moderate', 'low'),
        allowNull: false,
        defaultValue: 'moderate',
      },
      cve_ids: { type: Sequelize.JSON, allowNull: true },
      release_date: { type: Sequelize.DATEONLY, allowNull: true },
      approval_status: {
        type: Sequelize.ENUM('pending', 'approved', 'declined'),
        allowNull: false,
        defaultValue: 'pending',
      },
      approved_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      approved_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('patches', ['platform', 'external_id'], { unique: true });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('patches');
  },
};
