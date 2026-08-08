'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('notification_groups', 'notify_on_license_overage', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('notification_groups', 'notify_on_contract_renewal', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('notification_groups', 'notify_on_contract_renewal');
    await queryInterface.removeColumn('notification_groups', 'notify_on_license_overage');
  },
};
