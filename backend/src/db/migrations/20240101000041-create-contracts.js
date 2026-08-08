'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('contracts', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      // No onDelete cascade on purpose - deleting a vendor should not silently wipe out its
      // contract history. vendorService.deleteVendor checks for and blocks this with a clear
      // error before it would ever hit this constraint (same delete-safety approach used for
      // KB categories).
      vendor_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'vendors', key: 'id' },
      },
      asset_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'assets', key: 'id' },
        onDelete: 'SET NULL',
      },
      type: {
        type: Sequelize.ENUM('support', 'maintenance', 'license', 'other'),
        allowNull: false,
        defaultValue: 'other',
      },
      start_date: { type: Sequelize.DATEONLY, allowNull: true },
      end_date: { type: Sequelize.DATEONLY, allowNull: true },
      cost: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      auto_renew: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      notes: { type: Sequelize.TEXT, allowNull: true },
      renewal_alerted_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('contracts', ['vendor_id']);
    await queryInterface.addIndex('contracts', ['asset_id']);
    await queryInterface.addIndex('contracts', ['end_date']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('contracts');
  },
};
