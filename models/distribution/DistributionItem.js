const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const DistributionItem = sequelize.define('DistributionItem', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    distributionId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    itemId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    unitId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    issueQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 0 }
    }
}, {
    tableName: 'distribution_item',
    timestamps: true
});

module.exports = DistributionItem;