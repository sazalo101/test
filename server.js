const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const pdf = require('pdf-parse');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // Replace with your actual API key from .env
});

// Initialize Express app
const app = express();
const port = process.env.PORT || 5000; // Use port provided by Render or default to 5000

// Middleware
app.use(bodyParser.json());
app.use(cors()); // Enable CORS

// Ensure 'uploads' directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`Created 'uploads' directory at ${uploadsDir}`);
}

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Route to handle file upload and job description analysis
app.post('/upload', upload.single('resume'), async (req, res) => {
  try {
    const resumePath = req.file.path;
    const jobDescription = req.body.jobDescription;

    // Parse PDF file
    const resumeData = await pdf(fs.readFileSync(resumePath));

    // Construct prompt for OpenAI
    const prompt = `
      Job Description: ${jobDescription}
      Resume Text: ${resumeData.text}
      Determine if the resume matches the job description and provide a match percentage.
    `;

    // Call OpenAI API to analyze the resume against the job description
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
    });

    // Extract match information and percentage
    const matchResult = response.choices[0].message.content;

    // Send back the match result
    res.json({ matchResult });
  } catch (error) {
    console.error('Error processing file:', error.message);
    res.status(500).json({ error: 'Failed to process the file.' });
  } finally {
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
