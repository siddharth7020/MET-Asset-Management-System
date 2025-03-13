// set the controller 
const Vendor = require('../../model/master/vendor');

exports.getVendors = async (req, res, next) => {
    try {
        const vendors = await Vendor.findAll();
        res.status(200).json({
            massage: 'Vendors fetched successfully',
            data: vendors
        })
    } catch (error) {
        console.log(error);
    }
};

// create vendor
exports.createVendor = async (req, res, next) => {
    const { name, companyName, address, email, mobileNo, pancardNo, gstNo, bankName, accountNo, ifscCode, tanNo, wesite, remark } = req.body;
    
    try {
        // Create vendor
        const vendor = await Vendor.create({
            name, companyName, address, email, mobileNo, pancardNo, gstNo, bankName, accountNo, ifscCode, tanNo, wesite, remark
        });

        res.status(201).json({
            message: 'Vendor created successfully',
            data: vendor
        });
    } catch (error) {
        console.error(error);

        // Handling Sequelize validation errors
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                message: 'Validation Error',
                errors: error.errors.map(err => err.message)
            });
        }

        res.status(500).json({ message: 'Something went wrong', error: error.message });
    }
};

// update vendor with id
exports.updateVendor = async (req, res, next) => {
    const { id } = req.params;
    const { name, companyName, address, email, mobileNo, pancardNo, gstNo, bankName, accountNo, ifscCode, tanNo, wesite, remark } = req.body;
    try {
        const vendor = await Vendor.findByPk(id);
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }
        await vendor.update({ name, companyName, address, email, mobileNo, pancardNo, gstNo, bankName, accountNo, ifscCode, tanNo, wesite, remark });
        res.status(200).json({ message: 'Vendor updated successfully', data: vendor });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Something went wrong', error: error.message });
    }
};

// delete vendor with id
exports.deleteVendor = async (req, res, next) => {
    const { id } = req.params;
    try {
        const vendor = await Vendor.findByPk(id);
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }
        await vendor.destroy();
        res.status(200).json({ message: 'Vendor deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Something went wrong', error: error.message });
    }
};


