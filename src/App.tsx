import { HashRouter, Routes, Route } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import Home from "./pages/Home";
import WordStudy from "./pages/WordStudy";
import GrammarStudy from "./pages/GrammarStudy";
import ReadingStudy from "./pages/ReadingStudy";
import Review from "./pages/Review";
import ProgressPage from "./pages/Progress";
import PlacementTest from "./pages/PlacementTest";
import { useAppData } from "./lib/useAppData";

function App() {
  const { data, recordAnswer, toggleBookmark, completePlacementTest } =
    useAppData();

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
          <Route
            path="/reading"
            element={<ReadingStudy data={data} onAnswer={recordAnswer} />}
          />
          <Route path="/review" element={<Review data={data} />} />
          <Route path="/progress" element={<ProgressPage data={data} />} />
          <Route
            path="/placement-test"
            element={
              <PlacementTest
                data={data}
                onAnswer={recordAnswer}
                onComplete={completePlacementTest}
              />
            }
          />
        </Routes>
        <BottomNav />
      </div>
    </HashRouter>
  );
}

export default App;
