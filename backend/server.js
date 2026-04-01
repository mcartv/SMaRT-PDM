require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const multer = require('multer');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // In production, restrict this to your app's domain/origins
    methods: ["GET", "POST"]
  }
});
app.use(cors());
app.use(express.json());

// Configure multer to hold the uploaded file in memory temporarily
const upload = multer({ storage: multer.memoryStorage() });

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
  const { email, password, student_id } = req.body; // username is no longer expected as a primary input

  console.log('DEBUG (Backend): Received registration request body:', req.body);

  // 1. Initial required fields check
  // Validate required fields: email, password, and student_id
  if (!email || !password || !student_id) {
    return res.status(400).json({ error: 'Email, password, and Student ID are required' });
  }

  // 2. Server-side validation for student_id format (e.g., PDM-YYYY-NNNNNN)
  const studentIdRegex = /^PDM-\d{4}-\d{6}$/;
  if (!studentIdRegex.test(student_id)) {
    return res.status(400).json({ error: 'Student ID must be in the format PDM-YYYY-NNNNNN (e.g., PDM-2023-000001)' });
  }

  // 3. Check student_id uniqueness
  const { data: existingUserByStudentId, error: studentIdCheckError } = await supabase
    .from('users')
    .select('student_id')
    .eq('student_id', student_id)
    .single();

  if (studentIdCheckError && studentIdCheckError.code !== 'PGRST116') { // PGRST116 means "no rows found"
    console.error('Supabase Student ID Check Error:', studentIdCheckError);
    return res.status(500).json({ error: 'Database error during student ID check' });
  }
  if (existingUserByStudentId) {
    return res.status(409).json({ error: 'Student ID already registered' });
  }

  // 4. Check email uniqueness (if not already handled by DB constraint)
  const { data: existingUserByEmail, error: emailCheckError } = await supabase
    .from('users')
    .select('email')
    .eq('email', email)
    .single();

  if (emailCheckError && emailCheckError.code !== 'PGRST116') {
    console.error('Supabase Email Check Error:', emailCheckError);
    return res.status(500).json({ error: 'Database error during email check' });
  }
  if (existingUserByEmail) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  // Hash the password securely
  const hashedPassword = await bcrypt.hash(password, 10);

  // Save the user credentials to Supabase
  const { data, error } = await supabase
    .from('users') // Assuming 'student_id' and 'username' columns exist in your 'users' table
    .insert([{ email, password: hashedPassword, student_id: student_id, username: null, is_verified: false }]);

  if (error) {
    console.error('Supabase Insert Error:', error);
    // This block catches other potential DB errors like check constraint violations
    // For unique constraints, we've already handled email and student_id above.
    // If there's a unique constraint on username and it's not null, this would catch it.
    return res.status(500).json({ error: 'Database error during registration' });
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

// 4. Upload Avatar Route
app.post('/api/auth/upload-avatar', upload.single('image'), async (req, res) => {
  const { email } = req.body;
  const file = req.file;

  if (!email || !file) {
    return res.status(400).json({ error: 'Email and image file are required' });
  }

  try {
    // 1. Upload file to Supabase Storage
    const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
    const { data: storageData, error: storageError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });

    if (storageError) throw storageError;

    // 2. Get the public URL of the uploaded image
    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    const avatarUrl = publicUrlData.publicUrl;

    // 3. Save URL to users table
    await supabase.from('users').update({ avatar_url: avatarUrl }).eq('email', email);

    res.status(200).json({ message: 'Upload successful', avatarUrl });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// 5. Login Route
app.post('/api/auth/login', async (req, res) => {
  const { student_id, password } = req.body; // Expect student_id for login

  if (!student_id || !password) {
    return res.status(400).json({ error: 'Student ID and password are required' });
  }

  // Fetch the user from Supabase using student_id
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('student_id', student_id)
    .single();

  if (error || !data) {
    return res.status(401).json({ error: 'Invalid Student ID or password' });
  }

  // Compare the provided password with the hashed password in the database
  const isMatch = await bcrypt.compare(password, data.password);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid Student ID or password' });
  }

  if (!data.is_verified) {
    return res.status(403).json({ error: 'Please verify your email first' });
  }

  // Generate a real JWT token here in production
  res.status(200).json({ 
    message: 'Login successful', 
    token: 'mock_jwt_token', 
    user: { 
      id: data.id,
      email: data.email, // Still return email in user object if needed elsewhere
      student_id: data.student_id,
      avatar_url: data.avatar_url
    } 
  });
});

// 6. Get Chat History Route
app.get('/api/messages/:room', async (req, res) => {
  const { room } = req.params;
  
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('room', room)
    .order('created_at', { ascending: false }) // Fetches newest first to match Flutter's reverse ListView
    .limit(50);

  if (error) {
    console.error('Error fetching messages from Supabase:', error);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
  
  res.status(200).json(data);
});

// --- SOCKET.IO REAL-TIME CHAT LOGIC ---
io.on('connection', (socket) => {
  console.log(`User connected via Socket.io: ${socket.id}`);

  // Allow a user to join a specific room (e.g., their student_id to chat with admin)
  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });

  // Listen for messages from the client
  socket.on('send_message', async (data) => {
    console.log('Message received on backend:', data);
    
    // Broadcast the message to everyone else in that specific room
    socket.to(data.room).emit('receive_message', data);
    
    // Save the message into Supabase
    const { error } = await supabase.from('messages').insert([{
      room: data.room,
      sender_id: data.sender_id, // Needs to be sent by the client (e.g., student ID)
      text: data.text
    }]);
    if (error) console.error('Error saving message to Supabase:', error);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running and listening on port ${PORT}`);
});