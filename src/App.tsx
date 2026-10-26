import { Suspense } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import StorageNotice from "./components/StorageNotice";
import UpdateNotice from "./components/UpdateNotice";
import { RouteErrorBoundary } from "./components/ErrorBoundary";
import { Announcer } from "./components/Announcer";
import { MissReasonContext } from "./lib/missReasonContext";
import { RouteFocus } from "./components/RouteFocus";
import Home from "./pages/Home";
import { useAppData } from "./lib/useAppData";
import { lazyPage } from "./lib/lazyPage";

// ホーム以外の画面は、開いたときに読み込む（問題データは各画面に含まれ、最初の読み込みには含まれない）
const WordStudy = lazyPage(() => import("./pages/WordStudy"));
const GrammarStudy = lazyPage(() => import("./pages/GrammarStudy"));
const ReadingStudy = lazyPage(() => import("./pages/ReadingStudy"));
const Part6Study = lazyPage(() => import("./pages/Part6Study"));
const ListeningPart1Study = lazyPage(() => import("./pages/ListeningPart1Study"));
const ListeningPart2Study = lazyPage(() => import("./pages/ListeningPart2Study"));
const ListeningPart34Study = lazyPage(() => import("./pages/ListeningPart34Study"));
const Review = lazyPage(() => import("./pages/Review"));
const ProgressPage = lazyPage(() => import("./pages/Progress"));
const PlacementTest = lazyPage(() => import("./pages/PlacementTest"));
const MockTest = lazyPage(() => import("./pages/MockTest"));
const MockTestReview = lazyPage(() => import("./pages/MockTestReview"));
const QuickStudy = lazyPage(() => import("./pages/QuickStudy"));
const TimedDrill = lazyPage(() => import("./pages/TimedDrill"));
const Dictation = lazyPage(() => import("./pages/Dictation"));

/** 画面を読み込んでいる間の表示 */
function PageLoading() {
  return (
    <div role="status" className="mx-auto max-w-md px-5 pt-24 text-center text-sm text-(--color-muted)">
      読み込み中…
    </div>
  );
}

function App() {
  const {
    data,
    recordAnswer,
    toggleBookmark,
    setMissReason,
    completePlacementTest,
    recordMockTestResult,
    setTargetGoal,
    importData,
  } = useAppData();

  return (
    <HashRouter>
      <div className="min-h-screen bg-(--color-paper)">
        <Announcer />
        <RouteFocus targetId="main" />
        <StorageNotice data={data} />
        <main id="main" tabIndex={-1} className="outline-none">
        <MissReasonContext.Provider value={setMissReason}>
        <RouteErrorBoundary>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route
                path="/"
                element={<Home data={data} onSetTargetGoal={setTargetGoal} />}
              />
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
                element={
                  <ReadingStudy
                    data={data}
                    onAnswer={recordAnswer}
                    onToggleBookmark={toggleBookmark}
                  />
                }
              />
              <Route
                path="/part6"
                element={
                  <Part6Study
                    data={data}
                    onAnswer={recordAnswer}
                    onToggleBookmark={toggleBookmark}
                  />
                }
              />
              <Route
                path="/listening-part1"
                element={
                  <ListeningPart1Study
                    data={data}
                    onAnswer={recordAnswer}
                    onToggleBookmark={toggleBookmark}
                  />
                }
              />
              <Route
                path="/listening-part2"
                element={
                  <ListeningPart2Study
                    data={data}
                    onAnswer={recordAnswer}
                    onToggleBookmark={toggleBookmark}
                  />
                }
              />
              <Route
                path="/listening-part34"
                element={
                  <ListeningPart34Study
                    data={data}
                    onAnswer={recordAnswer}
                    onToggleBookmark={toggleBookmark}
                  />
                }
              />
              <Route path="/review" element={<Review data={data} />} />
              <Route
                path="/progress"
                element={<ProgressPage data={data} onImportData={importData} />}
              />
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
              <Route
                path="/mock-test"
                element={
                  <MockTest
                    data={data}
                    onAnswer={recordAnswer}
                    onRecordResult={recordMockTestResult}
                  />
                }
              />
              <Route
                path="/mock-test-review/:id"
                element={<MockTestReview data={data} />}
              />
              <Route
                path="/quick-study"
                element={
                  <QuickStudy
                    data={data}
                    onAnswer={recordAnswer}
                    onToggleBookmark={toggleBookmark}
                  />
                }
              />
              <Route
                path="/timed-drill"
                element={<TimedDrill data={data} onAnswer={recordAnswer} />}
              />
              <Route path="/dictation" element={<Dictation />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
        </MissReasonContext.Provider>
        </main>
        <BottomNav />
        <UpdateNotice />
      </div>
    </HashRouter>
  );
}

export default App;
