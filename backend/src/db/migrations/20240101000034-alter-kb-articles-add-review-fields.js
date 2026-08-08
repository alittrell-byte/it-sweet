'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('knowledge_base_articles', 'review_status', {
      type: Sequelize.ENUM('none', 'pending_review', 'approved', 'changes_requested'),
      allowNull: false,
      defaultValue: 'none',
    });
    await queryInterface.addColumn('knowledge_base_articles', 'submitted_for_review_by_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('knowledge_base_articles', 'submitted_for_review_at', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn('knowledge_base_articles', 'reviewed_by_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('knowledge_base_articles', 'reviewed_at', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn('knowledge_base_articles', 'review_note', { type: Sequelize.TEXT, allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('knowledge_base_articles', 'review_note');
    await queryInterface.removeColumn('knowledge_base_articles', 'reviewed_at');
    await queryInterface.removeColumn('knowledge_base_articles', 'reviewed_by_id');
    await queryInterface.removeColumn('knowledge_base_articles', 'submitted_for_review_at');
    await queryInterface.removeColumn('knowledge_base_articles', 'submitted_for_review_by_id');
    await queryInterface.removeColumn('knowledge_base_articles', 'review_status');
  },
};
