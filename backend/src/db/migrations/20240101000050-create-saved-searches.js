'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('saved_searches', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING(150), allowNull: false },
      filters: { type: Sequelize.JSON, allowNull: false, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('saved_searches', ['user_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('saved_searches');
  },
};
