import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { passcode } = req.body;
    if (!passcode) {
      return res.status(401).json({ error: 'Invalid passcode' });
    }

    const hashedPasscode = process.env.APP_PASSCODE;
    if (!hashedPasscode) {
      console.error('APP_PASSCODE is not set in environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const isMatch = await bcrypt.compare(passcode, hashedPasscode);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid passcode' });
    }

    // sign token for 30 days
    const token = jwt.sign({ sub: 'owner' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    return res.status(200).json({ token });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
