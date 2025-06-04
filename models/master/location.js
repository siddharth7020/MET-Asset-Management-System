const Sequelize = require('sequelize');
const sequelize = require('../../config/database'); 

const Location = sequelize.define('location', {
    locationID: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    floor: {
        type: Sequelize.STRING,
        allowNull: false
    },
    room: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false
    }
});

module.exports = Location;
