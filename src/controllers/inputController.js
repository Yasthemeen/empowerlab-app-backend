/* eslint-disable consistent-return */
// kiwi: uncomment for mongo code
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
      && !c.name.startsWith('therapist')
      && !c.name.startsWith('client')
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
          factors: factors.map(toTitleCase),
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

const submissionSchema = new mongoose.Schema({
  role: { type: String, enum: ['client', 'therapist'], required: true },
  submittedAt: { type: Date, default: Date.now },
  responses: { type: mongoose.Schema.Types.Mixed },
});

const ClientSubmission = mongoose.model('ClientSubmission', submissionSchema, 'client_submissions');
const TherapistSubmission = mongoose.model('TherapistSubmission', submissionSchema, 'therapist_submissions');

exports.processInputs = async (req, res) => {
  try {
    const { responses, role = null } = req.body;

    if (!responses || !role) {
      return res.status(400).json({ error: 'Missing data in submission' });
    }

    const submissionData = {
      role,
      responses,
    };

    let SubmissionModel = null;
    if (role === 'client') SubmissionModel = ClientSubmission;
    else if (role === 'therapist') SubmissionModel = TherapistSubmission;
    else return res.status(400).json({ error: 'Invalid role submitted' });
    console.log('Saving submission:', submissionData);

    await new SubmissionModel(submissionData).save();

    console.log('Submission saved to MongoDB');

    res.status(200).json({ result: 'Submission saved successfully' });
  } catch (err) {
    console.error('Error saving submission:', err);
    res.status(500).json({ error: 'Failed to save submission' });
  }
};

exports.addFactor = async (req, res) => {
  const { inputName, newFactor } = req.body;

  if (!inputName || !newFactor) {
    return res.status(400).json({ error: 'Missing inputName or newFactor' });
  }

  try {
    const model = mongoose.models[inputName]
      || mongoose.model(inputName, new mongoose.Schema({}, { strict: false }), inputName);

    const exists = await model.findOne({ Factor: newFactor });
    if (exists) {
      return res.status(409).json({ message: 'Factor already exists' });
    }

    await model.create({ Factor: newFactor });
    console.log(`Added "${newFactor}" to "${inputName}" collection`);
    res.status(201).json({ message: 'Factor added successfully' });
  } catch (err) {
    console.error('Error adding factor:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.searchInputs = async (req, res) => {
  try {
    const { responses } = req.body;
    console.log('Received search data:', responses);

    if (!responses || Object.keys(responses).length === 0) {
      return res.status(400).json({ error: 'No search data provided' });
    }

    const allTherapistSubmissions = await TherapistSubmission.find();

    const matchingSubmission = allTherapistSubmissions.find((submission) => {
      const therapistResponses = submission.responses;

      // Only compare keys that have a non-empty value
      const nonEmptyEntries = Object.entries(responses).filter(
        ([_, value]) => { return value && value.trim() !== ''; },
      );

      return nonEmptyEntries.every(([key, value]) => {
        return therapistResponses[key]?.toLowerCase?.() === value.toLowerCase();
      });
    });

    if (!matchingSubmission) {
      return res.status(200).json({ result: {} });
    }

    return res.status(200).json({ result: matchingSubmission.responses });
  } catch (err) {
    console.error('Error during search:', err);
    res.status(500).json({ error: 'Search failed' });
  }
};
