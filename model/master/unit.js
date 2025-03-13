const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

const Unit = sequelize.define('unit', {
    unitId: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    uniteName: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Institute name is required' }
        }
    },
    uniteCode: {
        type: Sequelize.STRING,
        allowNull:false,
        validate: {
            notEmpty: { msg: 'Institute name is required' }
        }
    },
    remark: {
        type: Sequelize.STRING,
        allowNull: true
    }
});

module.exports = Unit;