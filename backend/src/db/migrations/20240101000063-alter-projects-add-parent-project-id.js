'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('projects', 'parent_project_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'projects', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('projects', ['parent_project_id']);
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('projects', 'parent_project_id');
  },
};
