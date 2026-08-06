'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('log_sources', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING(150), allowNull: false, unique: true },
      type: { type: Sequelize.ENUM('syslog', 'http', 'internal'), allowNull: false, defaultValue: 'http' },
      api_key: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      retention_days: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('log_sources');
  },
};
