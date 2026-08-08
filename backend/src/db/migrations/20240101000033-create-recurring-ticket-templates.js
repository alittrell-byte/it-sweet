'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('recurring_ticket_templates', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING(150), allowNull: false },
      subject_template: { type: Sequelize.STRING(255), allowNull: false },
      description_template: { type: Sequelize.TEXT, allowNull: false },
      category: { type: Sequelize.STRING(100), allowNull: true },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'medium',
      },
      assignee_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      recurrence_rule: { type: Sequelize.JSON, allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      next_run_at: { type: Sequelize.DATE, allowNull: false },
      last_run_at: { type: Sequelize.DATE, allowNull: true },
      created_by_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('recurring_ticket_templates', ['next_run_at']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('recurring_ticket_templates');
  },
};
