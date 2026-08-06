'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('alert_rules', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING(150), allowNull: false },
      source_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'log_sources', key: 'id' },
        onDelete: 'CASCADE',
      },
      pattern: { type: Sequelize.STRING(500), allowNull: false },
      severity_filter: {
        type: Sequelize.ENUM('emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug'),
        allowNull: true,
      },
      threshold_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      threshold_window_minutes: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 5 },
      notify_emails: { type: Sequelize.STRING(1000), allowNull: true },
      webhook_url: { type: Sequelize.STRING(1000), allowNull: true },
      create_ticket: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
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

    await queryInterface.createTable('alert_events', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      rule_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'alert_rules', key: 'id' },
        onDelete: 'CASCADE',
      },
      triggered_at: { type: Sequelize.DATE, allowNull: false },
      match_count: { type: Sequelize.INTEGER, allowNull: false },
      sample_message: { type: Sequelize.TEXT, allowNull: false },
      resolved_ticket_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'tickets', key: 'id' },
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('alert_events', ['rule_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('alert_events');
    await queryInterface.dropTable('alert_rules');
  },
};
