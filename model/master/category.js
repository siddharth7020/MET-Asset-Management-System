const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

const ItemCategory = sequelize.define('category', {
  categoryID: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    categoryName: {
        type: Sequelize.STRING,
        allowNull: false
    }
});

module.exports = ItemCategory;