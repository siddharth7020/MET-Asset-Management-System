const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const DistributionReturn = sequelize.define('DistributionReturn', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    distributionId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    distributionItemId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    itemId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    returnQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1 }
    },
    reason: {
        type: DataTypes.STRING,
        allowNull: false // e.g., "defective", "wrong item", "default"
    },
    returnDate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    poId: {
        type: DataTypes.INTEGER,
        allowNull: false // To link back to the original StockStorage entry
    },
    grnId: {
        type: DataTypes.INTEGER,
        allowNull: false // To link back to the original StockStorage entry
    }
}, {
    tableName: 'distribution_return',
    timestamps: true
});

module.exports = DistributionReturn;