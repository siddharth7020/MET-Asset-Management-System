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
        type: DataTypes.INTEGER,
        allowNull: false
    },
    floor: {
        type: DataTypes.STRING,
        allowNull: false
    },
    rooms: {
        type: DataTypes.STRING,
        allowNull: false
    },
    document: {
        type: DataTypes.STRING(1000), // Stores JSON array of file paths
        allowNull: true,
        get() {
            const value = this.getDataValue('document');
            return value ? JSON.parse(value) : [];
        },
        set(value) {
            this.setDataValue('document', value ? JSON.stringify(value) : null);
        }
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