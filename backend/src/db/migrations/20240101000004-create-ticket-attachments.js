'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ticket_attachments', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      ticket_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'tickets', key: 'id' },
        onDelete: 'CASCADE',
      },
      comment_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'ticket_comments', key: 'id' },
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
    await queryInterface.addIndex('ticket_attachments', ['ticket_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ticket_attachments');
  },
};
