const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const QuickGRN = sequelize.define('quickGRN', {
    qGRNId: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    qGRNDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    qGRNNo: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    instituteId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    financialYearId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    vendorId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    document: {
        type: DataTypes.STRING, // Consider JSON if multiple documents are needed
        allowNull: true
    },
    challanNo: {
        type: DataTypes.STRING,
        allowNull: true
    },
    challanDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    requestedBy: {
        type: DataTypes.STRING,
        allowNull: false
    },
    remark: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'qGRNs',
    timestamps: true
});

module.exports = QuickGRN;