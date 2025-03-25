const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

const FinancialYear = sequelize.define('financialYear', {
    financialYearId: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    year: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Year is required' },
            is: {
                args: /^\d{4}-\d{4}$/,  // Validates format like "2024-2025"
                msg: 'Year must be in YYYY-YYYY format'
            },
            isValidYear(value) {
                const [start, end] = value.split('-').map(Number);
                if (end !== start + 1) {
                    throw new Error('Year must be a valid financial year range (e.g., 2024-2025)');
                }
            }
        }
    },
    startDate: {
        type: Sequelize.DATE,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Start date is required' },
            isDate: { msg: 'Start date must be a valid date' }
        }
    },
    endDate: {
        type: Sequelize.DATE,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'End date is required' },
            isDate: { msg: 'End date must be a valid date' },
            isAfterStartDate(value) {
                if (this.startDate && new Date(value) <= new Date(this.startDate)) {
                    throw new Error('End date must be after start date');
                }
            }
        }
    }
});

module.exports = FinancialYear;
