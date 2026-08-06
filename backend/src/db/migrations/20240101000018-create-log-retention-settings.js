'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('log_retention_settings', {
      id: { type: Sequelize.INTEGER, primaryKey: true },
      default_retention_days: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 30 },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.bulkInsert('log_retention_settings', [
      { id: 1, default_retention_days: 30, updated_at: new Date() },
    ]);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('log_retention_settings');
  },
};
