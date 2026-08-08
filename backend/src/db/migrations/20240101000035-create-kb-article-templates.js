'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('kb_article_templates', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING(150), allowNull: false },
      title_template: { type: Sequelize.STRING(255), allowNull: false },
      body_template: { type: Sequelize.TEXT, allowNull: false },
      suggested_space: { type: Sequelize.ENUM('internal', 'external'), allowNull: true },
      suggested_category_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'knowledge_base_categories', key: 'id' },
        onDelete: 'SET NULL',
      },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('kb_article_templates');
  },
};
