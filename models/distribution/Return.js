const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Return = sequelize.define('Return', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    distributionId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    financialYearId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    instituteId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    employeeName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    location: {
        type: DataTypes.STRING,
        allowNull: false
    },
    documents: {
        type: DataTypes.STRING,
        allowNull: true
    },
    remark: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'return',
    timestamps: true
});

module.exports = Return;