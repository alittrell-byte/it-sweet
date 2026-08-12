'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('project_tasks', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      project_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'projects', key: 'id' },
        onDelete: 'CASCADE',
      },
      title: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      assignee_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      status: {
        type: Sequelize.ENUM('todo', 'in_progress', 'done'),
        allowNull: false,
        defaultValue: 'todo',
      },
      due_date: { type: Sequelize.DATEONLY, allowNull: true },
      percent_complete: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ticket_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'tickets', key: 'id' },
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('project_tasks', ['project_id', 'status']);
    await queryInterface.addIndex('project_tasks', ['assignee_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('project_tasks');
  },
};
