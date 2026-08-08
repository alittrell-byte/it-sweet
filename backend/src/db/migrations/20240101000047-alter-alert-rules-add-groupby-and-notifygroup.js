'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('alert_rules', 'group_by_metadata_field', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('alert_rules', 'notify_group_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'notification_groups', key: 'id' },
      onDelete: 'SET NULL',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('alert_rules', 'notify_group_id');
    await queryInterface.removeColumn('alert_rules', 'group_by_metadata_field');
  },
};
