const Sequelize = require('sequelize');

const sequelize = new Sequelize('ams', 'postgres', 'root', { // usersdb: database name, postgres: user name, root: password
    dialect: 'postgres', // database name
    host: 'localhost', // hosting database on server
    define: {
        timestamps: true, // createdAt, updatedAt
        freezeTableName: true // posts -> post, omitting extra 's'
    }
});

module.exports = sequelize;