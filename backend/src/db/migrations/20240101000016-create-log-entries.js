'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('log_entries', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      source_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'log_sources', key: 'id' },
        onDelete: 'SET NULL',
      },
      host: { type: Sequelize.STRING(255), allowNull: true },
      severity: {
        type: Sequelize.ENUM('emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug'),
        allowNull: false,
        defaultValue: 'info',
      },
      message: { type: Sequelize.TEXT, allowNull: false },
      raw: { type: Sequelize.TEXT, allowNull: true },
      received_at: { type: Sequelize.DATE, allowNull: false },
      metadata: { type: Sequelize.JSON, allowNull: false, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('log_entries', ['source_id']);
    await queryInterface.addIndex('log_entries', ['severity']);
    await queryInterface.addIndex('log_entries', ['received_at']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('log_entries');
  },
};
