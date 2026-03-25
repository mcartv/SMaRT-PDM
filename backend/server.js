require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
// CRITICAL: Use your `service_role` secret key here, NOT the `anon` / publishable key.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Temporary in-memory store for OTPs (e.g., { "user@email.com": { otp: "123456", expiresAt: 171146... } })
// In production, you could also save this to a 'otps' table in Supabase.
const otpStore = new Map();

// Configure the email sender
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'pelimavenice.pdm@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD 
  }
});

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(userEmail, otpCode) {
  const mailOptions = {
    from: '"SMaRT-PDM Admin" <pelimavenice.pdm@gmail.com>',
    to: userEmail,
    subject: 'Your SMaRT-PDM Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Welcome to SMaRT-PDM!</h2>
        <p>Your 6-digit verification code is:</p>
        <h1 style="letter-spacing: 5px; color: #7C4A2E;">${otpCode}</h1>
        <p>Please enter this code in the app to verify your account. It will expire in 10 minutes.</p>
      </div>
    `
  };
  await transporter.sendMail(mailOptions);
}

// --- ROUTES ---

// 1. Register Route
app.post('/api/auth/register', async (req, res) => {
  const { email, password, first_name, last_name } = req.body;

  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Hash the password securely
  const hashedPassword = await bcrypt.hash(password, 10);

  // Save the user credentials to Supabase
  const { data, error } = await supabase
    .from('users')
    .insert([{ email, password: hashedPassword, first_name, last_name, is_verified: false }]);

  if (error) {
    console.error('Supabase Insert Error:', error);
    return res.status(400).json({ error: 'Email already exists or database error' });
  }

  const otp = generateOTP();
  // Store OTP with a 10-minute expiration
  otpStore.set(email, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

  // Send email in the background (DO NOT use 'await' here so we don't hold up the Flutter app)
  sendOTPEmail(email, otp)
    .then(() => console.log(`OTP sent to ${email}`))
    .catch(err => console.error('Error sending email:', err));

  // Respond immediately so Flutter transitions to the OTP screen instantly
  res.status(200).json({ message: 'Registration successful. OTP sent.' });
});

// 2. Verify OTP Route
app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  const record = otpStore.get(email);

  if (!record) return res.status(400).json({ error: 'No OTP found or already verified' });
  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({ error: 'OTP has expired' });
  }
  if (record.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

  // OTP is correct - clear it from store
  otpStore.delete(email);
  
  // Update user's "is_verified" status in Supabase
  const { error } = await supabase
    .from('users')
    .update({ is_verified: true })
    .eq('email', email);

  if (error) return res.status(500).json({ error: 'Failed to verify user in database' });

  res.status(200).json({ message: 'Email verified successfully' });
});

// 3. Resend OTP Route
app.post('/api/auth/resend-otp', (req, res) => {
  const { email } = req.body;
  const otp = generateOTP();
  
  otpStore.set(email, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
  sendOTPEmail(email, otp).catch(err => console.error('Error resending email:', err));
  
  res.status(200).json({ message: 'OTP resent successfully' });
});

// 4. Login Route
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Fetch the user from Supabase
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !data) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Compare the provided password with the hashed password in the database
  const isMatch = await bcrypt.compare(password, data.password);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!data.is_verified) {
    return res.status(403).json({ error: 'Please verify your email first' });
  }

  // Generate a real JWT token here in production
  res.status(200).json({ 
    message: 'Login successful', 
    token: 'mock_jwt_token', 
    user: { id: data.id, email: data.email, first_name: data.first_name, last_name: data.last_name } 
  });
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running and listening on port ${PORT}`);
});