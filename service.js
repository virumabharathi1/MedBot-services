import express from 'express';
import axios from 'axios';
import qs from 'qs';
import cors from 'cors';
import dotenv from 'dotenv';
import sendAppointmentConfirmation from './mailer.js';
import nodemailer from 'nodemailer';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use STARTTLS
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    // Required to use STARTTLS (Port 587)
    // You can also add this line to ensure the connection
    requireTLS: true, 
    timeout: 30000 
});
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

async function sendSampleOrderEmail(details) {
  const { customerEmail, customerName, productCode, productName, productType, shippingAddress } = details;

  // You should use your actual company email here
  const companyEmail = 'virumab6@gmail.com';

  console.log(`Attempting to send Sample Order email to: ${customerEmail}`);

  const mailOptions = {
    from: `"Wilsonart Samples"`,
    to: customerEmail, // customer email
    subject: `Your Sample Order Confirmation - ${productName}`,
    html: `
        <div style="font-family: 'Arial', sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            
            <div style="background-color: #004d40; padding: 20px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px;">Sample Order Confirmed!</h1>
            </div>
            
            <div style="padding: 30px;">
                <p style="font-size: 16px;">Hi <strong>${customerName}</strong>,</p>
                <p style="font-size: 16px;">Thank you for your interest! Your sample request has been successfully placed:</p>

                <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #ddd;">
                    <tr>
                        <td style="padding: 12px; font-weight: bold; width: 150px; background-color: #f9f9f9;">Product Name</td>
                        <td style="padding: 12px;">${productName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; font-weight: bold; background-color: #f9f9f9;">Product Code</td>
                        <td style="padding: 12px;">${productCode}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; font-weight: bold; background-color: #f9f9f9;">Type</td>
                        <td style="padding: 12px;">${productType}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; font-weight: bold; background-color: #f9f9f9;">Shipping To</td>
                        <td style="padding: 12px;">${shippingAddress}</td>
                    </tr>
                </table>

                <p style="font-size: 16px; margin-top: 20px;">Your sample will be processed and shipped shortly. You will receive a separate email once it ships.</p>
                <p style="font-size: 16px; margin-top: 20px;">Thank you,<br><strong>The Wilsonart Team</strong></p>
            </div>

            <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #777;">
                © ${new Date().getFullYear()} Wilsonart. All rights reserved.
            </div>
        </div>
        `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Sample Order Email sent successfully to ${customerEmail}`);
  } catch (err) {
    console.error('Error sending sample order email:', err);
    throw new Error('Failed to send confirmation email.');
  }
}


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
app.post('/api/order/sample', async (req, res) => {
  const {
    productCode,
    productName,
    type: productType, // Renaming 'type' to 'productType' for clarity
    customerName,
    customerEmail,
    customerPhone,
    shippingAddress
  } = req.body;

  // 1. Basic Validation (add more as needed)
  if (!productCode || !customerEmail || !shippingAddress) {
    return res.status(400).json({ success: false, error: 'Missing product details, email, or shipping address.' });
  }

  try {
    // 2. Insert Order into Database (Example using your existing DB pool)
    // NOTE: You would need a table like 'sample_orders' for this in a real application.
    // Since I don't know your schema, I will skip the DB call to prevent errors,
    // but this is where it would go:
    /*
    const orderResult = await pool.query(
        `INSERT INTO sample_orders (code, name, type, customer_name, email, phone, address, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
        [productCode, productName, productType, customerName, customerEmail, customerPhone, shippingAddress]
    );
    const orderId = orderResult.rows[0].id;
    console.log(`Sample Order recorded in DB with ID: ${orderId}`);
    */

    // 3. Send Confirmation Email
    await sendSampleOrderEmail({
      customerName: customerName,
      customerEmail: customerEmail,
      productCode: productCode,
      productName: productName,
      productType: productType,
      shippingAddress: shippingAddress
    });

    // 4. Send Success Response
    res.json({
      success: true,
      message: 'Sample order placed successfully and confirmation email sent.',
      product: { productCode, productName, productType }
    });

  } catch (err) {
    console.error('Error processing sample order:', err);
    // Ensure error is a string for the JSON response
    const errorMessage = err.message || 'Internal server error during order processing.';
    res.status(500).json({ success: false, error: errorMessage });
  }
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
  const user = doctors.find(u => u.username?.toLowerCase() === username?.toLowerCase() && u.password === password);
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
