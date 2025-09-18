import express from 'express';
import axios from 'axios';
import qs from 'qs';
import cors from 'cors';
import dotenv from 'dotenv';
import sendAppointmentConfirmation from './mailer.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const config = {
  athena: {
    clientId: process.env.ATHENA_CLIENT_ID,
    clientSecret: process.env.ATHENA_CLIENT_SECRET,
    practiceId: process.env.ATHENA_PRACTICE_ID,
    tokenUrl: process.env.ATHENA_TOKEN_URL,
    providersUrl: process.env.ATHENA_PROVIDERS_URL,
  },
  server: {
    port: process.env.PORT || 5001,
  },
};

// In-memory storage
let demoAppointments = [];
let doctors = [];

// =====================
// Helper: Get Athena token
// =====================
const getAthenaToken = async () => {
  const { clientId, clientSecret, tokenUrl } = config.athena;
  const tokenResp = await axios.post(
    tokenUrl,
    qs.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'athena/service/Athenanet.MDP.*'
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return tokenResp.data.access_token;
};
app.get('/api/providers', (req, res) => {
  if (!doctors.length) {
    return res.status(404).json({ error: 'No providers available' });
  }

  // Send minimal info required for frontend
  const providersData = doctors.map(d => ({
    providerId: d.providerId,
    name: d.name,
    username: d.username
  }));

  res.json({ providers: providersData });
});
// =====================
// Fetch providers and assign demo credentials
// =====================
const assignSandboxProviders = async () => {
  try {
    const token = await getAthenaToken();
    const resp = await axios.get(
      `${config.athena.providersUrl}/${config.athena.practiceId}/providers`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const validProviders = resp.data.providers.filter(p => p.displayname);
    doctors = validProviders.map((p, index) => ({
      providerId: p.providerid,
      name: p.displayname,
      username: `doctor${index + 1}`,
      password: 'pass123'
    }));

    console.log('🔥 Demo login credentials:');
    doctors.forEach(d => console.log(`Provider: ${d.name} | Username: ${d.username} | Password: ${d.password}`));
  } catch (err) {
    console.error('Error fetching providers:', err.response?.data || err.message);
    doctors = [
      { name: 'Dr. John Smith', username: 'drjohnsmith', password: 'pass123', providerId: 1 },
      { name: 'Dr. Jane Doe', username: 'drjanedoe', password: 'pass123', providerId: 2 }
    ];
  }
};

// =====================
// Create sandbox patient
// =====================
const createSandboxPatient = async ({ firstname, lastname, dobFormatted, gender, departmentid }) => {
  try {
    const token = await getAthenaToken();
    const resp = await axios.post(
      `${config.athena.providersUrl}/${config.athena.practiceId}/patients`,
      qs.stringify({ firstname, lastname, dob: dobFormatted, gender, departmentid }),
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return resp.data;
  } catch (err) {
    console.error('Error creating sandbox patient:', err.response?.data || err.message);
    return null;
  }
};

// =====================
// Book sandbox appointment
// =====================
const bookSandboxAppointment = async ({ providerId, departmentId, patientId, reason }) => {
  try {
    const token = await getAthenaToken();
    const resp = await axios.post(
      `${config.athena.providersUrl}/${config.athena.practiceId}/appointments`,
      qs.stringify({
        providerid: providerId,
        departmentid: departmentId,
        patientid: patientId,
        reason
      }),
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return resp.data;
  } catch (err) {
    console.error('Error booking sandbox appointment:', err.response?.data || err.message);
    return null;
  }
};

// =====================
// Login API
// =====================
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = doctors.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({
    name: user.name,
    username: user.username,
    role: 'doctor',
    message: `Welcome Dr. ${user.name.split(' ')[1] || user.name}!`
  });
});

// =====================
// Sandbox booking API
// =====================
app.post('/api/sandbox-booking', async (req, res) => {
  const { firstname, lastname, dob, gender, doctorUsername, reasonForAppointment } = req.body;

  const doctor = doctors.find(d => d.username === doctorUsername);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

  // Hardcoded department ID (replace with a valid one from your sandbox)
  const HARD_CODED_DEPARTMENT_ID = 1;
  console.log(`ℹ️ Using hardcoded Department ID: ${HARD_CODED_DEPARTMENT_ID} for provider ${doctor.name}`);
  const dobFormatted = new Date(dob).toISOString().split('T')[0];
  // 1️⃣ Create sandbox patient
  const patient = await createSandboxPatient({ firstname, lastname, dobFormatted, gender, departmentid: HARD_CODED_DEPARTMENT_ID });

  if (!patient || !patient.patientid) {
    console.warn('⚠️ Sandbox patient creation failed, falling back to demo');
    const newAppointment = {
      providerUsername: doctor.username,
      providerName: doctor.name,
      firstname,
      lastname,
      reasonForAppointment,
      appointmentTime: new Date().toISOString(),
      status: 'Scheduled'
    };
    demoAppointments.push(newAppointment);
    return res.json({ appointment: newAppointment, source: 'demo' });
  }

  // 2️⃣ Book appointment in sandbox
  const appointment = await bookSandboxAppointment({
    providerId: doctor.providerId,
    departmentId: HARD_CODED_DEPARTMENT_ID,
    patientId: patient.patientid,
    reason: reasonForAppointment
  });

  if (!appointment) {
    console.warn('⚠️ Booking in sandbox failed, falling back to demo');
    const newAppointment = {
      providerUsername: doctor.username,
      providerName: doctor.name,
      firstname,
      lastname,
      reasonForAppointment,
      appointmentTime: new Date().toISOString(),
      status: 'Scheduled'
    };
    demoAppointments.push(newAppointment);
    return res.json({ appointment: newAppointment, source: 'demo' });
  }

  res.json({ appointment, source: 'sandbox' });
});

// =====================
// Demo appointments API
// =====================
app.get('/api/appointments/:username', (req, res) => {
  const doctor = doctors.find(u => u.username === req.params.username);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

  const appointments = demoAppointments
    .filter(a => a.providerUsername === doctor.username)
    .map(a => ({
      firstName: a.firstname, // map to camelCase
      lastName: a.lastname,
      reasonForAppointment: a.reasonForAppointment,
      appointmentTime: a.appointmentTime,
      status: a.status,
    }));

  res.json({ appointments });
});

// =====================
// Store appointment API
// =====================
app.post('/api/appointments', async (req, res) => {
  const {
    firstName,
    lastName,
    dob,
    gender,
    providerToSee,
    reasonForAppointment,
    email,
    phoneNumber,
  } = req.body;

  // Find doctor by name
  const doctor = doctors.find(d => d.name === providerToSee);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

  // Hardcoded department ID (use a valid one for sandbox)
  const HARD_CODED_DEPARTMENT_ID = 1;
  const dobFormatted = new Date(dob).toISOString().split('T')[0];

  // 1️⃣ Create sandbox patient
  const patient = await createSandboxPatient({
    firstname: firstName,
    lastname: lastName,
    dobFormatted,
    gender,
    departmentid: HARD_CODED_DEPARTMENT_ID,
  });

  // 2️⃣ Book sandbox appointment if patient creation succeeded
  let appointment;
  if (patient && patient.patientid) {
    appointment = await bookSandboxAppointment({
      providerId: doctor.providerId,
      departmentId: HARD_CODED_DEPARTMENT_ID,
      patientId: patient.patientid,
      reason: reasonForAppointment,
    });
  }

  // 3️⃣ Fallback to demo appointment if sandbox fails
  if (!appointment) {
    console.warn('⚠️ Booking failed or sandbox patient creation failed, using demo storage');
    appointment = {
      providerUsername: doctor.username,
      providerName: doctor.name,
      firstname: firstName,
      lastname: lastName,
      reasonForAppointment,
      email,
      phoneNumber,
      appointmentTime: new Date().toISOString(),
      status: 'Scheduled',
    };
    demoAppointments.push(appointment);
  }
  // Optional: send confirmation email
  sendAppointmentConfirmation(email, appointment);

  res.json({ appointment, source: appointment.patientid ? 'sandbox' : 'demo' });
});

// =====================
// Start server
// =====================
app.listen(config.server.port, async () => {
  console.log(`Backend running on port ${config.server.port}`);
  await assignSandboxProviders();
});
