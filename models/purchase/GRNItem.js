const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const GRNItem = sequelize.define('GRNItem', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    grnId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    orderItemId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    itemId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    receivedQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 0 }
    },
    rejectedQuantity: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: { min: 0 }
    }
}, {
    tableName: 'grn_item',
    timestamps: true
});

module.exports = GRNItem;