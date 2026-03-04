// ==========================================
// AUTHENTICATION ROUTES
// Handles login, signup, and session management
// ==========================================

const express = require('express');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const router = express.Router();
const excel = require('./excel');

// ==========================================
// EMAIL CONFIGURATION
// ==========================================
// Using ethereal.email for mock Testing
const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
        user: 'marta.mccullough21@ethereal.email',
        pass: 'E2T5yV7q1Gg5UYZw4X'
    }
});

// In-memory store for password reset codes (email -> { code, expiration })
const resetCodes = {};

const sendWelcomeEmail = async (userEmail, userName) => {
    try {
        const info = await transporter.sendMail({
            from: '"TrackMyExpenses Team" <welcome@trackmyexpenses.com>',
            to: userEmail,
            subject: 'Welcome to TrackMyExpenses!',
            html: `
                <div style="font-family: Arial, sans-serif; text-align: center; color: #333;">
                    <h2 style="color: #2d8659;">Welcome to TrackMyExpenses, ${userName}! 🎉</h2>
                    <p>We're thrilled to have you on board. Start tracking your expenses and take control of your financial journey today.</p>
                    <p>Log in now to explore your smart dashboard, AI insights, and category budgets!</p>
                    <br/>
                    <p>Best regards,<br/>The TrackMyExpenses Team</p>
                </div>
            `
        });
        console.log('Welcome email sent. Preview URL: %s', nodemailer.getTestMessageUrl(info));
    } catch (error) {
        console.error('Error sending welcome email:', error);
    }
};

const sendPasswordResetEmail = async (userEmail, resetCode) => {
    try {
        const info = await transporter.sendMail({
            from: '"TrackMyExpenses Team" <noreply@trackmyexpenses.com>',
            to: userEmail,
            subject: 'Password Reset - TrackMyExpenses',
            html: `
                <div style="font-family: Arial, sans-serif; text-align: center; color: #333;">
                    <h2 style="color: #2d8659;">Reset Your Password</h2>
                    <p>We received a request to reset your password. Use the code below to proceed:</p>
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="color: #2d8659; font-family: monospace; letter-spacing: 5px;">${resetCode}</h3>
                    </div>
                    <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
                    <p>If you didn't request a password reset, please ignore this email.</p>
                    <br/>
                    <p>Best regards,<br/>The TrackMyExpenses Team</p>
                </div>
            `
        });
        console.log('Password reset email sent. Preview URL: %s', nodemailer.getTestMessageUrl(info));
        return true;
    } catch (error) {
        console.error('Error sending password reset email:', error);
        return false;
    }
};

// ==========================================
// MULTER CONFIGURATION FOR FILE UPLOADS
// ==========================================

const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif|svg/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// ==========================================
// SIGNUP ROUTE
// ==========================================

router.post('/signup', async (req, res) => {
    try {
        const { fullName, email, password } = req.body;

        // Validation
        if (!fullName || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if user already exists
        const existingUser = excel.getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const newUser = excel.addUser({
            fullName,
            email,
            password: hashedPassword,
            role: 'user'
        });

        // Send Welcome Email asynchronously
        sendWelcomeEmail(email, fullName);

        res.status(201).json({
            message: 'Account created successfully',
            user: {
                id: newUser.ID,
                fullName: newUser['Full Name'],
                email: newUser.Email,
                role: newUser.Role
            }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Error creating account' });
    }
});

// ==========================================
// LOGIN ROUTE
// ==========================================

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Find user
        let user = excel.getUserByEmail(email);
        // support new demo admin even when original file still contains old email
        if (!user && email === 'sidhi@admin.com') {
            // create a temporary user object matching seeded data
            user = {
                ID: '2',
                'Full Name': 'Admin User',
                Email: 'sidhi@admin.com',
                Password: '$2b$10$On5YEi3yY4E./oHOE/2edu3XvbVbXdwHRw3xQ6p3Gm1D8pZE8VeNK',
                Role: 'admin',
                Budget: '100000'
            };
        }
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // For demo accounts, allow simple password or bcrypt
        let isValidPassword = false;

        // Check if it's a demo account with simple password
        if ((email === 'user@demo.com' && password === 'user123') ||
            (email === 'sidhi@admin.com' && password === 'sidhi5213d')) {
            isValidPassword = true;
        } else {
            // Compare hashed password
            isValidPassword = await bcrypt.compare(password, user.Password);
        }

        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Set session
        req.session.userId = user.ID;
        req.session.userRole = user.Role;

        res.json({
            message: 'Login successful',
            user: {
                id: user.ID,
                fullName: user['Full Name'],
                email: user.Email,
                role: user.Role,
                budget: user.Budget
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Error logging in' });
    }
});

// ==========================================
// GOOGLE OAUTH ROUTES (MOCK)
// ==========================================

router.post('/login/google', async (req, res) => {
    try {
        const { email, fullName } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Google email required' });
        }

        const user = excel.getUserByEmail(email);

        // CRITICAL: Reject if user doesn't exist
        if (!user) {
            return res.status(401).json({ message: 'Account not found. Please sign up first.' });
        }

        req.session.userId = user.ID;
        req.session.userRole = user.Role;

        res.json({
            message: 'Google login successful',
            user: {
                id: user.ID,
                fullName: user['Full Name'],
                email: user.Email,
                role: user.Role,
                budget: user.Budget
            }
        });
    } catch (error) {
        console.error('Google login error:', error);
        res.status(500).json({ message: 'Error logging in with Google' });
    }
});

router.post('/signup/google', async (req, res) => {
    try {
        const { email, fullName } = req.body;

        if (!email || !fullName) {
            return res.status(400).json({ message: 'Google account details required' });
        }

        const existingUser = excel.getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered. Please log in.' });
        }

        // Create user with a dummy complex password since it's an OAuth user
        const dummyPassword = await bcrypt.hash(Date.now().toString() + Math.random().toString(), 10);

        const newUser = excel.addUser({
            fullName,
            email,
            password: dummyPassword,
            role: 'user'
        });

        // Send Welcome Email
        sendWelcomeEmail(email, fullName);

        res.status(201).json({
            message: 'Google account created successfully',
            user: {
                id: newUser.ID,
                fullName: newUser['Full Name'],
                email: newUser.Email,
                role: newUser.Role
            }
        });
    } catch (error) {
        console.error('Google signup error:', error);
        res.status(500).json({ message: 'Error creating Google account' });
    }
});

// ==========================================
// LOGOUT ROUTE
// ==========================================

router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Error logging out' });
        }
        res.json({ message: 'Logged out successfully' });
    });
});

// ==========================================
// BRANDING ROUTE
// ==========================================

router.get('/branding', (req, res) => {
    try {
        // In a real app, this would get user-specific branding
        // For now, return default or first user's branding
        const users = excel.readUsers();
        const user = users.find(u => u['Custom Logo'] || u['Custom Title']);

        let logoPath = '/images/logo.png';
        let title = 'TrackMyExpenses';

        if (user) {
            if (user['Custom Title']) {
                title = user['Custom Title'];
            }

            if (user['Custom Logo']) {
                // Only use custom logo if the file actually exists
                const relativeLogoPath = user['Custom Logo'].startsWith('/')
                    ? user['Custom Logo'].substring(1)
                    : user['Custom Logo'];
                const absoluteLogoPath = path.join(__dirname, '../public', relativeLogoPath);

                if (fs.existsSync(absoluteLogoPath)) {
                    logoPath = user['Custom Logo'];
                }
            }
        }

        res.json({ logo: logoPath, title });
    } catch (error) {
        res.json({
            logo: '/images/logo.png',
            title: 'TrackMyExpenses'
        });
    }
});

// ==========================================
// UPDATE BRANDING (ADMIN ONLY)
// ==========================================

router.post('/branding', upload.single('logo'), (req, res) => {
    try {
        // Check if user is admin
        if (req.session.userRole !== 'admin') {
            return res.status(403).json({ message: 'Only administrators can update branding' });
        }

        const { userId, title } = req.body;
        const updateData = {};

        if (req.file) {
            updateData['Custom Logo'] = '/uploads/' + req.file.filename;
        }

        if (title) {
            updateData['Custom Title'] = title;
        }

        const updatedUser = excel.updateUser(userId, updateData);

        if (updatedUser) {
            res.json({
                message: 'Branding updated successfully',
                logo: updatedUser['Custom Logo'],
                title: updatedUser['Custom Title']
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Branding update error:', error);
        res.status(500).json({ message: 'Error updating branding' });
    }
});

// ==========================================
// GET USER PROFILE
// ==========================================

router.get('/profile/:userId', (req, res) => {
    try {
        const user = excel.getUserById(req.params.userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            id: user.ID,
            fullName: user['Full Name'],
            email: user.Email,
            role: user.Role,
            budget: user.Budget,
            customLogo: user['Custom Logo'],
            customTitle: user['Custom Title'],
            createdAt: user['Created At']
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ message: 'Error fetching profile' });
    }
});

// ==========================================
// UPDATE USER PROFILE
// ==========================================

router.put('/profile/:userId', (req, res) => {
    try {
        // Users can only update their own profile, admins can update any profile
        if (req.session.userId !== req.params.userId && req.session.userRole !== 'admin') {
            return res.status(403).json({ message: 'You can only update your own profile' });
        }

        const { fullName, budget } = req.body;
        const updateData = {};

        if (fullName) updateData['Full Name'] = fullName;
        if (budget) updateData['Budget'] = budget;

        const updatedUser = excel.updateUser(req.params.userId, updateData);

        if (updatedUser) {
            res.json({
                message: 'Profile updated successfully',
                user: {
                    id: updatedUser.ID,
                    fullName: updatedUser['Full Name'],
                    email: updatedUser.Email,
                    budget: updatedUser.Budget
                }
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ message: 'Error updating profile' });
    }
});

// ==========================================
// GOOGLE OAUTH TOKEN VERIFICATION
// ==========================================
// Helper function to decode JWT token (basic implementation)
function decodeGoogleToken(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        return decoded;
    } catch (error) {
        return null;
    }
}

// ==========================================
// FORGOT PASSWORD ROUTES
// ==========================================

// Generate and send password reset code
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        // Validation
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Check if user exists
        const user = excel.getUserByEmail(email);
        if (!user) {
            // Don't reveal if email exists or not (security best practice)
            return res.status(200).json({ message: 'If an account exists with this email, you will receive a password reset code' });
        }

        // Generate 6-digit code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Store code with 10-minute expiration
        const expirationTime = Date.now() + (10 * 60 * 1000); // 10 minutes
        resetCodes[email] = {
            code: resetCode,
            expiration: expirationTime
        };

        // Send email with reset code
        const emailSent = await sendPasswordResetEmail(email, resetCode);

        if (emailSent) {
            res.json({ message: 'Password reset code sent to your email' });
        } else {
            res.status(500).json({ message: 'Error sending reset code. Please try again later.' });
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Error processing forgot password request' });
    }
});

// Verify password reset code
router.post('/verify-code', (req, res) => {
    try {
        const { email, code } = req.body;

        // Validation
        if (!email || !code) {
            return res.status(400).json({ message: 'Email and code are required' });
        }

        // Check if code exists and hasn't expired
        const resetData = resetCodes[email];

        if (!resetData) {
            return res.status(400).json({ message: 'No reset code found. Please request a new one.' });
        }

        if (Date.now() > resetData.expiration) {
            delete resetCodes[email];
            return res.status(400).json({ message: 'Reset code has expired. Please request a new one.' });
        }

        if (resetData.code !== code) {
            return res.status(400).json({ message: 'Invalid reset code' });
        }

        res.json({ message: 'Code verified successfully' });
    } catch (error) {
        console.error('Verify code error:', error);
        res.status(500).json({ message: 'Error verifying code' });
    }
});

// Reset password
router.post('/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        // Validation
        if (!email || !code || !newPassword) {
            return res.status(400).json({ message: 'Email, code, and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        // Check if code is valid and hasn't expired
        const resetData = resetCodes[email];

        if (!resetData) {
            return res.status(400).json({ message: 'No reset code found. Please request a new one.' });
        }

        if (Date.now() > resetData.expiration) {
            delete resetCodes[email];
            return res.status(400).json({ message: 'Reset code has expired. Please request a new one.' });
        }

        if (resetData.code !== code) {
            return res.status(400).json({ message: 'Invalid reset code' });
        }

        // Check if user exists
        const user = excel.getUserByEmail(email);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user password
        const updatedUser = excel.updateUser(user.ID, { Password: hashedPassword });

        if (updatedUser) {
            // Delete the used reset code
            delete resetCodes[email];

            res.json({ message: 'Password reset successfully. Please log in with your new password.' });
        } else {
            res.status(500).json({ message: 'Error updating password' });
        }
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Error resetting password' });
    }
});

// Google OAuth Token Verification

// Google Login with Token
router.post('/login/google-token', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ message: 'Token required' });
        }

        // Decode the JWT token
        const decoded = decodeGoogleToken(token);
        
        if (!decoded || !decoded.email) {
            return res.status(401).json({ message: 'Invalid Google token' });
        }

        const email = decoded.email;
        const fullName = decoded.name || 'Google User';

        // Check if user exists
        const user = excel.getUserByEmail(email);

        if (!user) {
            // Auto-create user on first Google login
            const newUser = excel.addUser({
                fullName,
                email,
                password: await bcrypt.hash(Date.now().toString() + Math.random().toString(), 10),
                role: 'user'
            });

            // Send Welcome Email
            sendWelcomeEmail(email, fullName);

            req.session.userId = newUser.ID;
            req.session.userRole = newUser.Role;

            return res.json({
                message: 'Google login successful - new account created',
                user: {
                    id: newUser.ID,
                    fullName: newUser['Full Name'],
                    email: newUser.Email,
                    role: newUser.Role,
                    budget: newUser.Budget
                }
            });
        }

        // Existing user - login
        req.session.userId = user.ID;
        req.session.userRole = user.Role;

        res.json({
            message: 'Google login successful',
            user: {
                id: user.ID,
                fullName: user['Full Name'],
                email: user.Email,
                role: user.Role,
                budget: user.Budget
            }
        });
    } catch (error) {
        console.error('Google token login error:', error);
        res.status(500).json({ message: 'Error processing Google login' });
    }
});

// Google Signup with Token
router.post('/signup/google-token', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ message: 'Token required' });
        }

        // Decode the JWT token
        const decoded = decodeGoogleToken(token);
        
        if (!decoded || !decoded.email) {
            return res.status(401).json({ message: 'Invalid Google token' });
        }

        const email = decoded.email;
        const fullName = decoded.name || 'Google User';

        // Check if user already exists
        const existingUser = excel.getUserByEmail(email);
        
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered. Please log in.' });
        }

        // Create new user
        const newUser = excel.addUser({
            fullName,
            email,
            password: await bcrypt.hash(Date.now().toString() + Math.random().toString(), 10),
            role: 'user'
        });

        // Send Welcome Email
        sendWelcomeEmail(email, fullName);

        req.session.userId = newUser.ID;
        req.session.userRole = newUser.Role;

        res.json({
            message: 'Google signup successful',
            user: {
                id: newUser.ID,
                fullName: newUser['Full Name'],
                email: newUser.Email,
                role: newUser.Role,
                budget: newUser.Budget
            }
        });
    } catch (error) {
        console.error('Google token signup error:', error);
        res.status(500).json({ message: 'Error processing Google signup' });
    }
});

module.exports = router;
