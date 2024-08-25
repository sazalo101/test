const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Configure multer for file uploads
const upload = multer({ dest: uploadsDir });

// Route to handle file upload
app.post('/upload', upload.single('resume'), async (req, res) => {
  try {
    const jobDescription = req.body.jobDescription;
    const filePath = path.join(__dirname, req.file.path);

    // Extract text from the uploaded PDF resume
    const resumeText = await extractTextFromPDF(filePath);

    // Analyze the resume against the job description
    const analysisResult = await analyzeResume(resumeText, jobDescription);

    // Clean up the uploaded file
    fs.unlinkSync(filePath);

    // Generate email template based on match result
    let emailSubject, emailBody;

    if (analysisResult.match === 'matches') {
      emailSubject = 'Your Resume Matches the Job Description!';
      emailBody = `Dear Candidate,\n\nWe are pleased to inform you that your resume matches the job description with a score of ${analysisResult.percentage}. \n\nPlease use the following link to schedule an interview: [Calendly Link]\n\nBest regards,\n[Your Company Name]`;
    } else {
      emailSubject = 'Resume Analysis Result';
      emailBody = `Dear Candidate,\n\nUnfortunately, your resume did not meet the job description criteria with a score of ${analysisResult.percentage}. \n\nPlease review and improve your resume.\n\nBest regards,\n[Your Company Name]`;
    }

    // Send the generated email template as a JSON response
    res.json({ emailSubject, emailBody });
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: 'Error processing file' });
  }
});

// Function to parse PDF and extract text
const extractTextFromPDF = async (filePath) => {
  const data = await fs.promises.readFile(filePath);
  const pdfData = await pdf(data);
  return pdfData.text;
};

// Function to analyze resume and job description
const analyzeResume = async (resumeText, jobDescription) => {
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant that evaluates resumes against job descriptions.'
      },
      {
        role: 'user',
        content: `Evaluate the following resume against the job description provided. Indicate if it matches and provide a percentage score. Resume: ${resumeText}, Job Description: ${jobDescription}`
      }
    ]
  });

  const content = completion.choices[0].message.content;

  // Extract percentage match from the response
  const matchPercentage = content.match(/\d+%/g) ? content.match(/\d+%/g)[0] : 'N/A';

  // Determine if the resume matches based on the content
  const matches = content.toLowerCase().includes('matches') ? 'matches' : 'does not match';

  return { percentage: matchPercentage, match: matches };
};

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
