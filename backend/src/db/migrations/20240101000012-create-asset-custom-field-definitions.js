'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('asset_custom_field_definitions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      key: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      label: { type: Sequelize.STRING(150), allowNull: false },
      field_type: { type: Sequelize.ENUM('text', 'number', 'date', 'boolean'), allowNull: false, defaultValue: 'text' },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('asset_custom_field_definitions');
  },
};
