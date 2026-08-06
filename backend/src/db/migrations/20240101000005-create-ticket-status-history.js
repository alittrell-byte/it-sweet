'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ticket_status_history', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      ticket_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'tickets', key: 'id' },
        onDelete: 'CASCADE',
      },
      from_status: {
        type: Sequelize.ENUM('new', 'in_progress', 'waiting', 'resolved', 'closed'),
        allowNull: true,
      },
      to_status: {
        type: Sequelize.ENUM('new', 'in_progress', 'waiting', 'resolved', 'closed'),
        allowNull: false,
      },
      changed_by_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('ticket_status_history', ['ticket_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ticket_status_history');
  },
};
