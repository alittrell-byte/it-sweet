'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tickets', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      subject: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: false },
      status: {
        type: Sequelize.ENUM('new', 'in_progress', 'waiting', 'resolved', 'closed'),
        allowNull: false,
        defaultValue: 'new',
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'medium',
      },
      category: { type: Sequelize.STRING(100), allowNull: true },
      requester_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      assignee_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      response_due_at: { type: Sequelize.DATE, allowNull: true },
      resolution_due_at: { type: Sequelize.DATE, allowNull: true },
      first_responded_at: { type: Sequelize.DATE, allowNull: true },
      resolved_at: { type: Sequelize.DATE, allowNull: true },
      closed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('tickets', ['status']);
    await queryInterface.addIndex('tickets', ['assignee_id']);
    await queryInterface.addIndex('tickets', ['requester_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('tickets');
  },
};
