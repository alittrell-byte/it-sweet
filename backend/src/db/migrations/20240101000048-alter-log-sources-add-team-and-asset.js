'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('log_sources', 'restricted_to_team_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'teams', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('log_sources', 'asset_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'assets', key: 'id' },
      onDelete: 'SET NULL',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('log_sources', 'asset_id');
    await queryInterface.removeColumn('log_sources', 'restricted_to_team_id');
  },
};
