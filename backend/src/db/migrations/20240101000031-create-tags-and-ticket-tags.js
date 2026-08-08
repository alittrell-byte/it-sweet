'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tags', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('ticket_tags', {
      ticket_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: 'tickets', key: 'id' },
        onDelete: 'CASCADE',
      },
      tag_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'tags', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('ticket_tags', ['tag_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ticket_tags');
    await queryInterface.dropTable('tags');
  },
};
