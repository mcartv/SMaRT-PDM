// Extracted pre-auth student lookup route
app.post('/api/auth/check-student-id', async (req, res) => {
  try {
    const student_id = String(req.body?.student_id || '').trim().toUpperCase();

    if (!student_id) {
      return res.status(400).json({
        error: 'Student ID is required',
      });
    }

    const registryStudent = await resolveRegistrarStudentByStudentNumber(student_id);

    if (!registryStudent) {
      return res.status(200).json({
        exists: false,
        hasAccount: false,
        student: null,
      });
    }

    const { data: existingUser, error } = await supabase
      .from('users')
      .select('user_id')
      .eq('username', student_id)
      .maybeSingle();

    if (error) {
      console.error('USER LOOKUP ERROR:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      exists: true,
      hasAccount: !!existingUser,
      student: registryStudent,
    });

  } catch (err) {
    console.error('CHECK STUDENT ERROR:', err);
    return res.status(500).json({
      error: err.message,
    });
  }
});

// Configure multer to hold the uploaded file in memory temporarily
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableFetchError(error) {
  const message = [error?.message, error?.details, error?.cause?.message]
    .filter(Boolean)
    .join(' ');

  return [
    'fetch failed',
    'econnreset',
    'etimedout',
    'eai_again',
    'enotfound',
    'socket hang up',
  ].some((token) => message.toLowerCase().includes(token));
}

function getRequestMethod(input, init) {
  if (init?.method) return String(init.method).toUpperCase();
  if (typeof input === 'object' && input?.method) {
    return String(input.method).toUpperCase();
  }

  return 'GET';
}

async function supabaseFetchWithRetry(input, init) {
  const method = getRequestMethod(input, init);
  const canRetry = ['GET', 'HEAD', 'OPTIONS'].includes(method);
  const maxAttempts = canRetry ? 3 : 1;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;

      if (!canRetry || !isRetryableFetchError(error) || attempt === maxAttempts) {
        throw error;
      }

      await sleep(250 * attempt);
    }
  }

  throw lastError;
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: supabaseFetchWithRetry,
  },
});

