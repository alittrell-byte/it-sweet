'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('patch_agent_keys', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      asset_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'assets', key: 'id' },
        onDelete: 'CASCADE',
      },
      api_key: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('patch_agent_keys');
  },
};
