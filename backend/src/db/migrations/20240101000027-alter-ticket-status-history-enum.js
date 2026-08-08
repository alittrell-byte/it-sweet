'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // See 20240101000026 for why this can't be a plain changeColumn on Postgres.
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query(
        "ALTER TYPE \"enum_ticket_status_history_from_status\" ADD VALUE IF NOT EXISTS 'pending_approval'"
      );
      await queryInterface.sequelize.query(
        "ALTER TYPE \"enum_ticket_status_history_to_status\" ADD VALUE IF NOT EXISTS 'pending_approval'"
      );
    } else {
      await queryInterface.changeColumn('ticket_status_history', 'from_status', {
        type: Sequelize.ENUM('new', 'in_progress', 'waiting', 'pending_approval', 'resolved', 'closed'),
        allowNull: true,
      });
      await queryInterface.changeColumn('ticket_status_history', 'to_status', {
        type: Sequelize.ENUM('new', 'in_progress', 'waiting', 'pending_approval', 'resolved', 'closed'),
        allowNull: false,
      });
    }
  },
  async down(queryInterface, Sequelize) {
    // No supported down-path on Postgres (see 20240101000026); MySQL can shrink safely.
    if (queryInterface.sequelize.getDialect() !== 'postgres') {
      await queryInterface.changeColumn('ticket_status_history', 'to_status', {
        type: Sequelize.ENUM('new', 'in_progress', 'waiting', 'resolved', 'closed'),
        allowNull: false,
      });
      await queryInterface.changeColumn('ticket_status_history', 'from_status', {
        type: Sequelize.ENUM('new', 'in_progress', 'waiting', 'resolved', 'closed'),
        allowNull: true,
      });
    }
  },
};
