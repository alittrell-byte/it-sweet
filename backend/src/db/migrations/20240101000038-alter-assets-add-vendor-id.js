'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('assets', 'vendor_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'vendors', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('assets', ['vendor_id']);
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('assets', ['vendor_id']);
    await queryInterface.removeColumn('assets', 'vendor_id');
  },
};
