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
const port = 5000;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Route to handle file upload
app.post('/upload', upload.single('resume'), async (req, res) => {
  try {
    const jobDescription = req.body.jobDescription;
    const filePath = path.join(__dirname, req.file.path);

    const resumeText = await extractTextFromPDF(filePath);
    const analysisResult = await analyzeResume(resumeText, jobDescription);

    fs.unlinkSync(filePath); // Clean up the uploaded file

    let emailSubject, emailBody;

    if (analysisResult.match.includes('matches')) {
      emailSubject = 'Your Resume Matches the Job Description!';
      emailBody = `Dear Candidate,\n\nWe are pleased to inform you that your resume matches the job description with a score of ${analysisResult.percentage}%. \n\nPlease use the following link to schedule an interview: [Calendly Link]\n\nBest regards,\n[Your Company Name]`;
    } else {
      emailSubject = 'Resume Analysis Result';
      emailBody = `Dear Candidate,\n\nUnfortunately, your resume did not meet the job description criteria with a score of ${analysisResult.percentage}%. \n\nPlease review and improve your resume.\n\nBest regards,\n[Your Company Name]`;
    }

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
  // Assuming the response contains a percentage match and a match status
  const matchPercentage = content.match(/\d+%/g) ? content.match(/\d+%/g)[0] : 'N/A';
  const matches = content.toLowerCase().includes('matches');
  return { percentage: matchPercentage, match: matches ? 'matches' : 'does not match' };
};

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
