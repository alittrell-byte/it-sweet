'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('assets', 'vendor');
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('assets', 'vendor', { type: Sequelize.STRING(255), allowNull: true });
    // Data is not restored - see 20240101000039's down() note. This only restores the column shape.
  },
};
