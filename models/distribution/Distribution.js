const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Distribution = sequelize.define('Distribution', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    distributionDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    distributionNo: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
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
        type: DataTypes.STRING, // Store file path or URL
        allowNull: true
    },
    remark: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'distribution',
    timestamps: true
});

module.exports = Distribution;