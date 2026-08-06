'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      email: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      display_name: { type: Sequelize.STRING(255), allowNull: false },
      role: { type: Sequelize.ENUM('admin', 'technician', 'customer'), allowNull: false, defaultValue: 'customer' },
      password_hash: { type: Sequelize.STRING(255), allowNull: true },
      auth_source: { type: Sequelize.ENUM('local', 'ldap'), allowNull: false, defaultValue: 'local' },
      external_id: { type: Sequelize.STRING(255), allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
