'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('project_members', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      project_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'projects', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      role: {
        type: Sequelize.ENUM('lead', 'contributor', 'reviewer'),
        allowNull: false,
        defaultValue: 'contributor',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('project_members', ['project_id', 'user_id'], { unique: true });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('project_members');
  },
};
