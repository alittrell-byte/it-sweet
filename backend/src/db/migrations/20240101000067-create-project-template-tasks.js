'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('project_template_tasks', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      template_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'project_templates', key: 'id' },
        onDelete: 'CASCADE',
      },
      title: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      // "Due N days after the new project's start date" - templates have no absolute dates.
      relative_due_days: { type: Sequelize.INTEGER, allowNull: true },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('project_template_tasks', ['template_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('project_template_tasks');
  },
};
