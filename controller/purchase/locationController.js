const Location = require('../../models/master/location');

// Create
exports.createLocation = async (req, res) => {
    try {
        const { floor, room } = req.body;
        const location = await Location.create({ floor, room });
        res.status(201).json(location);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Read All
exports.getAllLocations = async (req, res) => {
    try {
        const locations = await Location.findAll();
        res.status(200).json(locations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Read One
exports.getLocationById = async (req, res) => {
    try {
        const { id } = req.params;
        const location = await Location.findByPk(id);
        if (!location) return res.status(404).json({ error: 'Location not found' });
        res.status(200).json(location);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update
exports.updateLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const { floor, room } = req.body;
        const location = await Location.findByPk(id);
        if (!location) return res.status(404).json({ error: 'Location not found' });

        location.floor = floor;
        location.room = room;
        await location.save();

        res.status(200).json(location);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete
exports.deleteLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const location = await Location.findByPk(id);
        if (!location) return res.status(404).json({ error: 'Location not found' });

        await location.destroy();
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};