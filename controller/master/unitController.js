const Unit = require('../../model/master/unit');

exports.getUnits = async (req, res, next) => {
    try {
        const units = await Unit.findAll();
        res.status(200).json({
            massage: 'Units fetched successfully',
            data: units
        })
    } catch (error) {
        console.log(error);
    }
};

// create unit by id
exports.createUnit = async (req, res, next) => {
    const { uniteName, uniteCode, remark } = req.body;
    try {
        // Create unit
        const unit = await Unit.create({
            uniteName, uniteCode, remark
        });

        res.status(201).json({
            message: 'Unit created successfully',
            data: unit
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Something went wrong', error: error.message });
    }
};

// update unit by id
exports.updateUnit = async (req, res, next) => {    
    const { id } = req.params;
    const { uniteName, uniteCode, remark } = req.body;
    try {
        const unit = await Unit.findByPk(id);
        if (!unit) {
            return res.status(404).json({ message: 'Unit not found' });
        }
        await unit.update({ uniteName, uniteCode, remark });
        res.status(200).json({ message: 'Unit updated successfully', data: unit });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Something went wrong', error: error.message });
    }
};  

// delete unit by id
exports.deleteUnit = async (req, res, next) => {
    const { id } = req.params;
    try {
        const unit = await Unit.findByPk(id);
        if (!unit) {
            return res.status(404).json({ message: 'Unit not found' });
        }
        await unit.destroy();
        res.status(200).json({ message: 'Unit deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Something went wrong', error: error.message });
    }
};