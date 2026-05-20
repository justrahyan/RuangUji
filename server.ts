import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { generateDefenseQuestionAI, evaluateDefenseAnswerAI, generateFinalEvaluationAI } from './server/aiProvider.js';
import { generateQuestion, evaluateAnswer, generateFinalEvaluation } from './src/lib/localEngine.js';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/ai/question', async (req, res) => {
  try {
    const data = await generateDefenseQuestionAI(req.body);
    res.json(data);
  } catch (error: any) {
    console.error('AI Question Error:', error.message);
    const localQuestion = generateQuestion(
      req.body.research,
      req.body.examinerMode,
      req.body.questionIndex,
      req.body.previousQuestions
    );
    res.json({
      question: localQuestion,
      category: "fallback",
      reason: `AI Provider Error: ${error.message}`,
      provider: "local-fallback"
    });
  }
});

app.post('/api/ai/evaluate', async (req, res) => {
  try {
    const data = await evaluateDefenseAnswerAI(req.body);
    res.json(data);
  } catch (error: any) {
    console.error('AI Evaluate Error:', error.message);
    const localEval = evaluateAnswer(
      req.body.question,
      req.body.answer,
      req.body.research,
      req.body.examinerMode
    );
    res.json({
      ...localEval,
      provider: "local-fallback",
      reason: `AI Provider Error: ${error.message}`
    });
  }
});

app.post('/api/ai/final-evaluation', async (req, res) => {
  try {
    const data = await generateFinalEvaluationAI(req.body);
    res.json(data);
  } catch (error: any) {
    console.error('AI Final Eval Error:', error.message);
    const localFinal = generateFinalEvaluation({
      research: req.body.research,
      transcript: req.body.transcript
    } as any);
    res.json({
      ...localFinal,
      provider: "local-fallback",
      reason: `AI Provider Error: ${error.message}`
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
