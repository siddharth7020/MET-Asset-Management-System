const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

const Vendor = sequelize.define('vendor', {
    vendorId: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false,
       
    },
    companyName: {
        type: Sequelize.STRING,
        allowNull: false,
      
    },
    address: {
        type: Sequelize.STRING,
        allowNull: false,
     
    },
    email: {
        type: Sequelize.STRING,
        allowNull: false,
       
    },
    mobileNo: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    pancardNo: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    gstNo: {
        type: Sequelize.STRING,
        allowNull: false
    },
    bankName: {
        type: Sequelize.STRING,
        allowNull: false
    },
    accountNo: {
        type: Sequelize.STRING,
        allowNull: false
    },
    ifscCode: {
        type: Sequelize.STRING,
        allowNull: false
    },
    tanNo: {
        type: Sequelize.STRING,
        allowNull: false
    },
    website: {
        type: Sequelize.STRING,
        allowNull: true
    },
    remark: {
        type: Sequelize.STRING,
        allowNull: false
    }
});

module.exports = Vendor;
