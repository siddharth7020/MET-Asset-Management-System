const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const QuickGRNItem = sequelize.define('quickGRNItem', {
    qGRNItemid: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    qGRNId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    storeCode: {
        type: DataTypes.STRING,
        allowNull: false
    },
    itemId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    unitId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 0 } // Ensure non-negative
    },
    rate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: { min: 0 }
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    discount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        validate: { min: 0 }
    },
    totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
}, {
    tableName: 'quick_grn_item',
    timestamps: true
});

module.exports = QuickGRNItem;