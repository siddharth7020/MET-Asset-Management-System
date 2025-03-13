const Institute = require('../../model/master/institute');

exports.getInstitutes = async (req, res, next) => {
    try {
        const institutes = await Institute.findAll();
        res.status(200).json({
            massage: 'Institutes fetched successfully',
            data: institutes
        })
    } catch (error) {
        console.log(error);
    }
};

// create institute
exports.createInstitute = async (req, res, next) => {
    const { instituteName, intituteCode } = req.body;
    try {
        // Create institute
        const institute = await Institute.create({
            instituteName, intituteCode
        });

        res.status(201).json({
            message: 'Institute created successfully',
            data: institute
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Something went wrong', error: error.message });
    }
};

// update institute by id
exports.updateInstitute = async (req, res, next) => {
    const { id } = req.params;
    const { instituteName, intituteCode } = req.body;
    try {
        const institute = await Institute.findByPk(id);
        if (!institute) {
            return res.status(404).json({ message: 'Institute not found' });
        }
        await institute.update({ instituteName, intituteCode });
        res.status(200).json({ message: 'Institute updated successfully', data: institute });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Something went wrong', error: error.message });
    }
};

// delete institute by id
exports.deleteInstitute = async (req, res, next) => {
    const { id } = req.params;
    try {
        const institute = await Institute.findByPk(id);
        if (!institute) {
            return res.status(404).json({ message: 'Institute not found' });
        }
        await institute.destroy();
        res.status(200).json({ message: 'Institute deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Something went wrong', error: error.message });
    }
};