const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

const grn = sequelize.define('grn', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    poNo: {
        type: Sequelize.STRING,
        allowNull: true
    },
    grnNO: {
        type: Sequelize.STRING,
        allowNull: false
    },
    grnDate: {
        type: Sequelize.DATE,
        allowNull: false
    },
    instituteName: {
        type: Sequelize.STRING,
        allowNull: false
    },
    financialYear: {
        type: Sequelize.STRING,
        allowNull: false
    },
    vendorName: {
        type: Sequelize.STRING,
        allowNull: false
    },
    challanNo: {
        type: Sequelize.STRING,
        allowNull: false
    },
    challanDate: {
        type: Sequelize.DATE,
        allowNull: false
    },
    document: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true
    },
    requestedBy: {
        type: Sequelize.STRING,
        allowNull: false
    },
    remark: {
        type: Sequelize.STRING,
        allowNull: false
    },
    assetQuantity: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    assetData: {
        type: Sequelize.JSONB,
        allowNull: true
    }
})

module.exports = grn;