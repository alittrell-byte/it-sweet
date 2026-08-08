'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('knowledge_base_article_revisions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      article_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'knowledge_base_articles', key: 'id' },
        onDelete: 'CASCADE',
      },
      title: { type: Sequelize.STRING(255), allowNull: false },
      body: { type: Sequelize.TEXT, allowNull: false },
      space: { type: Sequelize.ENUM('internal', 'external'), allowNull: false },
      category_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'knowledge_base_categories', key: 'id' },
        onDelete: 'SET NULL',
      },
      edited_by_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('knowledge_base_article_revisions', ['article_id']);

    await queryInterface.createTable('knowledge_base_article_attachments', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      article_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'knowledge_base_articles', key: 'id' },
        onDelete: 'CASCADE',
      },
      uploaded_by_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      file_name: { type: Sequelize.STRING(255), allowNull: false },
      mime_type: { type: Sequelize.STRING(150), allowNull: false },
      size_bytes: { type: Sequelize.INTEGER, allowNull: false },
      storage_key: { type: Sequelize.STRING(512), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('knowledge_base_article_attachments', ['article_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('knowledge_base_article_attachments');
    await queryInterface.dropTable('knowledge_base_article_revisions');
  },
};
