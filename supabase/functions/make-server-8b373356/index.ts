// @ts-nocheck
import { Hono, Context } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.ts";

const app = new Hono();

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
);

// Knowledge base bucket name
const BUCKET_NAME = 'make-8b373356-knowledge-base';

// Unified error message extraction helper
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

// Initialize storage bucket
async function initBucket() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);

    if (!bucketExists) {
      await supabase.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 52428800, // 50MB
      });
      console.log('Created knowledge base bucket');
    }
  } catch (error) {
    console.error('Error initializing bucket:', error);
  }
}

// Global cache for documents to speed up response
// User-specific cache for documents to speed up response
const userDocsCache = new Map<string, { data: any[], timestamp: number }>();
const DOCS_CACHE_TTL = 60 * 1000; // 1 minute cache

// Initialize bucket on startup
initBucket();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  '*',
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// --- Authentication Helpers ---
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateToken(): string {
  return crypto.randomUUID();
}

async function getUserFromToken(c: Context): Promise<string | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const session = await kv.get(`session:${token}`);
  if (!session || session.expiresAt < Date.now()) {
    return null;
  }
  return session.username;
}

function getSafeModelConfig(user: any) {
  if (!user?.modelConfig?.modelId || !user?.modelConfig?.apiKey) {
    return null;
  }

  return {
    modelId: user.modelConfig.modelId,
    apiKey: user.modelConfig.apiKey,
    updatedAt: user.modelConfig.updatedAt,
  };
}

function isModelConfigProviderError(status: number): boolean {
  return status === 401 || status === 403 || status === 404;
}

async function movePrefixedData(oldPrefix: string, newPrefix: string): Promise<void> {
  const { data, error } = await supabase
    .from("kv_store_8b373356")
    .select("key, value")
    .like("key", oldPrefix + "%");

  if (error) {
    throw new Error(error.message);
  }

  const entries = data ?? [];
  if (!entries.length) return;

  await Promise.all(entries.map((entry) => {
    const nextKey = entry.key.replace(oldPrefix, newPrefix);
    return kv.set(nextKey, entry.value);
  }));

  await kv.mdel(entries.map((entry) => entry.key));
}

// --- Authentication Endpoints ---

// Register
app.post("/make-server-8b373356/auth/register", async (c: Context) => {
  try {
    const { username, password, securityQuestion, securityAnswer } = await c.req.json();

    if (!username || !password || !securityQuestion || !securityAnswer) {
      return c.json({ error: 'All fields are required' }, 400);
    }

    // Check if user exists
    const existingUser = await kv.get(`user:${username}`);
    if (existingUser) {
      return c.json({ error: 'Username already exists' }, 409);
    }

    const passwordHash = await hashPassword(password);
    const securityAnswerHash = await hashPassword(securityAnswer.toLowerCase());

    const user = {
      username,
      passwordHash,
      securityQuestion,
      securityAnswerHash,
      createdAt: new Date().toISOString()
    };

    await kv.set(`user:${username}`, user);
    console.log(`User registered: ${username}`);

    return c.json({ success: true });
  } catch (error) {
    console.error('Error registering user:', error);
    return c.json({ error: `Registration failed: ${getErrorMessage(error)}` }, 500);
  }
});

// Login
app.post("/make-server-8b373356/auth/login", async (c: Context) => {
  try {
    const { username, password } = await c.req.json();

    if (!username || !password) {
      return c.json({ error: 'Username and password required' }, 400);
    }

    const user = await kv.get(`user:${username}`);
    if (!user) {
      return c.json({ error: 'Invalid username or password' }, 401);
    }

    const passwordHash = await hashPassword(password);
    if (user.passwordHash !== passwordHash) {
      return c.json({ error: 'Invalid username or password' }, 401);
    }

    const token = generateToken();
    const session = {
      username,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    };

    await kv.set(`session:${token}`, session);
    console.log(`User logged in: ${username}`);

    return c.json({ success: true, token, username });
  } catch (error) {
    console.error('Error logging in:', error);
    return c.json({ error: `Login failed: ${getErrorMessage(error)}` }, 500);
  }
});

// Get Security Question
app.get("/make-server-8b373356/auth/question", async (c: Context) => {
  try {
    const username = c.req.query('username');
    if (!username) {
      return c.json({ error: 'Username required' }, 400);
    }

    const user = await kv.get(`user:${username}`);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ success: true, question: user.securityQuestion });
  } catch (error) {
    console.error('Error getting security question:', error);
    return c.json({ error: `Failed to get question: ${getErrorMessage(error)}` }, 500);
  }
});

// Reset Password
app.post("/make-server-8b373356/auth/reset-password", async (c: Context) => {
  try {
    const { username, securityAnswer, newPassword } = await c.req.json();

    if (!username || !securityAnswer || !newPassword) {
      return c.json({ error: 'All fields are required' }, 400);
    }

    const user = await kv.get(`user:${username}`);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const answerHash = await hashPassword(securityAnswer.toLowerCase());
    if (user.securityAnswerHash !== answerHash) {
      return c.json({ error: 'Incorrect security answer' }, 401);
    }

    const newPasswordHash = await hashPassword(newPassword);
    user.passwordHash = newPasswordHash;
    await kv.set(`user:${username}`, user);

    console.log(`Password reset for user: ${username}`);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error resetting password:', error);
    return c.json({ error: `Password reset failed: ${getErrorMessage(error)}` }, 500);
  }
});

// Logout
app.post("/make-server-8b373356/auth/logout", async (c: Context) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      await kv.del(`session:${token}`);
    }
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: true }); // Ignore errors
  }
});

// Health check endpoint
app.get("/make-server-8b373356/health", (c: Context) => {
  return c.json({ status: "ok" });
});

// Update password
app.post("/make-server-8b373356/auth/update-password", async (c: Context) => {
  try {
    const username = await getUserFromToken(c);
    if (!username) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { securityAnswer, newPassword } = await c.req.json();
    if (!securityAnswer || !newPassword) {
      return c.json({ error: 'Security answer and new password are required' }, 400);
    }

    const user = await kv.get(`user:${username}`);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Verify security answer
    const answerHash = await hashPassword(securityAnswer);
    if (answerHash !== user.securityAnswerHash) {
      return c.json({ error: 'Incorrect security answer' }, 400);
    }

    // Update password
    const newPasswordHash = await hashPassword(newPassword);
    user.passwordHash = newPasswordHash;
    await kv.set(`user:${username}`, user);

    console.log(`Password updated for user: ${username}`);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating password:', error);
    return c.json({ error: `Failed to update password: ${getErrorMessage(error)}` }, 500);
  }
});

app.post("/make-server-8b373356/auth/update-question", async (c: Context) => {
  try {
    const username = await getUserFromToken(c);
    if (!username) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { password, newQuestion, newAnswer } = await c.req.json();
    if (!password || !newQuestion || !newAnswer) {
      return c.json({ error: 'Password, new question, and new answer are required' }, 400);
    }

    const user = await kv.get(`user:${username}`);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Verify password
    const passwordHash = await hashPassword(password);
    if (passwordHash !== user.passwordHash) {
      return c.json({ error: 'Incorrect password' }, 400);
    }

    // Update security question
    const newAnswerHash = await hashPassword(newAnswer);
    user.securityQuestion = newQuestion;
    user.securityAnswerHash = newAnswerHash;
    await kv.set(`user:${username}`, user);

    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating security question:', error);
    return c.json({ error: `Failed to update security question: ${getErrorMessage(error)}` }, 500);
  }
});

app.post("/make-server-8b373356/auth/update-username", async (c: Context) => {
  try {
    const username = await getUserFromToken(c);
    if (!username) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { password, newUsername } = await c.req.json();
    if (!password || !newUsername) {
      return c.json({ error: 'Password and new username are required' }, 400);
    }

    const normalizedUsername = newUsername.trim();
    if (!normalizedUsername) {
      return c.json({ error: 'New username cannot be empty' }, 400);
    }

    if (normalizedUsername === username) {
      return c.json({ success: true, username: normalizedUsername });
    }

    const existingUser = await kv.get(`user:${normalizedUsername}`);
    if (existingUser) {
      return c.json({ error: 'Username already exists' }, 409);
    }

    const user = await kv.get(`user:${username}`);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const passwordHash = await hashPassword(password);
    if (passwordHash !== user.passwordHash) {
      return c.json({ error: 'Incorrect password' }, 400);
    }

    user.username = normalizedUsername;

    await kv.set(`user:${normalizedUsername}`, user);
    await movePrefixedData(`doc:${username}:`, `doc:${normalizedUsername}:`);
    await movePrefixedData(`chat:${username}:`, `chat:${normalizedUsername}:`);
    await movePrefixedData(`feedback:${username}:`, `feedback:${normalizedUsername}:`);

    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const session = await kv.get(`session:${token}`);
      if (session) {
        session.username = normalizedUsername;
        await kv.set(`session:${token}`, session);
      }
    }

    await kv.del(`user:${username}`);

    console.log(`Username updated: ${username} -> ${normalizedUsername}`);
    return c.json({ success: true, username: normalizedUsername });
  } catch (error) {
    console.error('Error updating username:', error);
    return c.json({ error: `Failed to update username: ${getErrorMessage(error)}` }, 500);
  }
});

app.get("/make-server-8b373356/auth/model-config", async (c: Context) => {
  try {
    const username = await getUserFromToken(c);
    if (!username) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const user = await kv.get(`user:${username}`);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      success: true,
      config: getSafeModelConfig(user),
    });
  } catch (error) {
    console.error('Error getting model config:', error);
    return c.json({ error: `Failed to get model config: ${getErrorMessage(error)}` }, 500);
  }
});

app.post("/make-server-8b373356/auth/model-config", async (c: Context) => {
  try {
    const username = await getUserFromToken(c);
    if (!username) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { modelId, apiKey } = await c.req.json();
    if (!modelId || !apiKey) {
      return c.json({ error: 'Model ID and API Key are required' }, 400);
    }

    const user = await kv.get(`user:${username}`);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    user.modelConfig = {
      modelId: modelId.trim(),
      apiKey: apiKey.trim(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`user:${username}`, user);

    return c.json({
      success: true,
      config: getSafeModelConfig(user),
    });
  } catch (error) {
    console.error('Error updating model config:', error);
    return c.json({ error: `Failed to update model config: ${getErrorMessage(error)}` }, 500);
  }
});

// Delete Account
app.post("/make-server-8b373356/auth/delete-account", async (c: Context) => {
  try {
    const username = await getUserFromToken(c);
    if (!username) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { password } = await c.req.json();
    if (!password) {
      return c.json({ error: 'Password is required' }, 400);
    }

    const user = await kv.get(`user:${username}`);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Verify password
    const passwordHash = await hashPassword(password);
    if (passwordHash !== user.passwordHash) {
      return c.json({ error: 'Incorrect password' }, 401);
    }

    // 1. Delete User Record
    await kv.del(`user:${username}`);

    // 2. Delete Current Session (and potentially others if we tracked them, but here we just invalidate this one via logic)
    // Note: We can't easily find all sessions for a user with the current KV structure (session:{token}), 
    // but without the user record, `getUserFromToken` might still work if it only checks session expiration? 
    // Wait, `getUserFromToken` checks `session:{token}`. 
    // To properly logout everywhere, we might need to rely on the fact that if we delete the user, 
    // subsequent operations might fail if they check for user existence. 
    // However, let's at least delete the current session.
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      await kv.del(`session:${token}`);
    }

    // 3. Delete Document Metadata (Optional - for cleanup)
    // We can list all docs and delete them.
    const docs = await kv.getByPrefix(`doc:${username}:`);
    if (docs && docs.length > 0) {
      const docKeys = docs.map(d => `doc:${username}:${d.id}`);
      await kv.mdel(docKeys);

      // We could also delete from Supabase Storage here if we want to be thorough
      // but that might take time. For now, let's just remove metadata visibility.
    }

    // 4. Delete Chat Logs (Optional)
    const chatLogs = await kv.getByPrefix(`chat:${username}:`);
    if (chatLogs && chatLogs.length > 0) {
      const chatKeys = chatLogs.map(l => `chat:${username}:${l.id}`);
      await kv.mdel(chatKeys);
    }

    console.log(`Account deleted for user: ${username}`);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    return c.json({ error: `Failed to delete account: ${getErrorMessage(error)}` }, 500);
  }
});

app.post("/make-server-8b373356/knowledge/upload", async (c: Context) => {
  try {
    const username = await getUserFromToken(c);
    if (!username) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      return c.json({ error: 'File size exceeds 50MB limit' }, 400);
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/markdown',
      'text/plain',
    ];

    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.md')) {
      return c.json({ error: 'Invalid file type. Only PDF, DOC, DOCX, MD, and TXT are allowed' }, 400);
    }

    // Generate unique file path
    const fileId = crypto.randomUUID();
    const fileExt = file.name.split('.').pop();
    const storagePath = `${fileId}.${fileExt}`;

    // Upload file to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return c.json({ error: `Upload failed: ${uploadError.message}` }, 500);
    }

    // Get signed URL (valid for 10 years for knowledge base access)
    const { data: signedUrlData } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, 315360000); // 10 years

    // Store document metadata in kv_store
    const docMetadata = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: fileExt || 'unknown',
      uploadDate: new Date().toISOString(),
      storagePath,
      signedUrl: signedUrlData?.signedUrl,
    };

    await kv.set(`doc:${username}:${fileId}`, docMetadata);
    console.log(`Document uploaded successfully: ${file.name}`);
    return c.json({ success: true, document: docMetadata });
  } catch (error) {
    console.error('Error uploading document:', error);
    return c.json({ error: `Upload failed: ${getErrorMessage(error)}` }, 500);
  }
});

// Add online document link
app.post("/make-server-8b373356/knowledge/add-link", async (c: Context) => {
  try {
    const username = await getUserFromToken(c);
    if (!username) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { name, url } = await c.req.json();

    if (!name || !url) {
      return c.json({ error: 'Name and URL are required' }, 400);
    }

    console.log(`Adding link: ${name}, URL: ${url}`);

    // Generate unique id
    const id = crypto.randomUUID();
    let storagePath = null;
    let signedUrl = url;
    let size = 0;

    // 1. Try to fetch content from the URL
    try {
      console.log(`Fetching content from: ${url}`);
      const linkRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AI-Assistant/1.0; +http://example.com)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });

      if (linkRes.ok) {
        let textContent = '';
        const contentType = linkRes.headers.get('content-type') || '';

        if (contentType.includes('text/html')) {
          const html = await linkRes.text();
          // Simple regex-based HTML to text conversion (since DOMParser might be missing)
          // Remove scripts and styles
          let cleanHtml = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, "");
          cleanHtml = cleanHtml.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, "");
          // Extract body content if possible
          const bodyMatch = cleanHtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
          const contentToProcess = bodyMatch ? bodyMatch[1] : cleanHtml;
          // Remove tags
          textContent = contentToProcess.replace(/<[^>]+>/g, '\n');
          // Decode entities (very basic)
          textContent = textContent.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        } else {
          textContent = await linkRes.text();
        }

        // Clean up whitespace
        textContent = textContent.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n\n');

        // Add metadata header
        const mdContent = `# ${name}\n\nURL: ${url}\n\n---\n\n${textContent}`;

        // 2. Upload as a .md file
        const fileName = `${id}.md`;
        const file = new File([mdContent], fileName, { type: 'text/markdown' });

        const arrayBuffer = await file.arrayBuffer();
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(fileName, arrayBuffer, {
            contentType: 'text/markdown',
            upsert: false,
          });

        if (!uploadError) {
          storagePath = fileName;
          // Get signed URL for the saved file
          const { data: signedUrlData } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(fileName, 315360000);

          if (signedUrlData?.signedUrl) {
            signedUrl = signedUrlData.signedUrl;
          }
          size = file.size;
          console.log(`Link content saved as ${fileName}, size: ${size}`);
        } else {
          console.error('Failed to save link content:', uploadError);
        }
      }
    } catch (fetchErr) {
      console.error('Error fetching link content:', fetchErr);
      // Continue to add as a simple link if fetch fails
    }

    // Store document metadata in kv_store
    const docMetadata = {
      id,
      name,
      size: size || 'Link',
      type: storagePath ? 'md' : 'link', // Treat as md if we saved content
      uploadDate: new Date().toISOString(),
      signedUrl: signedUrl,
      storagePath: storagePath,
      originalUrl: url,
      isLink: true
    };

    await kv.set(`doc:${username}:${id}`, docMetadata);

    console.log(`Link added successfully: ${name}`);
    return c.json({ success: true, document: docMetadata });
  } catch (error) {
    console.error('Error adding link:', error);
    return c.json({ error: `Failed to add link: ${getErrorMessage(error)}` }, 500);
  }
});

// List all documents
app.get("/make-server-8b373356/knowledge/list", async (c: Context) => {
  try {
    const username = await getUserFromToken(c);
    if (!username) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log('=== LIST DOCUMENTS START ===');
    const docs = await kv.getByPrefix(`doc:${username}:`);
    console.log('Raw docs from kv.getByPrefix:', JSON.stringify(docs, null, 2));
    console.log('Docs length:', docs?.length);

    // kv.getByPrefix returns an array of values directly, not {key, value} objects
    const documents = docs
      .filter(d => {
        const isValid = d && d.id;
        if (!isValid) {
          console.log('Filtering out invalid doc:', d);
        }
        return isValid;
      });

    // Optimization: We don't need to refresh signed URLs on every list request
    // The signed URLs are generated with 10-year expiration on upload

    console.log(`Listed ${documents.length} valid documents`);
    console.log('Final documents:', JSON.stringify(documents, null, 2));
    console.log('=== LIST DOCUMENTS END ===');
    return c.json({ success: true, documents });
  } catch (error) {
    console.error('Error listing documents:', error);
    return c.json({ error: `Failed to list documents: ${getErrorMessage(error)}` }, 500);
  }
});

// Delete document
app.delete("/make-server-8b373356/knowledge/delete/:id", async (c: Context) => {
  try {
    const username = await getUserFromToken(c);
    if (!username) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const docId = c.req.param('id');

    // Get document metadata
    const docData = await kv.get(`doc:${username}:${docId}`);

    if (!docData) {
      console.log(`Document ${docId} not found, assuming already deleted`);
      return c.json({ success: true });
    }

    // Delete from storage
    if (docData.storagePath) {
      try {
        const { error: deleteError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([docData.storagePath]);

        if (deleteError) {
          console.error('Storage delete error:', deleteError);
        }
      } catch (storageErr) {
        console.error('Unexpected error during storage deletion:', storageErr);
      }
    }

    // Delete metadata from kv_store
    await kv.del(`doc:${username}:${docId}`);

    console.log(`Document deleted successfully: ${docId}`);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    return c.json({ error: `Failed to delete document: ${getErrorMessage(error)}` }, 500);
  }
});

// Batch delete documents
app.post("/make-server-8b373356/knowledge/batch-delete", async (c: Context) => {
  try {
    const username = await getUserFromToken(c);
    if (!username) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { ids } = await c.req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json({ error: 'Invalid or empty ids array' }, 400);
    }

    const storagePaths: string[] = [];

    // Parallel fetch all documents to collect storage paths
    const docFetchResults = await Promise.all(
      ids.map(async (docId: string) => {
        const docData = await kv.get(`doc:${username}:${docId}`);
        return { docId, docData };
      })
    );

    const results = docFetchResults.map(({ docId, docData }) => {
      if (docData) {
        if (docData.storagePath) {
          storagePaths.push(docData.storagePath);
        }
        return { id: docId, success: true };
      } else {
        return { id: docId, success: false, error: 'Not found' };
      }
    });

    // Delete from storage in batch
    if (storagePaths.length > 0) {
      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(storagePaths);

      if (deleteError) {
        console.error('Batch storage delete error:', deleteError);
      }
    }

    // Delete metadata from kv_store
    await kv.mdel(ids.map(id => `doc:${username}:${id}`));

    console.log(`Batch deleted ${ids.length} documents`);
    return c.json({ success: true, results });
  } catch (error) {
    console.error('Error batch deleting documents:', error);
    return c.json({ error: `Failed to batch delete: ${getErrorMessage(error)}` }, 500);
  }
});

// Submit message feedback
app.post("/make-server-8b373356/chat/feedback", async (c: Context) => {
  try {
    const username = await getUserFromToken(c);
    if (!username) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { messageId, type, reason } = await c.req.json();

    if (!messageId || !type) {
      return c.json({ error: 'MessageId and type are required' }, 400);
    }

    if (type !== 'like' && type !== 'dislike') {
      return c.json({ error: 'Invalid feedback type' }, 400);
    }

    const feedbackData = {
      messageId,
      type,
      reason: reason || '',
      timestamp: new Date().toISOString()
    };

    // Store feedback in KV store
    await kv.set(`feedback:${username}:${messageId}`, feedbackData);

    console.log(`Feedback received for ${messageId}: ${type}`);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return c.json({ error: `Failed to submit feedback: ${getErrorMessage(error)}` }, 500);
  }
});

// Get analytics data
app.get("/make-server-8b373356/analytics/data", async (c: Context) => {
  try {
    const username = await getUserFromToken(c);
    if (!username) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Fetch all chat logs and feedback
    const chatLogs = await kv.getByPrefix(`chat:${username}:`);
    const feedbackLogs = await kv.getByPrefix(`feedback:${username}:`);

    // Create a map of feedback for faster lookup
    const feedbackMap = new Map();
    feedbackLogs.forEach(fb => {
      if (fb && fb.messageId) {
        feedbackMap.set(fb.messageId, fb);
      }
    });

    // Process logs to include feedback
    const logs = chatLogs
      .filter(log => log && log.id) // Filter valid logs
      .map(log => ({
        ...log,
        feedback: feedbackMap.get(log.id) || null
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calculate stats
    const stats = {
      totalQuestions: logs.length,
      totalAnswers: logs.length, // One answer per question in this model
      totalLikes: 0,
      totalDislikes: 0
    };

    logs.forEach(log => {
      if (log.feedback) {
        if (log.feedback.type === 'like') stats.totalLikes++;
        if (log.feedback.type === 'dislike') stats.totalDislikes++;
      }
    });

    return c.json({
      success: true,
      stats,
      logs
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return c.json({ error: `Failed to fetch analytics: ${getErrorMessage(error)}` }, 500);
  }
});

// Chat with AI (Doubao integration)
app.post("/make-server-8b373356/chat/send", async (c: Context) => {
  // Declare variables outside try block to avoid scope issues in catch
  let message = '';
  let image = '';

  try {
    const username = await getUserFromToken(c);
    if (!username) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    message = body.message || '';
    image = body.image || '';

    console.log('Received chat request:', { hasMessage: !!message, hasImage: !!image });

    if (!message && !image) {
      return c.json({ error: 'Message or image required' }, 400);
    }

    // Get documents from cache or KV with timeout
    // Get documents from cache or KV with timeout
    let contextDocs = [];
    try {
      const cached = userDocsCache.get(username);
      if (cached && (Date.now() - cached.timestamp < DOCS_CACHE_TTL)) {
        contextDocs = cached.data;
        console.log(`Using cached docs list for ${username}`);
      } else {
        // Create a timeout promise for document fetching
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 800)); // 800ms timeout
        const fetchPromise = kv.getByPrefix(`doc:${username}:`).catch(err => {
          console.error('Background doc fetch error:', err);
          return null;
        });

        const docs = await Promise.race([fetchPromise, timeoutPromise]) as any[];

        if (docs) {
          const validDocs = docs.filter(d => d && d.name);
          // Sort by upload date desc if possible, or just take first 20
          contextDocs = validDocs.slice(0, 20);
          userDocsCache.set(username, { data: contextDocs, timestamp: Date.now() });
          console.log(`Fetched and cached ${contextDocs.length} docs for ${username}`);
        } else {
          console.log('Docs fetch timed out or failed, proceeding without context');
          if (cached) {
            contextDocs = cached.data;
            console.log('Using stale cache due to timeout');
          }
        }
      }
    } catch (e) {
      console.error('Error fetching docs context:', e);
    }

    // Fetch MD document contents for context
    let knowledgeBaseContext = '';
    if (contextDocs.length > 0) {
      // Filter for MD files, TXT files, or Links
      const mdDocs = contextDocs.filter(d =>
        d.type?.toLowerCase() === 'md' ||
        d.type?.toLowerCase() === 'txt' ||
        d.type?.toLowerCase() === 'link'
      );

      if (mdDocs.length > 0) {
        // Improved Relevance Scoring
        const keywords = message.toLowerCase().split(/\s+/).filter(k => k.length > 1);
        if (keywords.length > 0) {
          mdDocs.sort((a, b) => {
            let scoreA = 0;
            let scoreB = 0;
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();

            keywords.forEach(k => {
              // Exact match gets 3 points
              if (nameA === k) scoreA += 3;
              if (nameB === k) scoreB += 3;

              // Contains match gets 1 point
              if (nameA.includes(k)) scoreA += 1;
              if (nameB.includes(k)) scoreB += 1;
            });

            // Primary sort by score (desc), Secondary by date (desc)
            if (scoreA !== scoreB) return scoreB - scoreA;
            return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
          });
        }

        const docsToFetch = mdDocs.slice(0, 10); // Pick top 10 most relevant
        console.log(`Fetching contents for ${docsToFetch.length} documents...`);

        // Parallel Fetching
        const fetchPromises = docsToFetch.map(async (doc) => {
          try {
            if (doc.signedUrl) {
              const response = await fetch(doc.signedUrl);
              if (response.ok) {
                let content = await response.text();

                // If it's a link or HTML content, clean it up
                const contentType = response.headers.get('content-type') || '';
                if (doc.type === 'link' || contentType.includes('text/html')) {
                  // Remove scripts and styles
                  content = content.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, "");
                  content = content.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, "");
                  // Remove comments
                  content = content.replace(/<!--[\s\S]*?-->/g, "");
                  // Replace tags with newlines
                  content = content.replace(/<[^>]+>/g, '\n');
                  // Clean up multiple newlines and spaces
                  content = content.replace(/\n\s*\n/g, '\n\n').trim();
                }

                // Limit content length to 5000 characters
                const truncatedContent = content.length > 5000
                  ? content.substring(0, 5000) + '\n...(内容已截断)'
                  : content;
                return `### ${doc.name}\n${truncatedContent}`;
              }
            }
          } catch (err) {
            console.error(`Error fetching content for ${doc.name}:`, err);
          }
          return null;
        });

        const results = await Promise.all(fetchPromises);
        const validContents = results.filter(c => c !== null);

        if (validContents.length > 0) {
          knowledgeBaseContext = `\n\n知识库文档内容 (${validContents.length}篇):\n${validContents.join('\n\n---\n\n')}`;
          console.log(`Successfully loaded context from ${validContents.length} documents`);
        } else {
          knowledgeBaseContext = `\n\n可用文档列表:\n${contextDocs.map(d => `- ${d.name}`).join('\n')}`;
        }
      } else {
        knowledgeBaseContext = `\n\n可用文档列表:\n${contextDocs.map(d => `- ${d.name}`).join('\n')}`;
      }
    }

    // Prepare enhanced system prompt
    const systemPrompt = `你是小鸣同学，一个通用的智能助手。你的任务是为用户提供有帮助的回答。

请遵循以下规则：
1. **优先回答用户的通用问题**，展现你的博学和多才多艺。
2. 同时参考提供的【知识库文档】（如果有）。如果文档内容与用户问题相关，请结合文档进行回答。
3. 如果用户问题与知识库无关，请直接基于你的通用知识进行回答，**不要**受限于知识库。
4. 回答要自然、流畅、专业。
${image ? '5. 你具备视觉分析能力，请仔细分析用户上传的图片内容并结合上下文回答问题' : ''}

当前可参考的知识库片段（仅供参考，非必须）：
${knowledgeBaseContext}`;

    const user = await kv.get(`user:${username}`);
    const modelConfig = getSafeModelConfig(user);

    if (!modelConfig) {
      return c.json({
        success: true,
        response: "请先通过账号设置配置模型信息哦～～",
        fallback: true,
        error: 'Model config missing'
      });
    }
    const { apiKey: doubaoApiKey, modelId: modelToUse } = modelConfig;

    // Prepare messages
    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          ...(message ? [{ type: 'text', text: message }] : []),
          ...(image ? [{ type: 'image_url', image_url: { url: image } }] : [])
        ]
      }
    ];

    console.log(`Starting stream with model: ${modelToUse}`);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const sendSSE = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        let fullContent = "";
        const chatLogId = crypto.randomUUID();

        try {
          const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${doubaoApiKey}`,
            },
            body: JSON.stringify({
              model: modelToUse,
              messages: messages,
              stream: true,
              temperature: 0.3
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Doubao API Error:', errorText);
            if (isModelConfigProviderError(response.status)) {
              const chatLog = {
                id: chatLogId,
                question: message || (image ? '发送了一张图片' : ''),
                answer: '请先通过账号设置配置模型信息哦～～',
                timestamp: new Date().toISOString(),
                hasImage: !!image,
                error: `Model config invalid: ${response.status}`
              };
              await kv.set(`chat:${username}:${chatLogId}`, chatLog);
              sendSSE({
                content: '请先通过账号设置配置模型信息哦～～',
                done: true,
                id: chatLogId,
                modelConfigRequired: true
              });
              controller.close();
              return;
            }
            throw new Error(`Doubao API Error: ${response.status}`);
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error('No response body');

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === 'data: [DONE]') continue;

              if (trimmed.startsWith('data: ')) {
                try {
                  const data = JSON.parse(trimmed.slice(6));
                  const content = data.choices?.[0]?.delta?.content || '';
                  if (content) {
                    fullContent += content;
                    sendSSE({ content });
                  }
                } catch (e) {
                  // Ignore
                }
              }
            }
          }

          // Save to KV Store
          const chatLog = {
            id: chatLogId,
            question: message || (image ? '发送了一张图片' : ''),
            answer: fullContent,
            timestamp: new Date().toISOString(),
            hasImage: !!image
          };

          await kv.set(`chat:${username}:${chatLogId}`, chatLog);
          console.log(`Stored chat log: ${chatLogId}`);

          sendSSE({ done: true, id: chatLogId });
          controller.close();

        } catch (error) {
          console.error('Stream processing error:', error);
          if (fullContent) {
            const chatLog = {
              id: chatLogId,
              question: message || (image ? '发送了一张图片' : ''),
              answer: fullContent,
              timestamp: new Date().toISOString(),
              hasImage: !!image,
              error: getErrorMessage(error)
            };
            await kv.set(`chat:${username}:${chatLogId}`, chatLog);
          }
          sendSSE({ error: getErrorMessage(error) });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch (error) {
    console.error('Error in chat endpoint:', error);
    // Fallback to simple error message for outer errors
    return c.json({
      success: true,
      response: "抱歉，我现在遇到了一些连接问题，请稍后再试。",
      fallback: true,
      error: getErrorMessage(error)
    });
  }
});



Deno.serve(app.fetch);
