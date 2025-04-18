const { default: mongoose } = require('mongoose');
const InputNode = require('../models/inputNode');

// Helper: Converts a string to Title Case
function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(/[\s_-]+/)
    .map((word) => { return word.charAt(0).toUpperCase() + word.slice(1); })
    .join(' ');
}

// Returns all input nodes, sorted by 'order'
exports.getAllInputs = async (req, res) => {
  try {
    const inputs = await InputNode.find().sort({ order: 1 });
    res.status(200).json(inputs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Returns therapist-specific input nodes from all collections (excluding internal/system collections)
exports.getTherapistInputs = async (req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const filtered = collections.filter((c) => {
      return (
        !c.name.startsWith('system.')
      && !c.name.startsWith('relationships')
      && !c.name.startsWith('inputnodes')
      && !c.name.startsWith('extratherapeutic')
      );
    });

    const relationships = await mongoose.connection.db.collection('relationships').find().toArray();

    // Build a dependency map using 'DependsOn'
    const relationshipMap = relationships.reduce((map, relationship) => {
      map[relationship.Name] = relationship.DependsOn
        ? relationship.DependsOn.split(',').map((dep) => { return dep.trim(); })
        : [];
      return map;
    }, {});

    // Fetch documents from each collection and build node data
    const inputs = await Promise.all(
      filtered.map(async ({ name }) => {
        const model = mongoose.models[name]
          || mongoose.model(name, new mongoose.Schema({}, { strict: false }), name);

        const docs = await model.find({}, { Factor: 1, PointsTo: 1, _id: 0 }).lean();
        const factors = docs.map((doc) => { return doc.Factor; }).filter(Boolean);
        const dependsOn = relationshipMap[name] || [];

        return {
          name,
          label: name.charAt(0).toUpperCase() + name.slice(1),
          factors,
          dependsOn: dependsOn.length ? dependsOn : null,
        };
      }),
    );

    res.status(200).json(inputs);
  } catch (err) {
    console.error('Error loading therapist inputs:', err);
    res.status(500).json({ error: err.message });
  }
};

// Returns a subset of input nodes for client users, based on allowed collections
exports.getClientInputs = async (req, res) => {
  try {
    const allowedCollections = [
      'treatment',
      'mediators',
      'extratheraputic factors',
      'clinical outcome in patient',
    ];

    const relationships = await mongoose.connection.db.collection('relationships').find().toArray();

    // Create dependency map for allowed collections
    const relationshipMap = relationships.reduce((map, relationship) => {
      map[relationship.Name] = relationship.DependsOn
        ? relationship.DependsOn.split(',').map((dep) => { return dep.trim(); })
        : [];
      return map;
    }, {});

    const inputs = await Promise.all(
      allowedCollections.map(async (name) => {
        const model = mongoose.models[name]
          || mongoose.model(name, new mongoose.Schema({}, { strict: false }), name);

        const docs = await model.find({}, { Factor: 1, PointsTo: 1, _id: 0 }).lean();
        const factors = docs.map((doc) => { return doc.Factor; }).filter(Boolean);
        const dependsOn = relationshipMap[name] || [];

        return {
          name,
          label: toTitleCase(name),
          factors: factors.map(toTitleCase),
          dependsOn: dependsOn.length ? dependsOn : null,
        };
      }),
    );

    res.status(200).json(inputs);
  } catch (err) {
    console.error('Error loading client inputs:', err);
    res.status(500).json({ error: err.message });
  }
};

// Processes submitted inputs and returns a dummy result for now
exports.processInputs = async (req, res) => {
  try {
    const selected = req.body;
    // kiwi: replace with actual logic
    const result = `Selected Treatment: ${selected.treatment}, Label: ${selected.mediators}`;
    res.status(200).json({ result });
  } catch (err) {
    console.error('Processing error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
