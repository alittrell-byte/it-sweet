'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('projects', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      owner_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      status: {
        type: Sequelize.ENUM('planning', 'active', 'on_hold', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'planning',
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'medium',
      },
      start_date: { type: Sequelize.DATEONLY, allowNull: true },
      target_end_date: { type: Sequelize.DATEONLY, allowNull: true },
      actual_end_date: { type: Sequelize.DATEONLY, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('projects', ['status']);
    await queryInterface.addIndex('projects', ['owner_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('projects');
  },
};
