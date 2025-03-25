const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const GRN = sequelize.define('GRN', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    poId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    grnNo: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    grnDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    challanNo: {
        type: DataTypes.STRING,
        allowNull: false
    },
    challanDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    document: {
        type: DataTypes.STRING, // Use JSON for multiple documents or ARRAY for PostgreSQL
        allowNull: true
    },
    remark: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'grn',
    timestamps: true
});

module.exports = GRN;