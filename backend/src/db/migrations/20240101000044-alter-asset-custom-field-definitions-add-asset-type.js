'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('asset_custom_field_definitions', 'asset_type', {
      type: Sequelize.ENUM('hardware', 'software_license', 'peripheral'),
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('asset_custom_field_definitions', 'asset_type');
  },
};
