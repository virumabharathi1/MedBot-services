import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendAppointmentConfirmation = async (email, appointmentDetails) => {
    console.log(appointmentDetails, "appointmentDetails")
    const { firstname, lastname, providerName, appointmentTime, reasonForAppointment } = appointmentDetails;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email, // Recipient's email
        subject: `Appointment Confirmation with ${providerName}`,
        html: `
      <div style="font-family: 'Arial', sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        
        <div style="background-color: #4CAF50; padding: 20px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">Appointment Confirmed</h1>
        </div>
        
        <div style="padding: 30px;">
          <p style="font-size: 16px;">Hello <strong>${firstname} ${lastname}</strong>,</p>
          <p style="font-size: 16px;">Your appointment has been successfully booked with:</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; font-weight: bold; width: 150px;">Provider</td>
              <td style="padding: 8px;">${providerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Reason</td>
              <td style="padding: 8px;">${reasonForAppointment}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Date & Time</td>
              <td style="padding: 8px;">${new Date(appointmentTime).toLocaleString()}</td>
            </tr>
          </table>

          <p style="font-size: 16px; margin-top: 20px;">Please arrive 10 minutes early and carry any necessary documents.</p>
          <p style="font-size: 16px; margin-top: 20px;">Thank you,<br><strong>Pediatric Associates Of Frisco</strong></p>
        </div>

        <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #777;">
          © 2025 Pediatric Associates Of Frisco. All rights reserved.
        </div>
      </div>
    `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Confirmation email sent successfully!');
    } catch (error) {
        console.error('❌ Error sending confirmation email:', error);
    }
};

export default sendAppointmentConfirmation;