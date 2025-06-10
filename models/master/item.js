const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

const Item = sequelize.define('item', {
    itemId: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    itemName: {
        type: Sequelize.STRING,
        allowNull: false
    },
    itemCategory: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: 'category', // Use table name as string
            key: 'categoryID'
        }
    },
    remark: {
        type: Sequelize.STRING,
        allowNull: true
    }
}, {
    tableName: 'item' // Explicitly set to match model name
});

// Associations will be defined in models/index.js
Item.associate = function (models) {
    Item.belongsTo(models.ItemCategory, { foreignKey: 'itemCategory' });
};

module.exports = Item;