import { HashRouter, Routes, Route } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import Home from "./pages/Home";
import WordStudy from "./pages/WordStudy";
import GrammarStudy from "./pages/GrammarStudy";
import Review from "./pages/Review";
import ProgressPage from "./pages/Progress";
import { useAppData } from "./lib/useAppData";

function App() {
  const { data, recordAnswer, toggleBookmark } = useAppData();

  return (
    <HashRouter>
      <div className="min-h-screen bg-(--color-paper)">
        <Routes>
          <Route path="/" element={<Home data={data} />} />
          <Route
            path="/words"
            element={
              <WordStudy
                data={data}
                onAnswer={recordAnswer}
                onToggleBookmark={toggleBookmark}
              />
            }
          />
          <Route
            path="/grammar"
            element={
              <GrammarStudy
                data={data}
                onAnswer={recordAnswer}
                onToggleBookmark={toggleBookmark}
              />
            }
          />
          <Route path="/review" element={<Review data={data} />} />
          <Route path="/progress" element={<ProgressPage data={data} />} />
        </Routes>
        <BottomNav />
      </div>
    </HashRouter>
  );
}

export default App;
