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
        validate: {
            notEmpty: { msg: 'Name is required' },
            len: { args: [3, 50], msg: 'Name must be between 3 to 50 characters' }
        }
    },
    companyName: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Company Name is required' }
        }
    },
    address: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Address is required' }
        }
    },
    email: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Email is required' },
            isEmail: { msg: 'Invalid email format' }
        }
    },
    mobileNo: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Mobile number is required' },
            isNumeric: { msg: 'Mobile number must contain only digits' },
            len: { args: [10, 10], msg: 'Mobile number must be 10 digits' }
        }
    },
    pancardNo: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'PAN Card number is required' },
            is: {
                args: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
                msg: 'Invalid PAN Card number format'
            }
        }
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
