const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

const Intitute = sequelize.define('institute', {
    instituteId: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    instituteName: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Institute name is required' }
        }
    },
    intituteCode: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Institute code is required' },
            len: { args: [3, 50], msg: 'Institute code must be between 3 to 50 characters' }
        }
    }
});

module.exports = Intitute;