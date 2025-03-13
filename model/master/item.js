const Sequelize = require('sequelize');
const sequelize = require('../../config/database');
const ItemCategory = require('./category');
const Unit = require('./unit');

const Item = sequelize.define('item', {
    id: {
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
            model: 'category',
            key: 'categoryID'
        }
    },
    unit: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: 'unit',
            key: 'unitId'
        }
    },
    remark: {
        type: Sequelize.STRING,
        allowNull: true
    }
});

Item.associate = function () {
    Item.belongsTo(ItemCategory, { foreignKey: 'itemCategory' });
    Item.belongsTo(Unit, { foreignKey: 'unit' });
};

module.exports = Item;