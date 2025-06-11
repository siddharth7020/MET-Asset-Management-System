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
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'grn',
    timestamps: true
});

module.exports = GRN;