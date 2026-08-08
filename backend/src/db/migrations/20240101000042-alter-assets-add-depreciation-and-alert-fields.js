'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('assets', 'purchase_cost', { type: Sequelize.DECIMAL(12, 2), allowNull: true });
    await queryInterface.addColumn('assets', 'depreciation_method', {
      type: Sequelize.ENUM('none', 'straight_line'),
      allowNull: false,
      defaultValue: 'none',
    });
    await queryInterface.addColumn('assets', 'useful_life_months', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('assets', 'license_overage_alerted_at', { type: Sequelize.DATE, allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('assets', 'license_overage_alerted_at');
    await queryInterface.removeColumn('assets', 'useful_life_months');
    await queryInterface.removeColumn('assets', 'depreciation_method');
    await queryInterface.removeColumn('assets', 'purchase_cost');
  },
};
