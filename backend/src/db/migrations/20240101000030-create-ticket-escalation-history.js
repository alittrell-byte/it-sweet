'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ticket_escalation_history', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      ticket_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'tickets', key: 'id' },
        onDelete: 'CASCADE',
      },
      from_team_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'teams', key: 'id' },
        onDelete: 'SET NULL',
      },
      to_team_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'teams', key: 'id' },
        onDelete: 'CASCADE',
      },
      escalated_by_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      reason: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('ticket_escalation_history', ['ticket_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ticket_escalation_history');
  },
};
