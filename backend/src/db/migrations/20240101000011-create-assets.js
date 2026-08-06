'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('assets', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      type: { type: Sequelize.ENUM('hardware', 'software_license', 'peripheral'), allowNull: false },
      status: {
        type: Sequelize.ENUM('available', 'in_use', 'retired', 'lost', 'under_repair'),
        allowNull: false,
        defaultValue: 'available',
      },
      serial_number: { type: Sequelize.STRING(255), allowNull: true },
      vendor: { type: Sequelize.STRING(255), allowNull: true },
      purchase_date: { type: Sequelize.DATEONLY, allowNull: true },
      warranty_expiry: { type: Sequelize.DATEONLY, allowNull: true },
      license_seats_purchased: { type: Sequelize.INTEGER, allowNull: true },
      custom_fields: { type: Sequelize.JSON, allowNull: false, defaultValue: {} },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('assets', ['type']);
    await queryInterface.addIndex('assets', ['status']);
    await queryInterface.addIndex('assets', ['serial_number']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('assets');
  },
};
