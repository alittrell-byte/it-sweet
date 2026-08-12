'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('project_task_dependencies', {
      task_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'project_tasks', key: 'id' },
        onDelete: 'CASCADE',
      },
      depends_on_task_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'project_tasks', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('project_task_dependencies');
  },
};
