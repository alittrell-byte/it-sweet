'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('knowledge_base_articles', 'space', {
      type: Sequelize.ENUM('internal', 'external'),
      allowNull: false,
      defaultValue: 'internal',
    });
    await queryInterface.addColumn('knowledge_base_articles', 'category_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'knowledge_base_categories', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('knowledge_base_articles', 'updated_by_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('knowledge_base_articles', ['space']);
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('knowledge_base_articles', 'updated_by_id');
    await queryInterface.removeColumn('knowledge_base_articles', 'category_id');
    await queryInterface.removeColumn('knowledge_base_articles', 'space');
  },
};
