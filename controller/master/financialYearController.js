const FinancialYear = require('../../model/master/financialYear');

exports.getFinancialYears = async (req, res, next) => {
    try {
        const financialYears = await FinancialYear.findAll();
        res.status(200).json({
            massage: 'Financial Years fetched successfully',
            data: financialYears
        })
    } catch (error) {
        console.log(error);
    }
}

// create financial year
exports.createFinancialYear = async (req, res, next) => {
    const { year, startDate, endDate } = req.body;

    // Validate year format (YYYY-YYYY)
    const yearPattern = /^\d{4}-\d{4}$/;
    if (!yearPattern.test(year)) {
        return res.status(400).json({ message: 'Year must be in YYYY-YYYY format (e.g., 2024-2025)' });
    }

    // Validate year range (e.g., 2024-2025 should have a difference of exactly 1 year)
    const [startYear, endYear] = year.split('-').map(Number);
    if (endYear !== startYear + 1) {
        return res.status(400).json({ message: 'Year must be a valid financial year range (e.g., 2024-2025)' });
    }

    // Validate date format
    if (!startDate || isNaN(Date.parse(startDate))) {
        return res.status(400).json({ message: 'Start date must be a valid date' });
    }
    if (!endDate || isNaN(Date.parse(endDate))) {
        return res.status(400).json({ message: 'End date must be a valid date' });
    }

    // Ensure endDate is after startDate
    if (new Date(startDate) >= new Date(endDate)) {
        return res.status(400).json({ message: 'End date must be after start date' });
    }

    try {
        const financialYear = await FinancialYear.create({ year, startDate, endDate });

        res.status(201).json({
            message: 'Financial Year created successfully',
            data: financialYear
        });
    } catch (error) {
        console.error(error);

        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                message: 'Validation Error',
                errors: error.errors.map(err => err.message)
            });
        }

        res.status(500).json({ message: 'Something went wrong', error: error.message });
    }
};

// update financial year by id
exports.updateFinancialYear = async (req, res, next) => {
    const { id } = req.params;
    const { year, startDate, endDate } = req.body;

    try {
        const financialYear = await FinancialYear.findByPk(id);
        if (!financialYear) {
            return res.status(404).json({ message: 'Financial Year not found' });
        }

        await financialYear.update({ year, startDate, endDate });
        res.status(200).json({ message: 'Financial Year updated successfully', data: financialYear });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Something went wrong', error: error.message });
    }
};

exports.deleteFinancialYear = async (req, res, next) => {
    const {id} = req.params;
    try{
        const financialYear = await FinancialYear.findByPk(id);
        if(!financialYear){
            return res.status(404).json({message: 'Financial Year not found'});
        }
        await financialYear.destroy();
        res.status(200).json({message: 'Financial Year deleted successfully'});
    }catch(error){
        console.error(error);
    }
};
