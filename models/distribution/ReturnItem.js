const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const ReturnItem = sequelize.define('ReturnItem', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    returnId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    itemId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    returnQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    tableName: 'return_item',
    timestamps: true
});

module.exports = ReturnItem;