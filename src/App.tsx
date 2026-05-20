import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SetupPage from './pages/SetupPage';
import DefenseRoomPage from './pages/DefenseRoomPage';
import EvaluationPage from './pages/EvaluationPage';
import QuestionBankPage from './pages/QuestionBankPage';
import HistoryPage from './pages/HistoryPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/defense" element={<DefenseRoomPage />} />
        <Route path="/evaluation" element={<EvaluationPage />} />
        <Route path="/question-bank" element={<QuestionBankPage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
