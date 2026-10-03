const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// Serve frontend static files from the 'public' subfolder
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB using Real_Crm database name
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://abhishekpatilonline_db_user:Abhi%40%402026@cluster0.xs3pi5r.mongodb.net/Real_Crm?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('Connected to MongoDB Atlas: Real_Crm');
        
        // Check and ensure default users exist, create them if missing
        const leadExists = await User.findOne({ username: 'lead' });
        if (!leadExists) {
            await User.create({ username: 'lead', password: '123', role: 'teamlead' });
            console.log('Created missing user: lead / 123 (teamlead)');
        }

        const memberExists = await User.findOne({ username: 'member' });
        if (!memberExists) {
            await User.create({ username: 'member', password: '123', role: 'teammember' });
            console.log('Created missing user: member / 123 (teammember)');
        }
    })
    .catch(err => console.error('MongoDB connection error:', err));

// User Schema & Model
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['teamlead', 'teammember'], required: true }
});
const User = mongoose.model('User', userSchema);

// Reusable Sub-schema for individual call logs
const callSubSchema = new mongoose.Schema({
    title: { type: String, default: '' },
    call_connected: { type: String, default: '' },
    remark: { type: String, default: '' },
    leadTemperature: { type: String, default: '' },
    tempSubOption: { type: String, default: '' },
    requirementBudget: { type: String, default: '' },
    requirementFlatSize: { type: String, default: '' },
    requirementFloor: { type: String, default: '' },
    requirementNote: { type: String, default: '' },
    followUpRequired: { type: String, default: '' },
    followUpOption: { type: String, default: '' },
    followUpDate: { type: String, default: '' },
    followUpTime: { type: String, default: '' },
    visitScheduled: { type: String, default: '' },
    visitDate: { type: String, default: '' },
    visitTime: { type: String, default: '' },
    visitBuilding: { type: String, default: '' },
    visitLocation: { type: String, default: '' },
    visitNote: { type: String, default: '' },
    visitorComing: { type: String, default: '' },
    rescheduleReason: { type: String, default: '' },
    visitInterestCustomer: { type: String, default: '' },
    rescheduleVisitChoice: { type: String, default: '' },
    leadStatus: { type: String, default: '' },
    closeReason: { type: String, default: '' },
    loggedAt: { type: Date, default: Date.now }
});

// Helper function: Maps username strictly to tasks_[username] collection
function getMemberTaskModel(username) {
    const cleanName = username.trim().replace(/[^a-zA-Z0-9_]/g, '_');
    const collectionName = `tasks_${cleanName}`;
    
    const taskSchema = new mongoose.Schema({
        name: { type: String, required: true, default: 'Untitled Lead' },
        contactNumber: { type: String, default: '' },
        description: { type: String, default: '' },
        status: { type: String, default: 'Pending' },
        followUpRequired: { type: String, default: '' },
        followUpDate: { type: String, default: '' },
        followUpTime: { type: String, default: '' },
        followUpOption: { type: String, default: '' },
        visitRequired: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now }
    }, { strict: false });
    return mongoose.models[collectionName] || mongoose.model(collectionName, taskSchema, collectionName);
}

// --- Explicit HTML Routes (Serving from 'public' folder) ---
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.get('/teamlead.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'teamlead.html')); });
app.get('/leaduser.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'leaduser.html')); });
app.get('/assigntaskteammember.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'assigntaskteammember.html')); });
app.get('/teammember.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'teammember.html')); });
app.get('/assignedmembertask.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'assignedmembertask.html')); });
app.get('/followups.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'followups.html')); });
app.get('/visits.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'visits.html')); });
app.get('/pre-visit.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'pre-visit.html')); });
app.get('/post-visit.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'post-visit.html')); });
app.get('/visit-interested.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'visit-interested.html')); });
app.get('/lead-response.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'lead-response.html')); });

// --- API: Login Route ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username: username.trim(), password });
        if (!user) return res.status(401).json({ success: false, message: 'Invalid username or password' });
        res.json({ success: true, role: user.role, username: user.username });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// --- API: Add Member & Provision Collection ---
app.post('/api/add-member', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }
    try {
        const trimmedUsername = username.trim();
        const existingUser = await User.findOne({ username: trimmedUsername });
        if (existingUser) {
            return res.json({ success: false, message: 'Username already exists.' });
        }

        // Create the team member user
        await User.create({
            username: trimmedUsername,
            password: password.trim(),
            role: 'teammember'
        });

        // Initialize/provision their dedicated collection via helper function
        getMemberTaskModel(trimmedUsername);

        res.json({ 
            success: true, 
            message: `Team member '${trimmedUsername}' created successfully and collection 'tasks_${trimmedUsername}' initialized!` 
        });
    } catch (err) {
        console.error('Error adding member:', err);
        res.status(500).json({ success: false, message: 'Server error while creating team member.' });
    }
});

app.get('/api/members', async (req, res) => {
    try {
        const members = await User.find({ role: 'teammember' }, 'username');
        res.json({ success: true, members });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error fetching members' });
    }
});

app.post('/api/assign-task', async (req, res) => {
    const { username, name, title, description, contactNumber } = req.body;
    try {
        const leadName = name || title;
        const MemberTaskModel = getMemberTaskModel(username);
        await MemberTaskModel.create({ name: leadName, description: description || '', contactNumber: contactNumber || '', status: 'Pending' });
        res.json({ success: true, message: 'Task assigned successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error assigning task.' });
    }
});

// --- API: Get Member Tasks ---
app.get('/api/member-tasks/:username', async (req, res) => {
    try {
        const MemberTaskModel = getMemberTaskModel(req.params.username.trim());
        const tasks = await MemberTaskModel.find().sort({ createdAt: -1 });

        const processedTasks = tasks.map(t => {
            let taskObj = t.toObject();
            let latestFollowUp = null;
            let latestVisit = null;
            let i = 1;
            while (taskObj[`call${i}`]) {
                const call = taskObj[`call${i}`];
                if (call.followUpRequired) {
                    latestFollowUp = call;
                }
                if (call.visitScheduled) {
                    latestVisit = call;
                }
                i++;
            }

            if (latestFollowUp) {
                taskObj.followUpRequired = latestFollowUp.followUpRequired;
                taskObj.followUpDate = latestFollowUp.followUpDate || '';
                taskObj.followUpTime = latestFollowUp.followUpTime || '';
                taskObj.followUpOption = latestFollowUp.followUpOption || '';
            } else {
                taskObj.followUpRequired = '';
                taskObj.followUpDate = '';
                taskObj.followUpTime = '';
                taskObj.followUpOption = '';
            }

            if (latestVisit) {
                taskObj.visitRequired = latestVisit.visitScheduled;
            }
            return taskObj;
        });

        res.json({ success: true, tasks: processedTasks });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error loading tasks.' });
    }
});

// --- API: Get Follow-ups for a specific member ---
app.get('/api/followups/:username', async (req, res) => {
    try {
        const MemberTaskModel = getMemberTaskModel(req.params.username.trim());
        const tasks = await MemberTaskModel.find();
        let followups = [];

        tasks.forEach(t => {
            let latestFollowUp = null;
            let i = 1;
            while (t[`call${i}`]) {
                const call = t[`call${i}`];
                if (call.followUpRequired) {
                    latestFollowUp = call;
                }
                i++;
            }

            if (latestFollowUp && latestFollowUp.followUpRequired === 'Yes' && latestFollowUp.followUpDate) {
                followups.push({
                    taskId: t._id,
                    name: t.name || 'Untitled Lead',
                    contactNumber: t.contactNumber || '',
                    followUpDate: latestFollowUp.followUpDate,
                    followUpTime: latestFollowUp.followUpTime || '',
                    followUpOption: latestFollowUp.followUpOption || '',
                    remark: latestFollowUp.remark || ''
                });
            }
        });

        res.json({ success: true, followups });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching follow-ups' });
    }
});

// --- API: Get All Site Visits ---
app.get('/api/all-visits', async (req, res) => {
    try {
        const requestedMember = req.query.username ? req.query.username.trim() : null;
        const members = requestedMember 
            ? [{ username: requestedMember }] 
            : await User.find({ role: 'teammember' }, 'username');

        let allVisits = [];

        for (const member of members) {
            const MemberTaskModel = getMemberTaskModel(member.username);
            const tasks = await MemberTaskModel.find();

            tasks.forEach(t => {
                let latestVisitDate = '';
                let latestVisitTime = '';
                let latestBuilding = '';
                let latestLocation = '';
                let latestNote = '';
                let isScheduled = false;
                let visitorComing = '';
                let lastCallNumber = '';

                let i = 1;
                while (t[`call${i}`]) {
                    const call = t[`call${i}`];
                    if (call.visitScheduled === 'Yes' && call.visitDate) {
                        isScheduled = true;
                        latestVisitDate = call.visitDate;
                        latestVisitTime = call.visitTime || '';
                        latestBuilding = call.visitBuilding || '';
                        latestLocation = call.visitLocation || '';
                        latestNote = call.visitNote || '';
                        visitorComing = call.visitorComing || '';
                        lastCallNumber = `Call ${i}`;
                    }
                    i++;
                }

                if (isScheduled && visitorComing !== 'No') {
                    allVisits.push({
                        memberUsername: member.username,
                        taskId: t._id,
                        name: t.name || 'Untitled Lead',
                        contactNumber: t.contactNumber || '',
                        callNumber: lastCallNumber,
                        visitDate: latestVisitDate,
                        visitTime: latestVisitTime,
                        visitBuilding: latestBuilding,
                        visitLocation: latestLocation,
                        visitNote: latestNote,
                        visitorComing: visitorComing
                    });
                }
            });
        }
        res.json({ success: true, visits: allVisits });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching visits' });
    }
});

// --- API: Get Interested Visits ---
app.get('/api/interested-visits', async (req, res) => {
    try {
        const members = await User.find({ role: 'teammember' }, 'username');
        let interestedVisits = [];

        for (const member of members) {
            const MemberTaskModel = getMemberTaskModel(member.username);
            const tasks = await MemberTaskModel.find();

            tasks.forEach(t => {
                let isInterested = false;
                let latestVisitDate = '';
                let latestVisitTime = '';
                let latestBuilding = '';
                let latestLocation = '';

                let i = 1;
                while (t[`call${i}`]) {
                    const call = t[`call${i}`];
                    if (call.visitInterestCustomer === 'Yes') {
                        isInterested = true;
                    }
                    if (call.visitDate) {
                        latestVisitDate = call.visitDate;
                        latestVisitTime = call.visitTime || '';
                        latestBuilding = call.visitBuilding || '';
                        latestLocation = call.visitLocation || '';
                    }
                    i++;
                }

                if (isInterested) {
                    interestedVisits.push({
                        memberUsername: member.username,
                        taskId: t._id,
                        name: t.name || 'Untitled Lead',
                        contactNumber: t.contactNumber || '',
                        visitDate: latestVisitDate,
                        visitTime: latestVisitTime,
                        visitBuilding: latestBuilding,
                        visitLocation: latestLocation
                    });
                }
            });
        }
        res.json({ success: true, visits: interestedVisits });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching interested visits' });
    }
});

// --- API: Get Single Lead Details ---
app.get('/api/lead-details/:username/:taskId', async (req, res) => {
    try {
        const { username, taskId } = req.params;
        const MemberTaskModel = getMemberTaskModel(username);
        const lead = await MemberTaskModel.findById(taskId);
        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });
        res.json({ success: true, lead });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// --- API: Update Task Status & Dynamically Append Call Logs ---
app.post('/api/update-task-status/:username/:taskId', async (req, res) => {
    const { username, taskId } = req.params;
    const { 
        title,
        call_connected, 
        remark, 
        followUpRequired,
        followUpOption,
        followUpDate,
        followUpTime,
        visitScheduled, 
        visitDate, 
        visitTime,
        visitBuilding,
        visitLocation,
        visitNote,
        visitorComing,
        rescheduleReason,
        visitInterestCustomer,
        rescheduleVisitChoice,
        leadStatus,
        closeReason
    } = req.body; 

    try {
        const callData = {
            title: title || 'Call Log',
            call_connected: call_connected || 'Completed',
            remark: remark || '',
            followUpRequired: followUpRequired || '',
            followUpOption: followUpRequired === 'Yes' ? (followUpOption || '') : '',
            followUpDate: followUpRequired === 'Yes' ? (followUpDate || '') : '',
            followUpTime: followUpRequired === 'Yes' ? (followUpTime || '') : '',
            visitScheduled: visitScheduled || '',
            visitDate: visitDate || '',
            visitTime: visitTime || '',
            visitBuilding: visitBuilding || '',
            visitLocation: visitLocation || '',
            visitNote: visitNote || '',
            visitorComing: visitorComing || '',
            rescheduleReason: rescheduleReason || '',
            visitInterestCustomer: visitInterestCustomer || '',
            rescheduleVisitChoice: rescheduleVisitChoice || '',
            leadStatus: leadStatus || '',
            closeReason: closeReason || '',
            loggedAt: new Date()
        };

        const MemberTaskModel = getMemberTaskModel(username);
        const task = await MemberTaskModel.findById(taskId);
        if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

        let index = 1;
        while (task[`call${index}`] !== null && task[`call${index}`] !== undefined) {
            index++;
        }
        const callFieldKey = `call${index}`;

        const updatePayload = {
            status: 'Completed',
            [callFieldKey]: callData
        };

        if (followUpRequired) {
            updatePayload.followUpRequired = followUpRequired;
            updatePayload.followUpDate = followUpRequired === 'Yes' ? (followUpDate || '') : '';
            updatePayload.followUpTime = followUpRequired === 'Yes' ? (followUpTime || '') : '';
            updatePayload.followUpOption = followUpRequired === 'Yes' ? (followUpOption || '') : '';
        } else {
            updatePayload.followUpRequired = '';
            updatePayload.followUpDate = '';
            updatePayload.followUpTime = '';
            updatePayload.followUpOption = '';
        }

        if (visitScheduled) {
            updatePayload.visitRequired = visitScheduled;
        }

        const updatedTask = await MemberTaskModel.findByIdAndUpdate(
            taskId,
            updatePayload,
            { new: true }
        );

        res.json({ success: true, message: `Successfully saved under ${callFieldKey}!`, task: updatedTask });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error saving call outcome.' });
    }
});

// Use dynamic port assigned by Render/Environment with fallback to 3000 for local testing
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server running at port ${PORT}`); });
